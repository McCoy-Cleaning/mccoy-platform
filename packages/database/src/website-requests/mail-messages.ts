/**
 * Durable Aanvragen mail thread identities (website_request_mail_messages).
 * Service-role only writes via RPC.
 */
import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "../supabase";

export type WebsiteRequestMailMessageInput = {
  requestId: string;
  direction: "inbound" | "outbound";
  provider: "microsoft_graph" | "imap" | "website_form" | "smtp";
  mailbox: string;
  graphMessageId?: string | null;
  internetMessageId?: string | null;
  conversationId?: string | null;
  conversationIndex?: string | null;
  inReplyTo?: string | null;
  referencesHeader?: string | null;
  senderAddress?: string | null;
  recipientAddresses?: string[];
  subject?: string | null;
  bodyText?: string | null;
  occurredAt?: string | null;
  isRead?: boolean;
};

export type UpsertMailMessageResult =
  | { status: "appended"; id: string }
  | { status: "already_processed"; id: string };

export type WebsiteRequestMailMessageRow = {
  id: string;
  request_id: string;
  direction: "inbound" | "outbound";
  provider: string;
  mailbox: string;
  graph_message_id: string | null;
  internet_message_id: string | null;
  conversation_id: string | null;
  conversation_index: string | null;
  in_reply_to: string | null;
  references_header: string | null;
  sender_address: string | null;
  recipient_addresses: string[] | null;
  subject: string | null;
  body_text: string | null;
  occurred_at: string;
  is_read: boolean;
  created_at: string;
};

export async function upsertWebsiteRequestMailMessage(
  input: WebsiteRequestMailMessageInput,
): Promise<UpsertMailMessageResult | null> {
  if (!hasSupabaseServiceConfig()) return null;

  const supabase = createSupabaseServiceClient();
  const mailbox = input.mailbox.trim().toLowerCase();
  const { data, error } = await supabase.rpc("upsert_website_request_mail_message", {
    p_request_id: input.requestId,
    p_direction: input.direction,
    p_provider: input.provider,
    p_mailbox: mailbox,
    p_graph_message_id: input.graphMessageId ?? null,
    p_internet_message_id: input.internetMessageId ?? null,
    p_conversation_id: input.conversationId ?? null,
    p_conversation_index: input.conversationIndex ?? null,
    p_in_reply_to: input.inReplyTo ?? null,
    p_references_header: input.referencesHeader ?? null,
    p_sender_address: input.senderAddress ?? null,
    p_recipient_addresses: input.recipientAddresses ?? [],
    p_subject: input.subject ?? null,
    p_body_text: input.bodyText ?? null,
    p_occurred_at: input.occurredAt ?? new Date().toISOString(),
    p_is_read: input.isRead ?? true,
  });

  if (error) {
    console.error("[website-request-mail] upsert failed", {
      code: error.code,
      message: error.message.slice(0, 160),
    });
    return null;
  }

  const row = data as { status?: string; id?: string } | null;
  if (!row?.id || (row.status !== "appended" && row.status !== "already_processed")) {
    return null;
  }
  return { status: row.status, id: row.id };
}

export async function listWebsiteRequestMailMessages(
  requestId: string,
): Promise<WebsiteRequestMailMessageRow[]> {
  if (!hasSupabaseServiceConfig()) return [];

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("website_request_mail_messages")
    .select("*")
    .eq("request_id", requestId)
    .order("occurred_at", { ascending: true });

  if (error) {
    console.error("[website-request-mail] list failed", {
      message: error.message.slice(0, 160),
    });
    return [];
  }

  return (data as WebsiteRequestMailMessageRow[] | null) ?? [];
}

/**
 * Load known message identities for a mailbox to correlate inbound Graph mail.
 */
export async function listKnownMailIdentitiesForMailbox(
  mailbox: string,
  limit = 400,
): Promise<
  Array<{
    inquiryId: string;
    requestNumber: string | null;
    mailbox: string;
    internetMessageIds: string[];
    graphMessageIds: string[];
    conversationIds: string[];
  }>
> {
  if (!hasSupabaseServiceConfig()) return [];

  const supabase = createSupabaseServiceClient();
  const box = mailbox.trim().toLowerCase();

  const { data: messages, error } = await supabase
    .from("website_request_mail_messages")
    .select(
      "request_id, mailbox, graph_message_id, internet_message_id, conversation_id",
    )
    .eq("mailbox", box)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[website-request-mail] identity list failed", {
      message: error.message.slice(0, 160),
    });
    return [];
  }

  const rows = (messages as Array<{
    request_id: string;
    graph_message_id: string | null;
    internet_message_id: string | null;
    conversation_id: string | null;
  }> | null) ?? [];

  const requestIds = [...new Set(rows.map((r) => r.request_id))];
  if (requestIds.length === 0) return [];

  const { data: requests, error: reqError } = await supabase
    .from("website_requests")
    .select("id, number, root_internet_message_id, root_graph_message_id, graph_conversation_id")
    .in("id", requestIds);

  if (reqError) {
    console.error("[website-request-mail] request lookup failed", {
      message: reqError.message.slice(0, 160),
    });
  }

  const requestMeta = new Map(
    ((requests as Array<{
      id: string;
      number: string;
      root_internet_message_id: string | null;
      root_graph_message_id: string | null;
      graph_conversation_id: string | null;
    }> | null) ?? []).map((r) => [r.id, r]),
  );

  const byRequest = new Map<
    string,
    {
      inquiryId: string;
      requestNumber: string | null;
      mailbox: string;
      internetMessageIds: Set<string>;
      graphMessageIds: Set<string>;
      conversationIds: Set<string>;
    }
  >();

  for (const requestId of requestIds) {
    const meta = requestMeta.get(requestId);
    const entry = {
      inquiryId: requestId,
      requestNumber: meta?.number ?? null,
      mailbox: box,
      internetMessageIds: new Set<string>(),
      graphMessageIds: new Set<string>(),
      conversationIds: new Set<string>(),
    };
    if (meta?.root_internet_message_id) {
      entry.internetMessageIds.add(meta.root_internet_message_id);
    }
    if (meta?.root_graph_message_id) {
      entry.graphMessageIds.add(meta.root_graph_message_id);
    }
    if (meta?.graph_conversation_id) {
      entry.conversationIds.add(meta.graph_conversation_id);
    }
    byRequest.set(requestId, entry);
  }

  for (const row of rows) {
    const entry = byRequest.get(row.request_id);
    if (!entry) continue;
    if (row.internet_message_id) entry.internetMessageIds.add(row.internet_message_id);
    if (row.graph_message_id) entry.graphMessageIds.add(row.graph_message_id);
    if (row.conversation_id) entry.conversationIds.add(row.conversation_id);
  }

  return [...byRequest.values()].map((entry) => ({
    inquiryId: entry.inquiryId,
    requestNumber: entry.requestNumber,
    mailbox: entry.mailbox,
    internetMessageIds: [...entry.internetMessageIds],
    graphMessageIds: [...entry.graphMessageIds],
    conversationIds: [...entry.conversationIds],
  }));
}
