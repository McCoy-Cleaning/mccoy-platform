-- Commerce Foundation Phase 2: customer portal identity, invitations, membership roles
-- See docs/architecture/commerce-foundation-phase2.md
--
-- Idempotent: safe if roles are still owner/member OR already account_admin/account_user.
-- Customer companies: at most one active Account Admin (never multi-admin).

-- ---------------------------------------------------------------------------
-- Pre-flight: refuse migration if multiple admins per company exist
-- Compare via text so this works before and after the enum rename.
-- ---------------------------------------------------------------------------

do $$
declare
  v_admin_label text;
  v_has_multi boolean := false;
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'company_member_role'
      and e.enumlabel = 'owner'
  ) then
    v_admin_label := 'owner';
  elsif exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'company_member_role'
      and e.enumlabel = 'account_admin'
  ) then
    v_admin_label := 'account_admin';
  else
    raise exception
      'commerce_phase2: company_member_role has neither owner nor account_admin — unexpected enum state';
  end if;

  execute format(
    $q$
      select exists (
        select company_id
        from public.company_users
        where role::text = %L
        group by company_id
        having count(*) > 1
      )
    $q$,
    v_admin_label
  )
  into v_has_multi;

  if v_has_multi then
    raise exception
      'commerce_phase2: multiple % memberships per company — resolve manually before migration (exactly one Account Admin per customer company)',
      v_admin_label;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Membership status + role rename (owner/member → account_admin/account_user)
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.company_member_status as enum ('active', 'suspended');
exception when duplicate_object then null;
end $$;

comment on type public.company_member_status is
  'Real company membership lifecycle. Pending invites live in private.customer_invitations.';

alter table public.company_users
  add column if not exists status public.company_member_status not null default 'active';

alter table public.company_users
  add column if not exists updated_at timestamptz not null default now();

drop trigger if exists company_users_set_updated_at on public.company_users;
create trigger company_users_set_updated_at
  before update on public.company_users
  for each row
  execute function private.set_updated_at();

-- Rename only when legacy labels still exist (no-op if already migrated).
do $$
begin
  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'company_member_role'
      and e.enumlabel = 'owner'
  ) then
    execute 'alter type public.company_member_role rename value ''owner'' to ''account_admin''';
  end if;

  if exists (
    select 1
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'company_member_role'
      and e.enumlabel = 'member'
  ) then
    execute 'alter type public.company_member_role rename value ''member'' to ''account_user''';
  end if;
end $$;

comment on type public.company_member_role is
  'Customer portal roles only: account_admin (one active per company) and account_user.';

-- Prefer account_admin as the column default after rename (idempotent).
alter table public.company_users
  alter column role set default 'account_admin'::public.company_member_role;

-- Exactly one active account admin per company (database-enforced)
create unique index if not exists company_users_one_active_admin_uq
  on public.company_users (company_id)
  where role = 'account_admin' and status = 'active';

-- ---------------------------------------------------------------------------
-- companies: external identity for existing McCoy service clients
-- ---------------------------------------------------------------------------

alter table public.companies
  add column if not exists external_customer_id text;

comment on column public.companies.external_customer_id is
  'Authoritative McCoy/backoffice customer identifier for upsert sync; never fuzzy-merge on name.';

create unique index if not exists companies_external_customer_id_uq
  on public.companies (external_customer_id)
  where external_customer_id is not null;

-- ---------------------------------------------------------------------------
-- Legacy service-client mirror (canonical staging for ExistingCustomerProvider)
-- ---------------------------------------------------------------------------

create table if not exists public.commerce_legacy_service_clients (
  external_customer_id text primary key,
  legal_name text not null,
  display_name text,
  kvk_number text,
  vat_number text,
  email text,
  phone text,
  invoice_allowed boolean not null default false,
  company_status public.company_status not null default 'active',
  source_updated_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint commerce_legacy_service_clients_legal_name_nonempty
    check (length(trim(legal_name)) > 0),
  constraint commerce_legacy_service_clients_kvk_format_check check (
    kvk_number is null or kvk_number ~ '^[0-9]{8}$'
  )
);

comment on table public.commerce_legacy_service_clients is
  'Authoritative mirror for existing McCoy service clients until external integration lands.';

drop trigger if exists commerce_legacy_service_clients_set_updated_at on public.commerce_legacy_service_clients;
create trigger commerce_legacy_service_clients_set_updated_at
  before update on public.commerce_legacy_service_clients
  for each row
  execute function private.set_updated_at();

alter table public.commerce_legacy_service_clients enable row level security;
alter table public.commerce_legacy_service_clients force row level security;
revoke all on table public.commerce_legacy_service_clients from public, anon, authenticated;
grant select, insert, update, delete on table public.commerce_legacy_service_clients to service_role;

drop policy if exists commerce_legacy_service_clients_select_staff on public.commerce_legacy_service_clients;
create policy commerce_legacy_service_clients_select_staff
  on public.commerce_legacy_service_clients for select to authenticated
  using (private.current_user_is_active_staff());

grant select on table public.commerce_legacy_service_clients to authenticated;

-- ---------------------------------------------------------------------------
-- Customer invitations (private — not exposed via Data API)
-- ---------------------------------------------------------------------------

do $$ begin
  create type private.customer_invitation_status as enum (
    'pending',
    'consumed',
    'expired',
    'revoked'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type private.customer_inviter_type as enum ('staff', 'account_admin');
exception when duplicate_object then null;
end $$;

create table if not exists private.customer_invitations (
  id uuid primary key default gen_random_uuid(),

  company_id uuid not null
    references public.companies (id)
    on delete cascade,

  email text not null,
  email_normalized text not null,
  intended_role public.company_member_role not null,

  token_hash text not null,
  status private.customer_invitation_status not null default 'pending',

  expires_at timestamptz not null,
  consumed_at timestamptz,
  revoked_at timestamptz,

  invited_by_type private.customer_inviter_type not null,
  invited_by_user_id uuid
    references public.users (id)
    on delete set null,

  invitee_first_name text,
  invitee_last_name text,
  invitee_phone text,

  reminder_count integer not null default 0,
  last_reminder_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint customer_invitations_email_normalized_lower check (
    email_normalized = lower(trim(email_normalized))
  ),
  constraint customer_invitations_token_hash_nonempty check (
    length(trim(token_hash)) > 0
  ),
  constraint customer_invitations_consumed_consistency check (
    (status = 'consumed' and consumed_at is not null)
    or (status <> 'consumed' and consumed_at is null)
  ),
  constraint customer_invitations_revoked_consistency check (
    (status = 'revoked' and revoked_at is not null)
    or (status <> 'revoked' and revoked_at is null)
  ),
  constraint customer_invitations_account_admin_staff_only check (
  intended_role <> 'account_admin' or invited_by_type = 'staff'
  )
);

comment on table private.customer_invitations is
  'Pending customer portal invites. Raw tokens are never stored — only SHA-256 hashes.';

create index if not exists customer_invitations_token_hash_idx
  on private.customer_invitations (token_hash);

create index if not exists customer_invitations_company_email_idx
  on private.customer_invitations (company_id, email_normalized);

create index if not exists customer_invitations_status_expires_idx
  on private.customer_invitations (status, expires_at)
  where status = 'pending';

create unique index if not exists customer_invitations_one_pending_per_target_uq
  on private.customer_invitations (company_id, email_normalized, intended_role)
  where status = 'pending';

drop trigger if exists customer_invitations_set_updated_at on private.customer_invitations;
create trigger customer_invitations_set_updated_at
  before update on private.customer_invitations
  for each row
  execute function private.set_updated_at();

revoke all on table private.customer_invitations from public, anon, authenticated;
grant select, insert, update, delete on table private.customer_invitations to service_role;

-- ---------------------------------------------------------------------------
-- Commerce email outbox (durable invitation / reminder delivery)
-- ---------------------------------------------------------------------------

create table if not exists private.commerce_email_outbox (
  id uuid primary key default gen_random_uuid(),
  email_type text not null,
  to_email_normalized text not null,
  payload jsonb not null default '{}'::jsonb,
  invitation_id uuid
    references private.customer_invitations (id)
    on delete set null,
  dedupe_key text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  failed_at timestamptz,
  attempts integer not null default 0,
  last_error text
);

create unique index if not exists commerce_email_outbox_dedupe_uq
  on private.commerce_email_outbox (dedupe_key)
  where dedupe_key is not null;

create index if not exists commerce_email_outbox_unprocessed_idx
  on private.commerce_email_outbox (created_at)
  where processed_at is null and failed_at is null;

revoke all on table private.commerce_email_outbox from public, anon, authenticated;
grant select, insert, update, delete on table private.commerce_email_outbox to service_role;

-- ---------------------------------------------------------------------------
-- Helper: active customer membership (RLS + policies)
-- ---------------------------------------------------------------------------

create or replace function private.current_user_is_active_customer_member(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_users cu
    join public.companies c on c.id = cu.company_id
    join public.users u on u.id = cu.user_id
    where cu.user_id = (select auth.uid())
      and cu.company_id = p_company_id
      and cu.status = 'active'
      and cu.role in ('account_admin', 'account_user')
      and c.status = 'active'
      and u.account_kind = 'customer'
      and u.status = 'active'
  );
$$;

revoke all on function private.current_user_is_active_customer_member(uuid) from public;
grant execute on function private.current_user_is_active_customer_member(uuid) to authenticated, service_role;

create or replace function private.current_user_is_company_account_admin(p_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.company_users cu
    join public.companies c on c.id = cu.company_id
    join public.users u on u.id = cu.user_id
    where cu.user_id = (select auth.uid())
      and cu.company_id = p_company_id
      and cu.status = 'active'
      and cu.role = 'account_admin'
      and c.status = 'active'
      and u.account_kind = 'customer'
      and u.status = 'active'
  );
$$;

revoke all on function private.current_user_is_company_account_admin(uuid) from public;
grant execute on function private.current_user_is_company_account_admin(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Transactional Account Admin transfer (staff-only)
-- ---------------------------------------------------------------------------

create or replace function private.transfer_company_account_admin(
  p_company_id uuid,
  p_new_user_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_admin_id uuid;
begin
  perform 1 from public.companies where id = p_company_id for update;
  if not found then
    raise exception 'transfer_company_account_admin: company not found';
  end if;

  select cu.user_id into v_old_admin_id
  from public.company_users cu
  where cu.company_id = p_company_id
    and cu.role = 'account_admin'
    and cu.status = 'active'
  for update;

  if v_old_admin_id is null then
    raise exception 'transfer_company_account_admin: no active account admin';
  end if;

  if v_old_admin_id = p_new_user_id then
    raise exception 'transfer_company_account_admin: replacement is current admin';
  end if;

  if not exists (
    select 1 from public.company_users cu
    where cu.company_id = p_company_id
      and cu.user_id = p_new_user_id
      and cu.role = 'account_user'
      and cu.status = 'active'
  ) then
    raise exception 'transfer_company_account_admin: replacement must be active account_user';
  end if;

  update public.company_users
  set role = 'account_user', updated_at = now()
  where company_id = p_company_id
    and user_id = v_old_admin_id
    and role = 'account_admin'
    and status = 'active';

  update public.company_users
  set role = 'account_admin', updated_at = now()
  where company_id = p_company_id
    and user_id = p_new_user_id
    and role = 'account_user'
    and status = 'active';

  if (
    select count(*) from public.company_users
    where company_id = p_company_id
      and role = 'account_admin'
      and status = 'active'
  ) <> 1 then
    raise exception 'transfer_company_account_admin: invariant violated after transfer';
  end if;
end;
$$;

revoke all on function private.transfer_company_account_admin(uuid, uuid, uuid) from public;
grant execute on function private.transfer_company_account_admin(uuid, uuid, uuid) to service_role;

create or replace function public.transfer_company_account_admin(
  p_company_id uuid,
  p_new_user_id uuid,
  p_actor_user_id uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  select private.transfer_company_account_admin(p_company_id, p_new_user_id, p_actor_user_id);
$$;

revoke all on function public.transfer_company_account_admin(uuid, uuid, uuid) from public;
grant execute on function public.transfer_company_account_admin(uuid, uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- RLS updates: membership status + company active checks
-- ---------------------------------------------------------------------------

drop policy if exists company_users_select_own on public.company_users;
create policy company_users_select_own
  on public.company_users for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.current_user_is_active_customer_member(company_id)
  );

drop policy if exists companies_select_member on public.companies;
create policy companies_select_member
  on public.companies for select to authenticated
  using (private.current_user_is_active_customer_member(id));

drop policy if exists orders_select_own_customer on public.orders;
create policy orders_select_own_customer
  on public.orders for select to authenticated
  using (
    customer_user_id = (select auth.uid())
    or private.current_user_is_active_customer_member(company_id)
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
          or private.current_user_is_active_customer_member(o.company_id)
        )
    )
  );
