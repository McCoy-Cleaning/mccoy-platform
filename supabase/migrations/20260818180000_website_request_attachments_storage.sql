-- Durable private files for Admin -> Aanvragen.
-- Metadata remains on public.website_requests; object paths are deterministic:
--   {request_uuid}/{encodeURIComponent(sanitized_filename)}
-- Only trusted server code with service_role reads or writes this bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'website-request-attachments',
  'website-request-attachments',
  false,
  26214400,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Deliberately no storage.objects policy: anon/authenticated are denied.
