-- Commerce Foundation Phase 1: companies, membership, guest purchasers, orders, payments
-- See docs/architecture/commerce-foundation-phase1.md
-- website_requests remain independent; no FK from form submitters to commerce.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.company_type as enum ('product_customer', 'service_client');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.company_status as enum ('pending', 'active', 'blocked');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.company_member_role as enum ('owner', 'member');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_status as enum ('pending', 'confirmed', 'cancelled', 'completed');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payment_status as enum (
    'unpaid', 'pending', 'paid', 'failed', 'cancelled', 'refunded'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.fulfilment_status as enum (
    'unfulfilled', 'partial', 'fulfilled', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.order_source as enum ('storefront', 'admin', 'import', 'fixture');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- public.users: optional phone for customer operational contact
-- ---------------------------------------------------------------------------

alter table public.users
  add column if not exists phone text;

comment on column public.users.phone is
  'Optional operational phone for customer profiles; not an Auth credential.';

-- ---------------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------------

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  display_name text,
  kvk_number text,
  vat_number text,
  company_type public.company_type not null default 'product_customer',
  status public.company_status not null default 'pending',
  invoice_allowed boolean not null default false,
  email text,
  phone text,
  blocked_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint companies_legal_name_nonempty check (length(trim(legal_name)) > 0),
  constraint companies_kvk_format_check check (
    kvk_number is null or kvk_number ~ '^[0-9]{8}$'
  ),
  constraint companies_blocked_status_check check (
    (status = 'blocked' and blocked_at is not null)
    or (status <> 'blocked' and blocked_at is null)
  )
);

comment on table public.companies is
  'B2B legal entities. Commercial affiliation for registered customers via company_users.';

create index if not exists companies_status_idx on public.companies (status);
create index if not exists companies_type_idx on public.companies (company_type);
create index if not exists companies_email_lower_idx on public.companies (lower(email));
create index if not exists companies_legal_name_lower_idx on public.companies (lower(legal_name));
create unique index if not exists companies_kvk_unique_idx
  on public.companies (kvk_number)
  where kvk_number is not null;

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
  before update on public.companies
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- company_users (membership)
-- ---------------------------------------------------------------------------

create table if not exists public.company_users (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null
    references public.companies (id)
    on delete cascade,
  user_id uuid not null
    references public.users (id)
    on delete cascade,
  role public.company_member_role not null default 'owner',
  created_at timestamptz not null default now(),

  constraint company_users_unique unique (company_id, user_id)
);

comment on table public.company_users is
  'Company membership. Multiple users per company are supported.';

create index if not exists company_users_user_id_idx on public.company_users (user_id);
create index if not exists company_users_company_id_idx on public.company_users (company_id);

-- ---------------------------------------------------------------------------
-- guest_purchasers (no Auth)
-- ---------------------------------------------------------------------------

create table if not exists public.guest_purchasers (
  id uuid primary key default gen_random_uuid(),
  email_normalized text not null,
  email_display text not null,
  full_name text,
  company_name text,
  phone text,
  converted_user_id uuid
    references public.users (id)
    on delete set null,
  converted_company_id uuid
    references public.companies (id)
    on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint guest_purchasers_email_normalized_nonempty check (
    length(trim(email_normalized)) > 0
  ),
  constraint guest_purchasers_email_normalized_lower check (
    email_normalized = lower(trim(email_normalized))
  ),
  constraint guest_purchasers_conversion_consistency check (
    (
      converted_user_id is null
      and converted_company_id is null
      and converted_at is null
    )
    or (
      converted_user_id is not null
      and converted_at is not null
    )
  )
);

comment on table public.guest_purchasers is
  'Stable guest commercial identity. Never Auth. Unique normalized email; UUID is PK.';

create unique index if not exists guest_purchasers_email_normalized_uidx
  on public.guest_purchasers (email_normalized);

create index if not exists guest_purchasers_converted_user_idx
  on public.guest_purchasers (converted_user_id)
  where converted_user_id is not null;

drop trigger if exists guest_purchasers_set_updated_at on public.guest_purchasers;
create trigger guest_purchasers_set_updated_at
  before update on public.guest_purchasers
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null,

  company_id uuid
    references public.companies (id)
    on delete set null,
  customer_user_id uuid
    references public.users (id)
    on delete set null,
  guest_purchaser_id uuid
    references public.guest_purchasers (id)
    on delete restrict,

  purchaser_email text not null,
  purchaser_email_normalized text not null,
  purchaser_name text,
  purchaser_phone text,
  purchaser_company_name text,

  billing_address jsonb not null default '{}'::jsonb,
  shipping_address jsonb not null default '{}'::jsonb,

  currency char(3) not null default 'EUR',
  subtotal_minor bigint not null,
  tax_minor bigint not null,
  total_minor bigint not null,

  order_status public.order_status not null default 'pending',
  payment_status public.payment_status not null default 'unpaid',
  fulfilment_status public.fulfilment_status not null default 'unfulfilled',

  source public.order_source not null default 'storefront',

  payment_provider text,
  payment_provider_ref text,

  notes_internal text,
  placed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_number_nonempty check (length(trim(number)) > 0),
  constraint orders_currency_upper check (currency = upper(currency)),
  constraint orders_money_nonnegative check (
    subtotal_minor >= 0
    and tax_minor >= 0
    and total_minor >= 0
  ),
  constraint orders_purchaser_email_normalized_lower check (
    purchaser_email_normalized = lower(trim(purchaser_email_normalized))
  ),
  constraint orders_identity_check check (
    guest_purchaser_id is not null
    or customer_user_id is not null
    or company_id is not null
  )
);

comment on table public.orders is
  'Commercial orders. Purchaser/address/money snapshots are immutable commercial history.';

comment on column public.orders.payment_provider_ref is
  'Future Mollie (or other) payment id; unused until payment integration.';

create unique index if not exists orders_number_uidx on public.orders (number);
create index if not exists orders_company_id_idx on public.orders (company_id);
create index if not exists orders_customer_user_id_idx on public.orders (customer_user_id);
create index if not exists orders_guest_purchaser_id_idx on public.orders (guest_purchaser_id);
create index if not exists orders_purchaser_email_normalized_idx
  on public.orders (purchaser_email_normalized);
create index if not exists orders_placed_at_idx on public.orders (placed_at desc);
create index if not exists orders_payment_status_idx on public.orders (payment_status);
create index if not exists orders_order_status_idx on public.orders (order_status);
create unique index if not exists orders_payment_provider_ref_uidx
  on public.orders (payment_provider, payment_provider_ref)
  where payment_provider is not null and payment_provider_ref is not null;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- order_items (line snapshots)
-- ---------------------------------------------------------------------------

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.orders (id)
    on delete cascade,
  line_number integer not null,
  product_id uuid,
  sku text,
  name text not null,
  quantity integer not null,
  unit_price_minor bigint not null,
  tax_rate_bps integer not null default 2100,
  tax_minor bigint not null,
  line_total_minor bigint not null,
  created_at timestamptz not null default now(),

  constraint order_items_line_number_positive check (line_number > 0),
  constraint order_items_name_nonempty check (length(trim(name)) > 0),
  constraint order_items_quantity_positive check (quantity > 0),
  constraint order_items_money_nonnegative check (
    unit_price_minor >= 0
    and tax_minor >= 0
    and line_total_minor >= 0
  ),
  constraint order_items_tax_rate_bps_range check (
    tax_rate_bps >= 0 and tax_rate_bps <= 10000
  ),
  constraint order_items_order_line_unique unique (order_id, line_number)
);

comment on table public.order_items is
  'Order line commercial snapshots. Survive product rename/delete.';

create index if not exists order_items_order_id_idx on public.order_items (order_id);
create index if not exists order_items_product_id_idx
  on public.order_items (product_id)
  where product_id is not null;

-- ---------------------------------------------------------------------------
-- payments (future Mollie; no processing in Phase 1)
-- ---------------------------------------------------------------------------

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null
    references public.orders (id)
    on delete restrict,
  provider text not null default 'mollie',
  provider_payment_id text,
  amount_minor bigint not null,
  currency char(3) not null default 'EUR',
  status public.payment_status not null default 'pending',
  provider_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_amount_nonnegative check (amount_minor >= 0),
  constraint payments_currency_upper check (currency = upper(currency))
);

comment on table public.payments is
  'Payment attempts/records for future Mollie. No webhook processing in Phase 1.';

create index if not exists payments_order_id_idx on public.payments (order_id);
create unique index if not exists payments_provider_payment_uidx
  on public.payments (provider, provider_payment_id)
  where provider_payment_id is not null;

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
  before update on public.payments
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- Order number sequence helper
-- ---------------------------------------------------------------------------

create sequence if not exists private.order_number_seq;

create or replace function private.next_order_number(p_placed_at timestamptz default now())
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year text := to_char(p_placed_at at time zone 'UTC', 'YYYY');
  v_seq bigint;
begin
  v_seq := nextval('private.order_number_seq');
  return 'ORD-' || v_year || '-' || lpad((v_seq % 100000)::text, 5, '0');
end;
$$;

revoke all on function private.next_order_number(timestamptz) from public;
grant execute on function private.next_order_number(timestamptz) to service_role;

-- ---------------------------------------------------------------------------
-- RLS: deny-by-default for anon; staff read; service_role full; own-row customer later
-- ---------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.companies force row level security;
alter table public.company_users enable row level security;
alter table public.company_users force row level security;
alter table public.guest_purchasers enable row level security;
alter table public.guest_purchasers force row level security;
alter table public.orders enable row level security;
alter table public.orders force row level security;
alter table public.order_items enable row level security;
alter table public.order_items force row level security;
alter table public.payments enable row level security;
alter table public.payments force row level security;

-- Revoke broad access
revoke all on table public.companies from public, anon, authenticated;
revoke all on table public.company_users from public, anon, authenticated;
revoke all on table public.guest_purchasers from public, anon, authenticated;
revoke all on table public.orders from public, anon, authenticated;
revoke all on table public.order_items from public, anon, authenticated;
revoke all on table public.payments from public, anon, authenticated;

grant select, insert, update, delete on table public.companies to service_role;
grant select, insert, update, delete on table public.company_users to service_role;
grant select, insert, update, delete on table public.guest_purchasers to service_role;
grant select, insert, update, delete on table public.orders to service_role;
grant select, insert, update, delete on table public.order_items to service_role;
grant select, insert, update, delete on table public.payments to service_role;

-- Staff SELECT (admin SSR uses service role; these policies allow future staff clients)
drop policy if exists companies_select_staff on public.companies;
create policy companies_select_staff
  on public.companies for select to authenticated
  using (private.current_user_is_active_staff());

drop policy if exists company_users_select_staff on public.company_users;
create policy company_users_select_staff
  on public.company_users for select to authenticated
  using (private.current_user_is_active_staff());

drop policy if exists guest_purchasers_select_staff on public.guest_purchasers;
create policy guest_purchasers_select_staff
  on public.guest_purchasers for select to authenticated
  using (private.current_user_is_active_staff());

drop policy if exists orders_select_staff on public.orders;
create policy orders_select_staff
  on public.orders for select to authenticated
  using (private.current_user_is_active_staff());

drop policy if exists order_items_select_staff on public.order_items;
create policy order_items_select_staff
  on public.order_items for select to authenticated
  using (private.current_user_is_active_staff());

drop policy if exists payments_select_staff on public.payments;
create policy payments_select_staff
  on public.payments for select to authenticated
  using (private.current_user_is_active_staff());

-- Narrow future customer self-service reads (own user / membership only — no directory)
drop policy if exists company_users_select_own on public.company_users;
create policy company_users_select_own
  on public.company_users for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists companies_select_member on public.companies;
create policy companies_select_member
  on public.companies for select to authenticated
  using (
    exists (
      select 1 from public.company_users cu
      where cu.company_id = companies.id
        and cu.user_id = (select auth.uid())
    )
  );

drop policy if exists orders_select_own_customer on public.orders;
create policy orders_select_own_customer
  on public.orders for select to authenticated
  using (
    customer_user_id = (select auth.uid())
    or exists (
      select 1 from public.company_users cu
      where cu.company_id = orders.company_id
        and cu.user_id = (select auth.uid())
    )
  );

drop policy if exists order_items_select_own_order on public.order_items;
create policy order_items_select_own_order
  on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (
          o.customer_user_id = (select auth.uid())
          or exists (
            select 1 from public.company_users cu
            where cu.company_id = o.company_id
              and cu.user_id = (select auth.uid())
          )
        )
    )
  );

-- Grant SELECT to authenticated only where policies apply (no INSERT/UPDATE/DELETE)
grant select on table public.companies to authenticated;
grant select on table public.company_users to authenticated;
grant select on table public.guest_purchasers to authenticated;
grant select on table public.orders to authenticated;
grant select on table public.order_items to authenticated;
grant select on table public.payments to authenticated;

-- Guests: no authenticated policy beyond staff — customers cannot list guest_purchasers
-- (only staff policy above). Revoke was already done; staff policy covers staff.
-- Ordinary customers have no guest_purchasers policy that matches → deny.
