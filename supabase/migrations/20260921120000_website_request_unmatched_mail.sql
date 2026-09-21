-- Deny-by-default landing place for inbound Aanvragen mail that cannot be
-- attributed to exactly one website request.
--
-- Before this table, ingest silently dropped unmatched replies while a loose
-- subject heuristic attached mail to an arbitrary request, which leaked one
-- customer's message, address and attachment into another customer's thread.
-- Correlation is now strict (per-request WR number + submitter, known RFC
-- Message-ID, or an already-correlated conversationId); anything weaker lands
-- here for staff follow-up instead of being guessed onto a request.
--
-- Deliberately metadata only: NO body text and NO attachment bytes are copied.
-- The message itself stays in the mailbox, which remains the source of truth.
--
-- Writes: service_role only via record_unmatched_inbound_mail (trusted server).
-- Reads: active staff, same rule as website_request_mail_messages.

create table if not exists public.website_request_unmatched_mail (
  id uuid primary key default gen_random_uuid(),

  mailbox text not null,
  provider text not null default 'microsoft_graph'
    check (provider in ('microsoft_graph', 'imap')),

  graph_message_id text,
  internet_message_id text,
  conversation_id text,

  sender_address text,
  subject text,

  reason text not null
    check (reason in ('unmatched', 'ambiguous')),
  -- Requests the message could not be told apart from, when reason = 'ambiguous'.
  candidate_request_ids uuid[] not null default '{}',

  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  resolved_at timestamptz,
  resolved_request_id uuid
    references public.website_requests (id)
    on delete set null,

  constraint website_request_unmatched_mail_mailbox_len_check
    check (char_length(mailbox) between 1 and 320),
  constraint website_request_unmatched_mail_graph_id_len_check
    check (graph_message_id is null or char_length(graph_message_id) between 1 and 512),
  constraint website_request_unmatched_mail_internet_id_len_check
    check (internet_message_id is null or char_length(internet_message_id) between 1 and 998),
  constraint website_request_unmatched_mail_subject_len_check
    check (subject is null or char_length(subject) <= 500),
  constraint website_request_unmatched_mail_identity_check
    check (graph_message_id is not null or internet_message_id is not null)
);

comment on table public.website_request_unmatched_mail is
  'Inbound mailbox messages that could not be correlated to exactly one website request. Metadata only (no body, no attachments) — the mailbox keeps the message.';

create unique index if not exists website_request_unmatched_mail_graph_uq
  on public.website_request_unmatched_mail (lower(mailbox), graph_message_id)
  where graph_message_id is not null;

create unique index if not exists website_request_unmatched_mail_internet_uq
  on public.website_request_unmatched_mail (lower(mailbox), lower(internet_message_id))
  where graph_message_id is null and internet_message_id is not null;

create index if not exists website_request_unmatched_mail_open_idx
  on public.website_request_unmatched_mail (received_at desc)
  where resolved_at is null;

alter table public.website_request_unmatched_mail enable row level security;
alter table public.website_request_unmatched_mail force row level security;

drop policy if exists website_request_unmatched_mail_select_staff
  on public.website_request_unmatched_mail;
create policy website_request_unmatched_mail_select_staff
  on public.website_request_unmatched_mail
  for select
  to authenticated
  using (private.current_user_is_active_staff());

revoke all on table public.website_request_unmatched_mail from public;
revoke all on table public.website_request_unmatched_mail from anon;
revoke all on table public.website_request_unmatched_mail from authenticated;
grant select on table public.website_request_unmatched_mail to authenticated;
grant select, insert, update, delete on table public.website_request_unmatched_mail to service_role;

-- Idempotent record of an unmatched inbound message (service_role).
-- Repeated mailbox scans must not create duplicate review entries.
create or replace function public.record_unmatched_inbound_mail(
  p_mailbox text,
  p_provider text,
  p_graph_message_id text,
  p_internet_message_id text,
  p_conversation_id text,
  p_sender_address text,
  p_subject text,
  p_reason text,
  p_candidate_request_ids uuid[],
  p_received_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_mailbox text := lower(trim(coalesce(p_mailbox, '')));
  v_provider text := coalesce(nullif(trim(p_provider), ''), 'microsoft_graph');
  v_graph_id text := nullif(trim(coalesce(p_graph_message_id, '')), '');
  v_internet_id text := nullif(trim(coalesce(p_internet_message_id, '')), '');
begin
  if v_mailbox = '' then
    raise exception 'record_unmatched_inbound_mail: mailbox is required';
  end if;
  if p_reason not in ('unmatched', 'ambiguous') then
    raise exception 'record_unmatched_inbound_mail: invalid reason';
  end if;
  if v_graph_id is null and v_internet_id is null then
    raise exception 'record_unmatched_inbound_mail: message identity is required';
  end if;

  if v_graph_id is not null then
    select id into v_id
    from public.website_request_unmatched_mail
    where lower(mailbox) = v_mailbox
      and graph_message_id = v_graph_id
    limit 1;
  else
    select id into v_id
    from public.website_request_unmatched_mail
    where lower(mailbox) = v_mailbox
      and graph_message_id is null
      and lower(internet_message_id) = lower(v_internet_id)
    limit 1;
  end if;

  if v_id is not null then
    update public.website_request_unmatched_mail set
      reason = p_reason,
      candidate_request_ids = coalesce(p_candidate_request_ids, '{}'),
      conversation_id = coalesce(p_conversation_id, conversation_id),
      internet_message_id = coalesce(internet_message_id, v_internet_id),
      updated_at = now()
    where id = v_id;
    return jsonb_build_object('status', 'already_recorded', 'id', v_id);
  end if;

  insert into public.website_request_unmatched_mail (
    mailbox, provider, graph_message_id, internet_message_id, conversation_id,
    sender_address, subject, reason, candidate_request_ids, received_at
  ) values (
    v_mailbox, v_provider, v_graph_id, v_internet_id, p_conversation_id,
    p_sender_address, p_subject, p_reason, coalesce(p_candidate_request_ids, '{}'),
    coalesce(p_received_at, now())
  )
  returning id into v_id;

  return jsonb_build_object('status', 'recorded', 'id', v_id);
end;
$$;

revoke all on function public.record_unmatched_inbound_mail(
  text, text, text, text, text, text, text, text, uuid[], timestamptz
) from public;
grant execute on function public.record_unmatched_inbound_mail(
  text, text, text, text, text, text, text, text, uuid[], timestamptz
) to service_role;
