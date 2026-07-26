-- Phase 1 staff identity: sync auth.users.email → public.users.email
-- Keep minimal: no external calls, invites, or complex role logic.

create or replace function private.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is distinct from old.email then
    update public.users
    set email = new.email,
        updated_at = now()
    where id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (new.email is distinct from old.email)
  execute function private.sync_user_email();
