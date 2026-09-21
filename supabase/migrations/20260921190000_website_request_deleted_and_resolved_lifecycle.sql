-- Keep deletion distinct from resolution. `closed` means resolved and remains
-- visible in Admin -> Aanvragen -> Afgerond. `deleted` is a recoverable
-- soft-delete retained for audit/referential integrity and hidden from lists.
alter table public.website_requests
  drop constraint if exists website_requests_status_check;

alter table public.website_requests
  add constraint website_requests_status_check
  check (status in ('new', 'open', 'replied', 'closed', 'deleted', 'spam'));

comment on column public.website_requests.status is
  'Request lifecycle: new/open/replied are active, closed is resolved, deleted is soft-deleted, spam is suppressed.';

create index if not exists website_requests_active_updated_at_idx
  on public.website_requests (updated_at desc)
  where status in ('new', 'open', 'replied');

create index if not exists website_requests_resolved_updated_at_idx
  on public.website_requests (updated_at desc)
  where status = 'closed';

-- Reopen a resolved request atomically when a newly correlated applicant Graph
-- reply is inserted. Deleted/spam rows are intentionally excluded.
create or replace function private.reopen_resolved_website_request_on_inbound_mail()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.website_requests
  set status = 'open', updated_at = now()
  where id = new.request_id
    and status = 'closed';
  return new;
end;
$$;

drop trigger if exists website_request_mail_reopen_resolved_trg
  on public.website_request_mail_messages;

create trigger website_request_mail_reopen_resolved_trg
after insert on public.website_request_mail_messages
for each row
when (new.direction = 'inbound' and new.provider = 'microsoft_graph')
execute function private.reopen_resolved_website_request_on_inbound_mail();

revoke all on function private.reopen_resolved_website_request_on_inbound_mail()
  from public, anon, authenticated, service_role;
