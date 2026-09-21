-- Company-scoped favourite products (shared list per company).
-- Minimal product identity only: no prices, stock, VAT, or catalogue admin.
-- Favourites store product references. Adding requires an active product.

-- ---------------------------------------------------------------------------
-- Product lifecycle (identity only)
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.product_status as enum ('draft', 'active', 'archived');
exception when duplicate_object then null;
end $$;

comment on type public.product_status is
  'Catalogue lifecycle. Archived products stay on historical favourites; new adds require active.';

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  status public.product_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint products_name_nonempty check (length(trim(name)) > 0),
  constraint products_sku_nonempty check (sku is null or length(trim(sku)) > 0)
);

comment on table public.products is
  'Minimal product identity for references (favourites). No prices or inventory.';

create unique index if not exists products_sku_unique_idx
  on public.products (sku)
  where sku is not null;

create index if not exists products_status_idx on public.products (status);
create index if not exists products_name_lower_idx on public.products (lower(name));

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row
  execute function private.set_updated_at();

alter table public.products enable row level security;
alter table public.products force row level security;

revoke all on table public.products from public;
revoke all on table public.products from anon;
revoke all on table public.products from authenticated;

grant select on table public.products to anon;
grant select, insert, update, delete on table public.products to authenticated;
grant select, insert, update, delete on table public.products to service_role;

-- Public catalogue identity: active products only. No anon writes (no insert/update/delete policies for anon).
drop policy if exists products_select_active_public on public.products;
create policy products_select_active_public
  on public.products
  for select
  to anon, authenticated
  using (status = 'active');

drop policy if exists products_select_staff on public.products;
create policy products_select_staff
  on public.products
  for select
  to authenticated
  using (private.current_user_is_active_staff());

drop policy if exists products_insert_staff on public.products;
create policy products_insert_staff
  on public.products
  for insert
  to authenticated
  with check (private.current_user_is_active_staff());

drop policy if exists products_update_staff on public.products;
create policy products_update_staff
  on public.products
  for update
  to authenticated
  using (private.current_user_is_active_staff())
  with check (private.current_user_is_active_staff());

drop policy if exists products_delete_staff on public.products;
create policy products_delete_staff
  on public.products
  for delete
  to authenticated
  using (private.current_user_is_active_staff());

-- ---------------------------------------------------------------------------
-- Company favourite products (shared list)
-- ---------------------------------------------------------------------------

create table if not exists public.company_favourite_products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null
    references public.companies (id)
    on delete cascade,
  product_id uuid not null
    references public.products (id)
    on delete restrict,
  created_by uuid
    references public.users (id)
    on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint company_favourite_products_company_product_uq unique (company_id, product_id)
);

comment on table public.company_favourite_products is
  'Company-shared favourite product list. No prices. Staff and company members may add/remove.';

create index if not exists company_favourite_products_company_id_idx
  on public.company_favourite_products (company_id);

create index if not exists company_favourite_products_product_id_idx
  on public.company_favourite_products (product_id);

drop trigger if exists company_favourite_products_set_updated_at
  on public.company_favourite_products;
create trigger company_favourite_products_set_updated_at
  before update on public.company_favourite_products
  for each row
  execute function private.set_updated_at();

alter table public.company_favourite_products enable row level security;
alter table public.company_favourite_products force row level security;

revoke all on table public.company_favourite_products from public;
revoke all on table public.company_favourite_products from anon;
revoke all on table public.company_favourite_products from authenticated;

grant select, insert, delete on table public.company_favourite_products to authenticated;
grant select, insert, update, delete on table public.company_favourite_products to service_role;

drop policy if exists company_favourite_products_select_staff
  on public.company_favourite_products;
create policy company_favourite_products_select_staff
  on public.company_favourite_products
  for select
  to authenticated
  using (private.current_user_is_active_staff());

drop policy if exists company_favourite_products_insert_staff
  on public.company_favourite_products;
create policy company_favourite_products_insert_staff
  on public.company_favourite_products
  for insert
  to authenticated
  with check (private.current_user_is_active_staff());

drop policy if exists company_favourite_products_delete_staff
  on public.company_favourite_products;
create policy company_favourite_products_delete_staff
  on public.company_favourite_products
  for delete
  to authenticated
  using (private.current_user_is_active_staff());

drop policy if exists company_favourite_products_select_member
  on public.company_favourite_products;
create policy company_favourite_products_select_member
  on public.company_favourite_products
  for select
  to authenticated
  using (private.current_user_is_active_customer_member(company_id));

drop policy if exists company_favourite_products_insert_member
  on public.company_favourite_products;
create policy company_favourite_products_insert_member
  on public.company_favourite_products
  for insert
  to authenticated
  with check (private.current_user_is_active_customer_member(company_id));

drop policy if exists company_favourite_products_delete_member
  on public.company_favourite_products;
create policy company_favourite_products_delete_member
  on public.company_favourite_products
  for delete
  to authenticated
  using (private.current_user_is_active_customer_member(company_id));
