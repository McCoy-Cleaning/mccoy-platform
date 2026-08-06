/**
 * Confidence-based correlation of inbound Graph/IMAP messages to an existing
 * website-request (Aanvragen inquiry). Pure functions — no I/O.
 *
 * Hierarchy: exact message id → In-Reply-To → References → unique conversationId.
 * Sender + subject alone never auto-merge.
 */
export type KnownInquiryMailIdentity = {
  inquiryId: string;
  requestNumber: string | null;
  mailbox: string;
  internetMessageIds: string[];
  graphMessageIds: string[];
  conversationIds: string[];
};

export type InboundMailCandidate = {
  mailbox: string;
  graphMessageId: string | null;
  internetMessageId: string | null;
  conversationId: string | null;
  inReplyTo: string | null;
  references: string[];
  subject: string;
  fromAddress: string | null;
};

export type CorrelateInboundResult =
  | {
      status: "already_processed";
      inquiryId: string;
      match: "graph_message_id" | "internet_message_id";
    }
  | {
      status: "appended";
      inquiryId: string;
      match: "in_reply_to" | "references" | "conversation_id";
    }
  | {
      status: "ambiguous";
      inquiryIds: string[];
      match: "conversation_id";
    }
  | { status: "unmatched" };

/** Normalise RFC Message-ID for comparison (trim, angle brackets optional). */
export function normaliseInternetMessageId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const inner = trimmed.replace(/^<|>$/g, "").trim().toLowerCase();
  if (!inner) return null;
  return `<${inner}>`;
}

export function parseReferencesHeader(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  const matches = raw.match(/<[^>]+>/g);
  if (matches?.length) {
    return matches
      .map((m) => normaliseInternetMessageId(m))
      .filter((m): m is string => Boolean(m));
  }
  return raw
    .split(/\s+/)
    .map((part) => normaliseInternetMessageId(part))
    .filter((m): m is string => Boolean(m));
}

function mailboxKey(value: string): string {
  return value.trim().toLowerCase();
}

function idSet(ids: string[]): Set<string> {
  return new Set(
    ids
      .map((id) => normaliseInternetMessageId(id) ?? id.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function correlateInboundGraphMessage(
  candidate: InboundMailCandidate,
  known: KnownInquiryMailIdentity[],
): CorrelateInboundResult {
  const mailbox = mailboxKey(candidate.mailbox);
  const scoped = known.filter((row) => mailboxKey(row.mailbox) === mailbox);
  if (scoped.length === 0) return { status: "unmatched" };

  const graphId = candidate.graphMessageId?.trim() || null;
  if (graphId) {
    for (const row of scoped) {
      if (row.graphMessageIds.some((id) => id === graphId)) {
        return {
          status: "already_processed",
          inquiryId: row.inquiryId,
          match: "graph_message_id",
        };
      }
    }
  }

  const internetId = normaliseInternetMessageId(candidate.internetMessageId);
  if (internetId) {
    for (const row of scoped) {
      if (idSet(row.internetMessageIds).has(internetId)) {
        return {
          status: "already_processed",
          inquiryId: row.inquiryId,
          match: "internet_message_id",
        };
      }
    }
  }

  const inReplyTo = normaliseInternetMessageId(candidate.inReplyTo);
  if (inReplyTo) {
    for (const row of scoped) {
      if (idSet(row.internetMessageIds).has(inReplyTo)) {
        return { status: "appended", inquiryId: row.inquiryId, match: "in_reply_to" };
      }
    }
  }

  for (const ref of candidate.references) {
    const normalised = normaliseInternetMessageId(ref);
    if (!normalised) continue;
    for (const row of scoped) {
      if (idSet(row.internetMessageIds).has(normalised)) {
        return { status: "appended", inquiryId: row.inquiryId, match: "references" };
      }
    }
  }

  const conversationId = candidate.conversationId?.trim() || null;
  if (conversationId) {
    const hits = scoped.filter((row) =>
      row.conversationIds.some((id) => id === conversationId),
    );
    if (hits.length === 1) {
      return {
        status: "appended",
        inquiryId: hits[0]!.inquiryId,
        match: "conversation_id",
      };
    }
    if (hits.length > 1) {
      return {
        status: "ambiguous",
        inquiryIds: hits.map((h) => h.inquiryId),
        match: "conversation_id",
      };
    }
  }

  return { status: "unmatched" };
}
