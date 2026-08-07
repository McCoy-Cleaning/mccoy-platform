-- Enable Realtime for in-app notification delivery.
-- Admin NotificationService listens to postgres_changes on this table;
-- without publication membership, recipient inserts never push to the browser
-- (bell/toast only refresh on focus/visibility — often after the event is missed).

alter table public.notification_recipients replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.notification_recipients;
exception
  when duplicate_object then
    null;
  when undefined_object then
    -- Local/test DBs without supabase_realtime publication: skip safely.
    raise notice 'supabase_realtime publication missing; skip notification_recipients realtime';
end $$;
