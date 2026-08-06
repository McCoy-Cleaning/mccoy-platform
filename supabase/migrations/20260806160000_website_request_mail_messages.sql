-- Aanvragen thread identity: durable mail messages linked to website_requests.
-- Additive — does not replace website_request_replies (staff outbound history).

create table if not exists public.website_request_mail_messages (
  id uuid primary key default gen_random_uuid(),

  request_id uuid not null
    references public.website_requests (id)
    on delete cascade,

  direction text not null
    check (direction in ('inbound', 'outbound')),

  provider text not null
    check (provider in ('microsoft_graph', 'imap', 'website_form', 'smtp')),

  mailbox text not null default '',

  graph_message_id text,
  internet_message_id text,
  conversation_id text,
  conversation_index text,
  in_reply_to text,
  references_header text,

  sender_address text,
  recipient_addresses text[] not null default '{}',

  subject text,
  body_text text,

  occurred_at timestamptz not null default now(),
  is_read boolean not null default true,

  created_at timestamptz not null default now(),

  constraint website_request_mail_messages_mailbox_len_check
    check (char_length(mailbox) <= 320),
  constraint website_request_mail_messages_graph_id_len_check
    check (graph_message_id is null or char_length(graph_message_id) between 1 and 512),
  constraint website_request_mail_messages_internet_id_len_check
    check (internet_message_id is null or char_length(internet_message_id) between 1 and 998),
  constraint website_request_mail_messages_subject_len_check
    check (subject is null or char_length(subject) <= 500),
  constraint website_request_mail_messages_body_len_check
    check (body_text is null or char_length(body_text) <= 20000)
);

comment on table public.website_request_mail_messages is
  'Inbound/outbound email identity for an Aanvragen inquiry. Used for Graph/RFC thread correlation; not a second inbox schema.';

create unique index if not exists website_request_mail_messages_mailbox_graph_uq
  on public.website_request_mail_messages (lower(mailbox), graph_message_id)
  where graph_message_id is not null and mailbox <> '';

create unique index if not exists website_request_mail_messages_mailbox_internet_uq
  on public.website_request_mail_messages (lower(mailbox), lower(internet_message_id))
  where internet_message_id is not null and mailbox <> '';

create index if not exists website_request_mail_messages_request_idx
  on public.website_request_mail_messages (request_id, occurred_at);

create index if not exists website_request_mail_messages_conversation_idx
  on public.website_request_mail_messages (lower(mailbox), conversation_id)
  where conversation_id is not null;

create index if not exists website_request_mail_messages_internet_lookup_idx
  on public.website_request_mail_messages (lower(internet_message_id))
  where internet_message_id is not null;

-- Thread identity columns on the inquiry itself (backfill-friendly, nullable).
alter table public.website_requests
  add column if not exists root_internet_message_id text,
  add column if not exists root_graph_message_id text,
  add column if not exists graph_conversation_id text,
  add column if not exists last_message_at timestamptz;

comment on column public.website_requests.root_internet_message_id is
  'RFC Message-ID of the original form notification when known.';
comment on column public.website_requests.graph_conversation_id is
  'Microsoft Graph conversationId for the inquiry thread when known.';
comment on column public.website_requests.last_message_at is
  'Latest inbound or outbound message timestamp for list sorting.';

alter table public.website_request_mail_messages enable row level security;
alter table public.website_request_mail_messages force row level security;

drop policy if exists website_request_mail_messages_select_staff on public.website_request_mail_messages;
create policy website_request_mail_messages_select_staff
  on public.website_request_mail_messages
  for select
  to authenticated
  using (private.current_user_is_active_staff());

revoke all on table public.website_request_mail_messages from public;
revoke all on table public.website_request_mail_messages from anon;
revoke all on table public.website_request_mail_messages from authenticated;
grant select on table public.website_request_mail_messages to authenticated;
grant select, insert, update, delete on table public.website_request_mail_messages to service_role;

-- Idempotent upsert of a correlated mail message (service_role).
create or replace function public.upsert_website_request_mail_message(
  p_request_id uuid,
  p_direction text,
  p_provider text,
  p_mailbox text,
  p_graph_message_id text,
  p_internet_message_id text,
  p_conversation_id text,
  p_conversation_index text,
  p_in_reply_to text,
  p_references_header text,
  p_sender_address text,
  p_recipient_addresses text[],
  p_subject text,
  p_body_text text,
  p_occurred_at timestamptz,
  p_is_read boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_existing uuid;
  v_mailbox text := lower(trim(coalesce(p_mailbox, '')));
begin
  if p_direction not in ('inbound', 'outbound') then
    raise exception 'upsert_website_request_mail_message: invalid direction';
  end if;
  if p_provider not in ('microsoft_graph', 'imap', 'website_form', 'smtp') then
    raise exception 'upsert_website_request_mail_message: invalid provider';
  end if;
  if not exists (select 1 from public.website_requests wr where wr.id = p_request_id) then
    raise exception 'upsert_website_request_mail_message: request % not found', p_request_id;
  end if;

  if p_graph_message_id is not null and v_mailbox <> '' then
    select id into v_existing
    from public.website_request_mail_messages
    where lower(mailbox) = v_mailbox
      and graph_message_id = p_graph_message_id
    limit 1;
  end if;

  if v_existing is null and p_internet_message_id is not null and v_mailbox <> '' then
    select id into v_existing
    from public.website_request_mail_messages
    where lower(mailbox) = v_mailbox
      and lower(internet_message_id) = lower(p_internet_message_id)
    limit 1;
  end if;

  if v_existing is not null then
    update public.website_request_mail_messages set
      conversation_id = coalesce(p_conversation_id, conversation_id),
      conversation_index = coalesce(p_conversation_index, conversation_index),
      in_reply_to = coalesce(p_in_reply_to, in_reply_to),
      references_header = coalesce(p_references_header, references_header),
      sender_address = coalesce(p_sender_address, sender_address),
      recipient_addresses = coalesce(p_recipient_addresses, recipient_addresses),
      subject = coalesce(p_subject, subject),
      body_text = coalesce(p_body_text, body_text),
      occurred_at = coalesce(p_occurred_at, occurred_at),
      is_read = coalesce(p_is_read, is_read),
      graph_message_id = coalesce(graph_message_id, p_graph_message_id),
      internet_message_id = coalesce(internet_message_id, p_internet_message_id)
    where id = v_existing
    returning id into v_id;

    update public.website_requests
    set
      last_message_at = greatest(coalesce(last_message_at, created_at), coalesce(p_occurred_at, now())),
      graph_conversation_id = coalesce(graph_conversation_id, p_conversation_id),
      updated_at = now()
    where id = p_request_id;

    return jsonb_build_object('status', 'already_processed', 'id', v_id);
  end if;

  insert into public.website_request_mail_messages (
    request_id, direction, provider, mailbox,
    graph_message_id, internet_message_id, conversation_id, conversation_index,
    in_reply_to, references_header, sender_address, recipient_addresses,
    subject, body_text, occurred_at, is_read
  ) values (
    p_request_id, p_direction, p_provider, v_mailbox,
    p_graph_message_id, p_internet_message_id, p_conversation_id, p_conversation_index,
    p_in_reply_to, p_references_header, p_sender_address, coalesce(p_recipient_addresses, '{}'),
    p_subject, p_body_text, coalesce(p_occurred_at, now()), coalesce(p_is_read, true)
  )
  returning id into v_id;

  update public.website_requests
  set
    last_message_at = greatest(coalesce(last_message_at, created_at), coalesce(p_occurred_at, now())),
    graph_conversation_id = coalesce(graph_conversation_id, p_conversation_id),
    root_internet_message_id = coalesce(root_internet_message_id, p_internet_message_id),
    root_graph_message_id = coalesce(root_graph_message_id, p_graph_message_id),
    status = case
      when p_direction = 'inbound' and p_provider = 'microsoft_graph' and status in ('new', 'open', 'replied') then 'replied'
      else status
    end,
    updated_at = now()
  where id = p_request_id;

  return jsonb_build_object('status', 'appended', 'id', v_id);
end;
$$;

revoke all on function public.upsert_website_request_mail_message(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text, text, timestamptz, boolean
) from public;
grant execute on function public.upsert_website_request_mail_message(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text, text, timestamptz, boolean
) to service_role;
