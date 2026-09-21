/**
 * Confidence-based correlation of inbound Graph/IMAP messages to an existing
 * website-request (Aanvragen inquiry). Pure functions — no I/O.
 *
 * Hierarchy: exact message id → In-Reply-To → References → unique conversationId.
 * Sender, subject or WR number alone never auto-merge.
 */
export type KnownInquiryMailIdentity = {
  inquiryId: string;
  requestNumber: string | null;
  mailbox: string;
  /** Needed to prove a mailbox-sent message belongs to *this* request. */
  submitterEmail: string | null;
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

/**
 * Discover an unknown request number in mail text.
 *
 * `public.website_requests.number` is generated only by
 * `next_website_request_number()` and constrained to `WR-YYYY-NNNNN`
 * (`website_requests_number_format_check`), which is the one format that
 * exists. The prefix is still matched loosely so a future numbering change
 * cannot make this silently stop recognising real references.
 *
 * Use `textCitesRequestNumber` when the request number is already known: that
 * comparison is format-agnostic and cannot drift away from the generator.
 */
export function extractWebsiteRequestNumberToken(
  ...parts: Array<string | null | undefined>
): string | null {
  for (const part of parts) {
    if (!part) continue;
    const match = part.match(/\b([A-Z]{2,4}-\d{4}-\d{4,6})\b/i);
    if (match?.[1]) return match[1].toUpperCase();
  }
  return null;
}

/**
 * Whether mail text quotes this exact request number.
 *
 * Deliberately a literal comparison against the stored number instead of a
 * regex for a number *shape*: whatever `next_website_request_number()` emits
 * now or later, a customer's own reply keeps matching and a different
 * customer's reply keeps failing.
 */
export function textCitesRequestNumber(
  requestNumber: string | null | undefined,
  ...parts: Array<string | null | undefined>
): boolean {
  const number = requestNumber?.trim();
  if (!number) return false;
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "i");
  return parts.some((part) => (part ? pattern.test(part) : false));
}

/**
 * Deny-by-default identity proof that a mailbox message belongs to one request.
 *
 * Threading evidence (conversationId, RFC ids) is not enough on its own for the
 * shared `info@mccoy.nl` mailbox: every request's mail has the same mailbox as
 * one participant, and a stored conversationId can itself be the result of an
 * earlier mis-attribution — which then keeps re-importing the foreign thread on
 * every detail open. Requiring the request's *own* submitter to be a participant
 * is per-request proof that no shared value can satisfy, and it holds for both
 * directions: the customer's reply is From them, our reply to them is To them.
 */
export function requestSubmitterIsParticipant(
  message: { fromAddress: string | null; toAddresses?: readonly string[] },
  submitterEmail: string | null | undefined,
): boolean {
  const submitter = submitterEmail?.trim().toLowerCase();
  if (!submitter) return false;
  if ((message.fromAddress || "").trim().toLowerCase() === submitter) return true;
  return (message.toAddresses ?? []).some(
    (address) => (address || "").trim().toLowerCase() === submitter,
  );
}

/**
 * Prove an inbound message from an alternate address is still a real reply to
 * this request. This is deliberately stronger than sender matching:
 *
 * - the inbound message replies to one exact RFC Message-ID;
 * - that parent exists in the McCoy mailbox and was sent by the mailbox;
 * - the parent was addressed to the form's stored submitter;
 * - parent and reply share one Graph conversation;
 * - both messages cite this exact request number.
 *
 * This supports aliases/forwarded mail without allowing a quoted WR number to
 * attach arbitrary mail to another customer's inquiry.
 */
export function verifiedReplyParentBelongsToWebsiteRequest(input: {
  mailbox: string;
  submitterEmail: string | null | undefined;
  requestNumber: string | null | undefined;
  inReplyTo: string | null | undefined;
  reply: {
    subject: string | null;
    bodyPreview: string | null;
    conversationId: string | null;
    fromAddress: string | null;
    toAddresses: readonly string[];
  };
  parent: {
    subject: string | null;
    bodyPreview: string | null;
    internetMessageId: string | null;
    conversationId: string | null;
    fromAddress: string | null;
    toAddresses: readonly string[];
  };
}): boolean {
  const mailbox = input.mailbox.trim().toLowerCase();
  const submitter = input.submitterEmail?.trim().toLowerCase();
  const replyFrom = input.reply.fromAddress?.trim().toLowerCase();
  if (!mailbox || !submitter || !replyFrom || replyFrom === mailbox) return false;

  if (!input.reply.toAddresses.some((address) => address.trim().toLowerCase() === mailbox)) {
    return false;
  }
  if (input.parent.fromAddress?.trim().toLowerCase() !== mailbox) return false;
  if (!input.parent.toAddresses.some((address) => address.trim().toLowerCase() === submitter)) {
    return false;
  }

  const replyConversation = input.reply.conversationId?.trim();
  const parentConversation = input.parent.conversationId?.trim();
  if (!replyConversation || replyConversation !== parentConversation) return false;

  const inReplyTo = normaliseInternetMessageId(input.inReplyTo);
  const parentMessageId = normaliseInternetMessageId(input.parent.internetMessageId);
  if (!inReplyTo || inReplyTo !== parentMessageId) return false;

  return (
    textCitesRequestNumber(input.requestNumber, input.reply.subject, input.reply.bodyPreview) &&
    textCitesRequestNumber(input.requestNumber, input.parent.subject, input.parent.bodyPreview)
  );
}

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
    return matches.map((m) => normaliseInternetMessageId(m)).filter((m): m is string => Boolean(m));
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
    ids.map((id) => normaliseInternetMessageId(id) ?? id.trim().toLowerCase()).filter(Boolean),
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
    const hits = scoped.filter((row) => row.conversationIds.some((id) => id === conversationId));
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

  // No WR-number fallback here: the number is quotable by anyone and a list-time
  // candidate carries no RFC headers, so a token match alone cannot prove which
  // inquiry the mail belongs to. Unmatched mail goes to staff review instead.
  return { status: "unmatched" };
}
