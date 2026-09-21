-- Keep one provider message bound to exactly one website request.
--
-- The unique mailbox/provider identifiers already prevent duplicate rows, but
-- the previous RPC updated the caller-supplied request even when the existing
-- message row belonged to another request. That could advance the wrong
-- request's activity timestamp after an application-level correlation error.
-- This replacement makes identity ownership and inactive-request behavior
-- explicit inside the transaction.

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
set search_path = ''
as $$
declare
  v_id uuid;
  v_existing uuid;
  v_existing_request_id uuid;
  v_request_status text;
  v_mailbox text := lower(trim(coalesce(p_mailbox, '')));
begin
  if p_direction not in ('inbound', 'outbound') then
    raise exception 'upsert_website_request_mail_message: invalid direction';
  end if;
  if p_provider not in ('microsoft_graph', 'imap', 'website_form', 'smtp') then
    raise exception 'upsert_website_request_mail_message: invalid provider';
  end if;

  select wr.status
  into v_request_status
  from public.website_requests wr
  where wr.id = p_request_id
  for update;

  if not found then
    raise exception 'upsert_website_request_mail_message: request % not found', p_request_id;
  end if;
  if v_request_status in ('deleted', 'spam') then
    return jsonb_build_object('status', 'ignored', 'reason', 'inactive_request');
  end if;

  if p_graph_message_id is not null and v_mailbox <> '' then
    select id, request_id
    into v_existing, v_existing_request_id
    from public.website_request_mail_messages
    where lower(mailbox) = v_mailbox
      and graph_message_id = p_graph_message_id
    limit 1;
  end if;

  if v_existing is null and p_internet_message_id is not null and v_mailbox <> '' then
    select id, request_id
    into v_existing, v_existing_request_id
    from public.website_request_mail_messages
    where lower(mailbox) = v_mailbox
      and lower(internet_message_id) = lower(p_internet_message_id)
    limit 1;
  end if;

  if v_existing is not null and v_existing_request_id <> p_request_id then
    return jsonb_build_object(
      'status', 'conflict',
      'reason', 'identity_belongs_to_another_request',
      'id', v_existing
    );
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
      body_text = case
        when p_body_text is null then body_text
        when body_text is null or char_length(p_body_text) > char_length(body_text) then p_body_text
        else body_text
      end,
      occurred_at = coalesce(p_occurred_at, occurred_at),
      is_read = coalesce(p_is_read, is_read),
      graph_message_id = coalesce(graph_message_id, p_graph_message_id),
      internet_message_id = coalesce(internet_message_id, p_internet_message_id)
    where id = v_existing
    returning id into v_id;

    update public.website_requests
    set
      last_message_at = greatest(
        coalesce(last_message_at, created_at),
        coalesce(p_occurred_at, now())
      ),
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
    p_in_reply_to, p_references_header, p_sender_address,
    coalesce(p_recipient_addresses, '{}'), p_subject, p_body_text,
    coalesce(p_occurred_at, now()), coalesce(p_is_read, true)
  )
  returning id into v_id;

  update public.website_requests
  set
    last_message_at = greatest(
      coalesce(last_message_at, created_at),
      coalesce(p_occurred_at, now())
    ),
    graph_conversation_id = coalesce(graph_conversation_id, p_conversation_id),
    root_internet_message_id = coalesce(root_internet_message_id, p_internet_message_id),
    root_graph_message_id = coalesce(root_graph_message_id, p_graph_message_id),
    status = case
      when p_direction = 'inbound'
        and p_provider = 'microsoft_graph'
        and status in ('new', 'open', 'replied', 'closed') then 'open'
      when p_direction = 'outbound' and status in ('new', 'open') then 'replied'
      else status
    end,
    updated_at = now()
  where id = p_request_id;

  return jsonb_build_object('status', 'appended', 'id', v_id);
end;
$$;

revoke all on function public.upsert_website_request_mail_message(
  uuid, text, text, text, text, text, text, text, text, text,
  text, text[], text, text, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.upsert_website_request_mail_message(
  uuid, text, text, text, text, text, text, text, text, text,
  text, text[], text, text, timestamptz, boolean
) to service_role;
