-- Persist Graph reply attachment metadata on website_request_mail_messages.
-- Bytes stay in the mailbox; Gesprek first-paint reads filename/contentType/size/id.

alter table public.website_request_mail_messages
  add column if not exists attachments jsonb not null default '[]'::jsonb;

comment on column public.website_request_mail_messages.attachments is
  'Graph file metadata for a correlated mail row (filename, contentType, size, graphAttachmentId). Bytes stay in the mailbox and are downloaded via /$value.';

alter table public.website_request_mail_messages
  drop constraint if exists website_request_mail_messages_attachments_is_array;

alter table public.website_request_mail_messages
  add constraint website_request_mail_messages_attachments_is_array
  check (jsonb_typeof(attachments) = 'array');
