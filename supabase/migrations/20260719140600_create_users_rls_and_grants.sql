-- Phase 1 staff identity: RLS and grants for public.users
-- Browser: SELECT own profile only. No direct writes. Mutations via trusted server.

alter table public.users enable row level security;
alter table public.users force row level security;

-- Drop existing policies if re-applied
drop policy if exists users_select_own on public.users;
drop policy if exists users_select_invited_own on public.users;

-- Own profile read (invited or active staff may read themselves for MFA onboarding)
create policy users_select_own
  on public.users
  for select
  to authenticated
  using (id = (select auth.uid()));

-- Explicit grants
revoke all on table public.users from public;
revoke all on table public.users from anon;
revoke all on table public.users from authenticated;

grant select on table public.users to authenticated;
grant select, insert, update, delete on table public.users to service_role;

-- private tables: no anon/authenticated table access
revoke all on table private.staff_invitations from public;
revoke all on table private.staff_invitations from anon;
revoke all on table private.staff_invitations from authenticated;
grant select, insert, update, delete on table private.staff_invitations to service_role;

revoke all on table private.audit_logs from public;
revoke all on table private.audit_logs from anon;
revoke all on table private.audit_logs from authenticated;
grant insert, select on table private.audit_logs to service_role;

-- Ensure private schema stays usage-limited
revoke usage on schema private from anon;
revoke usage on schema private from authenticated;
grant usage on schema private to service_role;
