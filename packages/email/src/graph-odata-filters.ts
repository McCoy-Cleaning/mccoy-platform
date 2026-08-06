/**
 * Pure Graph OData helpers for message list queries.
 * Kept separate so InefficientFilter ordering rules stay unit-tested.
 */

/** Escape a single-quoted OData string literal. */
export function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Build $filter for conversation messages when also using
 * `$orderby=receivedDateTime …`.
 *
 * Microsoft Graph requires: properties in $orderby must appear in $filter
 * first, in the same order, before other predicates — otherwise InefficientFilter.
 */
export function buildConversationReceivedFilter(
  conversationId: string,
  receivedSinceIso = "1970-01-01T00:00:00Z",
): string {
  return (
    `receivedDateTime ge ${receivedSinceIso}` +
    ` and conversationId eq '${escapeODataString(conversationId)}'`
  );
}

/**
 * Build $filter for Sent Items when also using `$orderby=sentDateTime …`.
 */
export function buildConversationSentFilter(
  conversationId: string,
  sentSinceIso: string,
): string {
  return (
    `sentDateTime ge ${sentSinceIso}` +
    ` and conversationId eq '${escapeODataString(conversationId)}'`
  );
}

/**
 * Decide whether a recent mailbox message belongs to an open Aanvraag during
 * detail sync. Conversation id is preferred; otherwise require reply-shaped
 * subject + (WR number or original subject overlap) + sender is submitter or
 * McCoy mailbox. Never matches on WR/subject alone from an unrelated sender.
 */
export function messageBelongsToWebsiteRequest(input: {
  conversationId: string | null;
  knownConversationIds: ReadonlySet<string>;
  subject: string | null;
  bodyPreview: string | null;
  fromAddress: string | null;
  submitterEmail: string | null;
  mailbox: string;
  requestNumber: string;
  /** Original inquiry subject without needing the WR suffix. */
  requestSubject?: string | null;
  isReplyOrForward: boolean;
  isMcCoySender: boolean;
}): boolean {
  const conversationId = input.conversationId?.trim();
  if (conversationId && input.knownConversationIds.has(conversationId)) {
    return true;
  }

  if (!input.isReplyOrForward) return false;

  const from = (input.fromAddress || "").trim().toLowerCase();
  if (!from) return false;

  const submitter = (input.submitterEmail || "").trim().toLowerCase();
  const mailbox = input.mailbox.trim().toLowerCase();
  const senderOk =
    (submitter && from === submitter) ||
    (mailbox && from === mailbox) ||
    input.isMcCoySender;
  if (!senderOk) return false;

  const wr =
    (input.subject || "").match(/\b(WR-[A-Z0-9-]+)\b/i)?.[1] ??
    (input.bodyPreview || "").match(/\b(WR-[A-Z0-9-]+)\b/i)?.[1];
  if (wr && wr.toUpperCase() === input.requestNumber.trim().toUpperCase()) {
    return true;
  }

  const requestSubject = (input.requestSubject || "")
    .replace(/\s*\(WR-[A-Z0-9-]+\)\s*$/i, "")
    .trim()
    .toLowerCase();
  if (requestSubject.length >= 10) {
    const hay = `${input.subject || ""} ${input.bodyPreview || ""}`.toLowerCase();
    const needle = requestSubject.slice(0, 48);
    if (hay.includes(needle)) return true;
  }

  return false;
}
