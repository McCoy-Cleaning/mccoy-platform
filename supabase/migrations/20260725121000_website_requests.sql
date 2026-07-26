-- Stage C — Website requests (Aanvragen) Postgres persistence.
-- Migrates off .data/website-requests.json so form submit can atomically write
-- the request + a notification_outbox row (see 20260725120000_platform_notifications.sql).
-- Writes: service_role only (trusted server via createWebsiteRequest / RPCs below).
-- Reads: active staff via RLS. No anon/customer insert — guest form submits are
-- validated and persisted by trusted server code, never a direct client insert.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Human-readable request numbers: WR-{year}-{00001}
-- ---------------------------------------------------------------------------

create sequence if not exists public.website_requests_number_seq
  start with 1
  increment by 1;

create or replace function public.next_website_request_number()
returns text
language sql
as $$
  select 'WR-' || to_char(now() at time zone 'utc', 'YYYY') || '-' ||
    lpad(nextval('public.website_requests_number_seq')::text, 5, '0');
$$;

revoke all on function public.next_website_request_number() from public;
grant execute on function public.next_website_request_number() to service_role;

-- ---------------------------------------------------------------------------
-- public.website_requests
-- ---------------------------------------------------------------------------

create table if not exists public.website_requests (
  id uuid primary key default gen_random_uuid(),

  number text not null default public.next_website_request_number(),

  kind text not null
    check (kind in (
      'inquiry', 'glass_washing', 'furniture_cleaning', 'job_application', 'newsletter'
    )),
  status text not null default 'new'
    check (status in ('new', 'open', 'replied', 'closed', 'spam')),

  submitter_name text not null,
  submitter_email text not null default '',
  submitter_phone text,
  submitter_company text,

  subject text not null,
  fields jsonb not null default '{}'::jsonb,
  attachments jsonb not null default '[]'::jsonb,

  notification_state text not null default 'pending'
    check (notification_state in ('pending', 'sent', 'failed', 'skipped')),
  notification_error text,

  -- Forward-compatible with a future public.companies table; no FK yet.
  company_id uuid,

  -- Stable form identity: `${pageId}:${sourceId}`
  form_id text,
  source_page_id text,
  scope_key text,
  scope_label text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_replied_at timestamptz,

  constraint website_requests_number_uq unique (number),
  constraint website_requests_number_format_check
    check (number ~ '^WR-[0-9]{4}-[0-9]{5}$'),
  constraint website_requests_subject_len_check
    check (char_length(subject) between 1 and 200),
  constraint website_requests_submitter_name_len_check
    check (char_length(submitter_name) between 1 and 200),
  constraint website_requests_submitter_email_len_check
    check (char_length(submitter_email) <= 320),
  constraint website_requests_form_id_len_check
    check (form_id is null or char_length(form_id) <= 200),
  constraint website_requests_scope_key_len_check
    check (scope_key is null or char_length(scope_key) <= 120)
);

comment on table public.website_requests is
  'Structured website form submissions (Aanvragen). Immutable submission fields; status/reply/notification state mutate via trusted server RPCs.';

comment on column public.website_requests.fields is
  'Sanitized form field map (Record<string,string>) — never raw HTML.';

comment on column public.website_requests.company_id is
  'Reserved for future company linkage. Never derive from a guest email match — set only from authenticated company membership.';

create index if not exists website_requests_status_idx
  on public.website_requests (status, created_at desc);

create index if not exists website_requests_kind_idx
  on public.website_requests (kind, created_at desc);

create index if not exists website_requests_scope_key_idx
  on public.website_requests (scope_key)
  where scope_key is not null;

create index if not exists website_requests_created_at_idx
  on public.website_requests (created_at desc);

create index if not exists website_requests_submitter_email_lower_idx
  on public.website_requests (lower(submitter_email))
  where submitter_email <> '';

create index if not exists website_requests_form_id_idx
  on public.website_requests (form_id)
  where form_id is not null;

drop trigger if exists website_requests_set_updated_at on public.website_requests;
create trigger website_requests_set_updated_at
  before update on public.website_requests
  for each row
  execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- public.website_request_replies (append-only; staff replies to submitter)
-- ---------------------------------------------------------------------------

create table if not exists public.website_request_replies (
  id uuid primary key default gen_random_uuid(),

  request_id uuid not null
    references public.website_requests (id)
    on delete cascade,

  body text not null,
  sent_at timestamptz not null default now(),
  sent_by text not null,
  to_email text not null,
  -- Provider message id (SMTP Message-ID). Legacy field name in app types is `resendId`.
  provider_message_id text,

  created_at timestamptz not null default now(),

  constraint website_request_replies_body_len_check
    check (char_length(body) between 1 and 8000),
  constraint website_request_replies_sent_by_len_check
    check (char_length(sent_by) between 1 and 200),
  constraint website_request_replies_to_email_len_check
    check (char_length(to_email) between 1 and 320)
);

comment on table public.website_request_replies is
  'Immutable staff reply history for a website request. Never rewritten after send.';

create index if not exists website_request_replies_request_idx
  on public.website_request_replies (request_id, sent_at);

-- ---------------------------------------------------------------------------
-- Atomic create: request + notification_outbox in one transaction
-- ---------------------------------------------------------------------------

create or replace function public.create_website_request_with_notification(
  p_kind text,
  p_status text,
  p_submitter_name text,
  p_submitter_email text,
  p_submitter_phone text,
  p_submitter_company text,
  p_subject text,
  p_fields jsonb,
  p_attachments jsonb,
  p_notification_state text,
  p_form_id text,
  p_source_page_id text,
  p_scope_key text,
  p_scope_label text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_number text := public.next_website_request_number();
  v_now timestamptz := now();
  v_row public.website_requests%rowtype;
begin
  insert into public.website_requests (
    id, number, kind, status,
    submitter_name, submitter_email, submitter_phone, submitter_company,
    subject, fields, attachments,
    notification_state, notification_error,
    form_id, source_page_id, scope_key, scope_label,
    created_at, updated_at
  ) values (
    v_id, v_number, p_kind, coalesce(p_status, 'new'),
    p_submitter_name, coalesce(p_submitter_email, ''), p_submitter_phone, p_submitter_company,
    p_subject, coalesce(p_fields, '{}'::jsonb), coalesce(p_attachments, '[]'::jsonb),
    coalesce(p_notification_state, 'pending'), null,
    p_form_id, p_source_page_id, p_scope_key, p_scope_label,
    v_now, v_now
  )
  returning * into v_row;

  insert into public.notification_outbox (type, payload, dedupe_key)
  values (
    'website_request.received',
    jsonb_build_object(
      'title', 'Nieuwe aanvraag: ' || p_subject,
      'destinationPath', '/admin/inquiries',
      'entityType', 'website_request',
      'entityId', v_id::text,
      'metadata', jsonb_build_object(
        'requestId', v_id::text,
        'requestNumber', v_number,
        'kind', p_kind
      )
    ),
    'website_request.received:' || v_id::text
  )
  on conflict (dedupe_key) where dedupe_key is not null do nothing;

  return to_jsonb(v_row);
end;
$$;

revoke all on function public.create_website_request_with_notification(
  text, text, text, text, text, text, text, jsonb, jsonb, text, text, text, text, text
) from public;
grant execute on function public.create_website_request_with_notification(
  text, text, text, text, text, text, text, jsonb, jsonb, text, text, text, text, text
) to service_role;

-- ---------------------------------------------------------------------------
-- Atomic reply: append reply + advance status
-- ---------------------------------------------------------------------------

create or replace function public.append_website_request_reply(
  p_request_id uuid,
  p_body text,
  p_sent_by text,
  p_to_email text,
  p_provider_message_id text,
  p_next_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reply_id uuid := gen_random_uuid();
  v_now timestamptz := now();
  v_found boolean;
begin
  select true into v_found from public.website_requests where id = p_request_id;
  if v_found is null then
    raise exception 'append_website_request_reply: request % not found', p_request_id;
  end if;

  insert into public.website_request_replies (
    id, request_id, body, sent_at, sent_by, to_email, provider_message_id, created_at
  ) values (
    v_reply_id, p_request_id, p_body, v_now, p_sent_by, p_to_email, p_provider_message_id, v_now
  );

  update public.website_requests
  set status = coalesce(p_next_status, 'replied'),
      last_replied_at = v_now,
      updated_at = v_now
  where id = p_request_id;

  return jsonb_build_object('id', v_reply_id, 'sentAt', v_now);
end;
$$;

revoke all on function public.append_website_request_reply(
  uuid, text, text, text, text, text
) from public;
grant execute on function public.append_website_request_reply(
  uuid, text, text, text, text, text
) to service_role;

-- ---------------------------------------------------------------------------
-- RLS — staff select; service_role write; no anon/authenticated insert
-- ---------------------------------------------------------------------------

alter table public.website_requests enable row level security;
alter table public.website_requests force row level security;

alter table public.website_request_replies enable row level security;
alter table public.website_request_replies force row level security;

drop policy if exists website_requests_select_staff on public.website_requests;
create policy website_requests_select_staff
  on public.website_requests
  for select
  to authenticated
  using (private.current_user_is_active_staff());

drop policy if exists website_request_replies_select_staff on public.website_request_replies;
create policy website_request_replies_select_staff
  on public.website_request_replies
  for select
  to authenticated
  using (private.current_user_is_active_staff());

-- No insert/update/delete policies for anon/authenticated: deny by default.
-- All writes go through service_role via the RPCs above or trusted server updates.

revoke all on table public.website_requests from public;
revoke all on table public.website_requests from anon;
revoke all on table public.website_requests from authenticated;

revoke all on table public.website_request_replies from public;
revoke all on table public.website_request_replies from anon;
revoke all on table public.website_request_replies from authenticated;

grant select on table public.website_requests to authenticated;
grant select on table public.website_request_replies to authenticated;

grant select, insert, update, delete on table public.website_requests to service_role;
grant select, insert, update, delete on table public.website_request_replies to service_role;

grant usage, select on sequence public.website_requests_number_seq to service_role;
