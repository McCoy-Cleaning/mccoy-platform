-- Allow inquiry deep-links on notification destination_path (?id=…).
-- Previously only plain paths matched ^/[A-Za-z0-9/_-]*$ which rejected query strings
-- and caused website_request.applicant_replied inserts to fail.

alter table public.notifications
  drop constraint if exists notifications_destination_path_format_check;

alter table public.notifications
  add constraint notifications_destination_path_format_check
  check (
    destination_path is null
    or destination_path ~ '^/[A-Za-z0-9/_-]*(?:\?[A-Za-z0-9_.=%:-]*)?$'
  );
