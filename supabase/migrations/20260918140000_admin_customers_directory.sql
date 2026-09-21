-- Admin Klanten directory: demo outstanding snapshot + CSV import history.
-- Outstanding is display-only integer minor units — not a legal ledger, Mollie
-- balance, VAT engine, or invoice system.

-- ---------------------------------------------------------------------------
-- Last-order helper for company directory rows (service_role only)
-- ---------------------------------------------------------------------------

create or replace function private.admin_order_stats_for_companies(p_company_ids uuid[])
returns table (
  company_id uuid,
  last_order_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    o.company_id,
    max(o.placed_at) as last_order_at
  from public.orders o
  where o.company_id = any (p_company_ids)
  group by o.company_id;
$$;

revoke all on function private.admin_order_stats_for_companies(uuid[]) from public;
grant execute on function private.admin_order_stats_for_companies(uuid[]) to service_role;

-- ---------------------------------------------------------------------------
-- Demo / marketing outstanding snapshot (NOT authoritative money)
-- ---------------------------------------------------------------------------

create table if not exists private.admin_company_display_snapshot (
  company_id uuid primary key
    references public.companies (id)
    on delete cascade,
  outstanding_minor integer not null default 0,
  currency text not null default 'EUR',
  source text not null default 'demo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint admin_company_display_snapshot_currency_iso
    check (currency ~ '^[A-Z]{3}$'),
  constraint admin_company_display_snapshot_source_check
    check (source in ('demo', 'seed')),
  constraint admin_company_display_snapshot_outstanding_nonneg
    check (outstanding_minor >= 0)
);

comment on table private.admin_company_display_snapshot is
  'NON-AUTHORITATIVE admin display only. Dummy/demo outstanding in integer minor units. Not a legal invoice ledger, not Mollie, not VAT.';

comment on column private.admin_company_display_snapshot.outstanding_minor is
  'Display-only integer minor units (e.g. eurocents). Never treat as a payable balance.';

drop trigger if exists admin_company_display_snapshot_set_updated_at
  on private.admin_company_display_snapshot;
create trigger admin_company_display_snapshot_set_updated_at
  before update on private.admin_company_display_snapshot
  for each row
  execute function private.set_updated_at();

alter table private.admin_company_display_snapshot enable row level security;
alter table private.admin_company_display_snapshot force row level security;

revoke all on table private.admin_company_display_snapshot from public;
revoke all on table private.admin_company_display_snapshot from anon;
revoke all on table private.admin_company_display_snapshot from authenticated;

grant select, insert, update, delete on table private.admin_company_display_snapshot to service_role;

drop policy if exists admin_company_display_snapshot_select_staff
  on private.admin_company_display_snapshot;
create policy admin_company_display_snapshot_select_staff
  on private.admin_company_display_snapshot
  for select
  to authenticated
  using (private.current_user_is_active_staff());

drop policy if exists admin_company_display_snapshot_update_staff
  on private.admin_company_display_snapshot;
create policy admin_company_display_snapshot_update_staff
  on private.admin_company_display_snapshot
  for update
  to authenticated
  using (private.current_user_is_active_staff())
  with check (private.current_user_is_active_staff());

grant select, update on table private.admin_company_display_snapshot to authenticated;

-- ---------------------------------------------------------------------------
-- Service-client CSV import history (staff directory strip)
-- ---------------------------------------------------------------------------

create table if not exists private.admin_customer_import_runs (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  imported_at timestamptz not null default now(),
  created_count integer not null default 0,
  updated_count integer not null default 0,
  skipped_count integer not null default 0,
  actor_user_id uuid
    references public.users (id)
    on delete set null,
  source text not null default 'import',

  constraint admin_customer_import_runs_file_name_nonempty
    check (length(trim(file_name)) between 1 and 240),
  constraint admin_customer_import_runs_source_check
    check (source in ('import', 'demo')),
  constraint admin_customer_import_runs_counts_check
    check (
      created_count >= 0
      and updated_count >= 0
      and skipped_count >= 0
    )
);

comment on table private.admin_customer_import_runs is
  'Staff-visible history of service-client CSV imports. Demo rows are non-production.';

create index if not exists admin_customer_import_runs_imported_idx
  on private.admin_customer_import_runs (imported_at desc);

alter table private.admin_customer_import_runs enable row level security;
alter table private.admin_customer_import_runs force row level security;

revoke all on table private.admin_customer_import_runs from public;
revoke all on table private.admin_customer_import_runs from anon;
revoke all on table private.admin_customer_import_runs from authenticated;

grant select, insert, update, delete on table private.admin_customer_import_runs to service_role;

drop policy if exists admin_customer_import_runs_select_staff
  on private.admin_customer_import_runs;
create policy admin_customer_import_runs_select_staff
  on private.admin_customer_import_runs
  for select
  to authenticated
  using (private.current_user_is_active_staff());

drop policy if exists admin_customer_import_runs_update_staff
  on private.admin_customer_import_runs;
create policy admin_customer_import_runs_update_staff
  on private.admin_customer_import_runs
  for update
  to authenticated
  using (private.current_user_is_active_staff())
  with check (private.current_user_is_active_staff());

grant select, update on table private.admin_customer_import_runs to authenticated;
