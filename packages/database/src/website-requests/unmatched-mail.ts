/**
 * Inbound Aanvragen mail that could not be correlated to exactly one website
 * request (website_request_unmatched_mail). Metadata only — no body text, no
 * attachment bytes: the mailbox keeps the message.
 *
 * Deny-by-default: ingest records here instead of attaching mail to a guessed
 * request. Service-role only writes via RPC.
 */
import { AdminAuthError } from "@mccoy/security";

import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "../supabase";
import { clampQueryLimit, sanitizePostgrestSearchTerm } from "../postgrest-search";

export type UnmatchedInboundMailInput = {
  mailbox: string;
  provider?: "microsoft_graph" | "imap";
  graphMessageId?: string | null;
  internetMessageId?: string | null;
  conversationId?: string | null;
  senderAddress?: string | null;
  subject?: string | null;
  reason: "unmatched" | "ambiguous";
  /** Only for `ambiguous`: the requests the message could not be told apart from. */
  candidateRequestIds?: string[];
  receivedAt?: string | null;
};

export type RecordUnmatchedInboundMailResult =
  { status: "recorded"; id: string } | { status: "already_recorded"; id: string };

export async function recordUnmatchedInboundMail(
  input: UnmatchedInboundMailInput,
): Promise<RecordUnmatchedInboundMailResult | null> {
  if (!hasSupabaseServiceConfig()) return null;

  const mailbox = input.mailbox.trim().toLowerCase();
  const graphMessageId = input.graphMessageId?.trim() || null;
  const internetMessageId = input.internetMessageId?.trim() || null;
  if (!mailbox || (!graphMessageId && !internetMessageId)) return null;

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.rpc("record_unmatched_inbound_mail", {
    p_mailbox: mailbox,
    p_provider: input.provider ?? "microsoft_graph",
    p_graph_message_id: graphMessageId,
    p_internet_message_id: internetMessageId,
    p_conversation_id: input.conversationId?.trim() || null,
    p_sender_address: input.senderAddress?.trim().toLowerCase() || null,
    p_subject: input.subject?.trim().slice(0, 500) || null,
    p_reason: input.reason,
    p_candidate_request_ids: input.candidateRequestIds ?? [],
    p_received_at: input.receivedAt ?? new Date().toISOString(),
  });

  if (error) {
    console.error("[website-request-unmatched-mail] record failed", {
      code: error.code,
      message: error.message.slice(0, 160),
    });
    return null;
  }

  const row = data as { status?: string; id?: string } | null;
  if (!row?.id || (row.status !== "recorded" && row.status !== "already_recorded")) {
    return null;
  }
  return { status: row.status, id: row.id };
}

/** Mark a previously unmatched message resolved after stronger evidence links it. */
export async function resolveUnmatchedInboundMail(input: {
  mailbox: string;
  graphMessageId?: string | null;
  internetMessageId?: string | null;
  requestId?: string | null;
}): Promise<number> {
  if (!hasSupabaseServiceConfig()) return 0;
  const mailbox = input.mailbox.trim().toLowerCase();
  const graphMessageId = input.graphMessageId?.trim() || null;
  const internetMessageId = input.internetMessageId?.trim() || null;
  const requestId = input.requestId?.trim() || null;
  if (!mailbox || (!graphMessageId && !internetMessageId)) return 0;

  const supabase = createSupabaseServiceClient();
  const resolvedAt = new Date().toISOString();
  const resolvedIds = new Set<string>();

  if (graphMessageId) {
    const { data, error } = await supabase
      .from("website_request_unmatched_mail")
      .update({ resolved_at: resolvedAt, resolved_request_id: requestId })
      .eq("mailbox", mailbox)
      .eq("graph_message_id", graphMessageId)
      .is("resolved_at", null)
      .select("id");
    if (error) {
      console.error("[website-request-unmatched-mail] resolve by Graph id failed", {
        code: error.code,
        message: error.message.slice(0, 160),
      });
    } else {
      for (const row of (data as Array<{ id: string }> | null) ?? []) resolvedIds.add(row.id);
    }
  }

  if (internetMessageId) {
    const { data, error } = await supabase
      .from("website_request_unmatched_mail")
      .update({ resolved_at: resolvedAt, resolved_request_id: requestId })
      .eq("mailbox", mailbox)
      .eq("internet_message_id", internetMessageId)
      .is("resolved_at", null)
      .select("id");
    if (error) {
      console.error("[website-request-unmatched-mail] resolve by RFC id failed", {
        code: error.code,
        message: error.message.slice(0, 160),
      });
    } else {
      for (const row of (data as Array<{ id: string }> | null) ?? []) resolvedIds.add(row.id);
    }
  }

  return resolvedIds.size;
}

/* -------------------------------------------------------------------------- */
/* Staff review queue (read-only)                                             */
/* -------------------------------------------------------------------------- */

export type UnmatchedInboundMailReason = "unmatched" | "ambiguous";
export type UnmatchedInboundMailStatusFilter = "open" | "resolved" | "all";

/** Who is asking. Only trusted server code may claim "staff". */
export type UnmatchedMailActorKind = "staff" | "customer" | "anonymous";

export type UnmatchedInboundMailCandidate = {
  requestId: string;
  /** Human-readable WR number when the request still exists. */
  number: string | null;
};

/**
 * Triage metadata for one unattributable message. Deliberately excludes body
 * text and attachments (never stored) and provider message ids (not needed to
 * find the message in the mailbox by sender + subject + time).
 */
export type UnmatchedInboundMailItem = {
  id: string;
  mailbox: string;
  provider: "microsoft_graph" | "imap";
  senderAddress: string | null;
  subject: string | null;
  reason: UnmatchedInboundMailReason;
  candidates: UnmatchedInboundMailCandidate[];
  receivedAt: string;
  resolvedAt: string | null;
};

export type ListUnmatchedInboundMailQuery = {
  q?: string;
  reason?: UnmatchedInboundMailReason | "all";
  mailbox?: string;
  status?: UnmatchedInboundMailStatusFilter;
  page?: number;
  pageSize?: number;
};

export type UnmatchedInboundMailPage = {
  items: UnmatchedInboundMailItem[];
  total: number;
  page: number;
  pageSize: number;
  /** Unresolved entries regardless of the active filters — drives the nav badge. */
  openCount: number;
  /** Mailboxes present in the queue, for the mailbox filter. */
  mailboxes: string[];
};

const UNMATCHED_MAIL_DEFAULT_PAGE_SIZE = 25;
const UNMATCHED_MAIL_MAX_PAGE_SIZE = 100;
/** Bounded scan for the mailbox filter options — the queue should stay small. */
const UNMATCHED_MAIL_FACET_SCAN_LIMIT = 500;
const MAILBOX_FILTER_PATTERN = /^[a-z0-9][a-z0-9._%+@-]{0,319}$/;

const UNMATCHED_MAIL_COLUMNS =
  "id, mailbox, provider, sender_address, subject, reason, candidate_request_ids, received_at, resolved_at";

type UnmatchedMailDbRow = {
  id: string;
  mailbox: string;
  provider: string;
  sender_address: string | null;
  subject: string | null;
  reason: string;
  candidate_request_ids: string[] | null;
  received_at: string;
  resolved_at: string | null;
};

/**
 * Deny by default. The table's RLS already limits select to active staff; this
 * is the equivalent gate for the service-role read path used by admin server
 * functions, so a future non-staff caller cannot reach the queue.
 */
export function assertUnmatchedMailStaffAccess(kind: UnmatchedMailActorKind): void {
  if (kind !== "staff") {
    throw new AdminAuthError("Niet geautoriseerd.");
  }
}

function emptyUnmatchedMailPage(page: number, pageSize: number): UnmatchedInboundMailPage {
  return { items: [], total: 0, page, pageSize, openCount: 0, mailboxes: [] };
}

function normalizeMailboxFilter(raw: string | undefined): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value || value === "all") return null;
  return MAILBOX_FILTER_PATTERN.test(value) ? value : null;
}

function mapUnmatchedMailRow(
  row: UnmatchedMailDbRow,
  numbers: Map<string, string>,
): UnmatchedInboundMailItem {
  return {
    id: row.id,
    mailbox: row.mailbox,
    provider: row.provider === "imap" ? "imap" : "microsoft_graph",
    senderAddress: row.sender_address,
    subject: row.subject,
    reason: row.reason === "ambiguous" ? "ambiguous" : "unmatched",
    candidates: (row.candidate_request_ids ?? []).map((requestId) => ({
      requestId,
      number: numbers.get(requestId) ?? null,
    })),
    receivedAt: row.received_at,
    resolvedAt: row.resolved_at,
  };
}

/**
 * Staff review queue for inbound mail that could not be attributed to exactly
 * one website request. Read-only: linking a message to a request is the exact
 * operation that leaked customer mail and is deliberately not offered here.
 */
export async function listUnmatchedInboundMail(
  query: ListUnmatchedInboundMailQuery,
  actor: UnmatchedMailActorKind,
): Promise<UnmatchedInboundMailPage> {
  assertUnmatchedMailStaffAccess(actor);

  const pageSize = clampQueryLimit(
    query.pageSize,
    UNMATCHED_MAIL_DEFAULT_PAGE_SIZE,
    UNMATCHED_MAIL_MAX_PAGE_SIZE,
  );
  const page = Math.max(1, Math.trunc(query.page ?? 1));

  // No Supabase project configured (local JSON-store / E2E): nothing is ingested,
  // so an empty healthy queue is the truthful answer.
  if (!hasSupabaseServiceConfig()) return emptyUnmatchedMailPage(page, pageSize);

  const supabase = createSupabaseServiceClient();
  const status: UnmatchedInboundMailStatusFilter = query.status ?? "open";
  const mailbox = normalizeMailboxFilter(query.mailbox);
  const reason = query.reason === "unmatched" || query.reason === "ambiguous" ? query.reason : null;
  const term = sanitizePostgrestSearchTerm(query.q ?? "");

  let rows = supabase
    .from("website_request_unmatched_mail")
    .select(UNMATCHED_MAIL_COLUMNS, { count: "exact" });

  if (status === "open") rows = rows.is("resolved_at", null);
  if (status === "resolved") rows = rows.not("resolved_at", "is", null);
  if (reason) rows = rows.eq("reason", reason);
  if (mailbox) rows = rows.eq("mailbox", mailbox);
  if (term) rows = rows.or(`sender_address.ilike.%${term}%,subject.ilike.%${term}%`);

  const from = (page - 1) * pageSize;
  const { data, error, count } = await rows
    .order("received_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) {
    console.error("[website-request-unmatched-mail] list failed", {
      code: error.code,
      message: error.message.slice(0, 160),
    });
    throw new Error("unmatched_mail_list_failed");
  }

  const dbRows = (data as UnmatchedMailDbRow[] | null) ?? [];

  const candidateIds = [...new Set(dbRows.flatMap((row) => row.candidate_request_ids ?? []))].slice(
    0,
    200,
  );
  const numbers = new Map<string, string>();
  if (candidateIds.length > 0) {
    const { data: requests, error: requestError } = await supabase
      .from("website_requests")
      .select("id, number")
      .in("id", candidateIds);
    if (requestError) {
      // Non-fatal: candidate ids still identify the requests for staff.
      console.error("[website-request-unmatched-mail] candidate lookup failed", {
        message: requestError.message.slice(0, 160),
      });
    }
    for (const request of (requests as Array<{ id: string; number: string }> | null) ?? []) {
      numbers.set(request.id, request.number);
    }
  }

  const [openCount, mailboxes] = await Promise.all([
    countOpenUnmatchedInboundMail(actor),
    listUnmatchedInboundMailboxes(actor),
  ]);

  return {
    items: dbRows.map((row) => mapUnmatchedMailRow(row, numbers)),
    total: count ?? dbRows.length,
    page,
    pageSize,
    openCount,
    mailboxes,
  };
}

/** Unresolved entries — nav badge and "healthy queue" messaging. */
export async function countOpenUnmatchedInboundMail(
  actor: UnmatchedMailActorKind,
): Promise<number> {
  assertUnmatchedMailStaffAccess(actor);
  if (!hasSupabaseServiceConfig()) return 0;

  const supabase = createSupabaseServiceClient();
  const { count, error } = await supabase
    .from("website_request_unmatched_mail")
    .select("id", { count: "exact", head: true })
    .is("resolved_at", null);

  if (error) {
    console.error("[website-request-unmatched-mail] open count failed", {
      message: error.message.slice(0, 160),
    });
    return 0;
  }
  return count ?? 0;
}

async function listUnmatchedInboundMailboxes(actor: UnmatchedMailActorKind): Promise<string[]> {
  assertUnmatchedMailStaffAccess(actor);
  if (!hasSupabaseServiceConfig()) return [];

  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("website_request_unmatched_mail")
    .select("mailbox")
    .order("received_at", { ascending: false })
    .limit(UNMATCHED_MAIL_FACET_SCAN_LIMIT);

  if (error) {
    console.error("[website-request-unmatched-mail] mailbox facet failed", {
      message: error.message.slice(0, 160),
    });
    return [];
  }

  const seen = new Set<string>();
  for (const row of (data as Array<{ mailbox: string }> | null) ?? []) {
    const value = row.mailbox?.trim().toLowerCase();
    if (value) seen.add(value);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}
