-- Phase 1 staff identity: private authorization helpers
-- security definer, empty search_path, schema-qualified names only.

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.current_session_has_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

create or replace function private.current_user_is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.account_kind = 'staff'
      and u.status = 'active'
      and u.blocked_at is null
      and u.staff_role is not null
  );
$$;

create or replace function private.current_user_is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and u.account_kind = 'staff'
      and u.staff_role = 'super_admin'
      and u.status = 'active'
      and u.blocked_at is null
  );
$$;

create or replace function private.write_audit_log(
  p_actor_user_id uuid,
  p_action text,
  p_target_type text,
  p_target_id uuid,
  p_before jsonb default null,
  p_after jsonb default null,
  p_request_id uuid default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into private.audit_logs (
    actor_user_id,
    action,
    target_type,
    target_id,
    before_data,
    after_data,
    request_id,
    metadata
  )
  values (
    p_actor_user_id,
    p_action,
    p_target_type,
    p_target_id,
    p_before,
    p_after,
    p_request_id,
    p_metadata
  )
  returning id into v_id;

  return v_id;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row
  execute function private.set_updated_at();

drop trigger if exists staff_invitations_set_updated_at on private.staff_invitations;
create trigger staff_invitations_set_updated_at
  before update on private.staff_invitations
  for each row
  execute function private.set_updated_at();

revoke all on function private.current_session_has_aal2() from public;
revoke all on function private.current_user_is_active_staff() from public;
revoke all on function private.current_user_is_super_admin() from public;
revoke all on function private.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, uuid, jsonb) from public;

grant execute on function private.current_session_has_aal2() to authenticated;
grant execute on function private.current_user_is_active_staff() to authenticated;
grant execute on function private.current_user_is_super_admin() to authenticated;

grant execute on function private.current_session_has_aal2() to service_role;
grant execute on function private.current_user_is_active_staff() to service_role;
grant execute on function private.current_user_is_super_admin() to service_role;
grant execute on function private.write_audit_log(uuid, text, text, uuid, jsonb, jsonb, uuid, jsonb) to service_role;
