/**
 * Pure Graph OData helpers for message list queries.
 * Kept separate so InefficientFilter ordering rules stay unit-tested.
 */
import { normaliseInternetMessageId, textCitesRequestNumber } from "./inquiry-thread-correlation";

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
export function buildConversationSentFilter(conversationId: string, sentSinceIso: string): string {
  return (
    `sentDateTime ge ${sentSinceIso}` +
    ` and conversationId eq '${escapeODataString(conversationId)}'`
  );
}

/**
 * Date-window $filter for locating a form notification without `$search`.
 * `receivedDateTime` leads so `$orderby=receivedDateTime` stays legal.
 */
export function buildReceivedDateWindowFilter(fromIso: string, toIso?: string): string {
  if (toIso) {
    return `receivedDateTime ge ${fromIso} and receivedDateTime le ${toIso}`;
  }
  return `receivedDateTime ge ${fromIso}`;
}

/**
 * Targeted mailbox lookup for replies from one inquiry submitter.
 *
 * `receivedDateTime` leads so callers may add `$orderby=receivedDateTime desc`
 * without triggering Graph's `InefficientFilter`. The nested `from` predicate
 * is supported by the Microsoft Graph messages collection.
 */
export function buildSenderReceivedFilter(senderAddress: string, receivedSinceIso: string): string {
  return (
    `receivedDateTime ge ${receivedSinceIso}` +
    ` and from/emailAddress/address eq '${escapeODataString(senderAddress.trim())}'`
  );
}

/**
 * Why a recent mailbox message provably belongs to one specific Aanvraag.
 * Every variant is tied to a per-request unique value; there is deliberately no
 * variant for "subject looks like this inquiry".
 */
export type WebsiteRequestMailEvidence = "conversation_id" | "known_message_id" | "request_number";

/**
 * Decide whether a recent mailbox message belongs to an open Aanvraag during
 * detail sync. Returns the evidence used, or `null` when membership cannot be
 * proven — callers must then leave the message alone.
 *
 * `website_requests.subject` is the shared form-kind subject ("Offerte
 * meubelreiniging") for every request of that kind, so subject overlap can never
 * be evidence: it matched other customers' threads and leaked their mail into
 * unrelated inquiries. Only the per-request number, a known RFC Message-ID of
 * this thread, or an already-correlated conversationId may match.
 *
 * Threading evidence is necessary but not sufficient — `requestSubmitterIsParticipant`
 * is the second gate applied before anything is persisted.
 */
export function websiteRequestMailEvidence(input: {
  conversationId: string | null;
  knownConversationIds: ReadonlySet<string>;
  /** Normalised RFC Message-IDs already correlated to this request. */
  knownMessageIds: ReadonlySet<string>;
  inReplyTo?: string | null;
  references?: readonly string[];
  subject: string | null;
  bodyPreview: string | null;
  fromAddress: string | null;
  submitterEmail: string | null;
  mailbox: string;
  requestNumber: string;
  isReplyOrForward: boolean;
  isMcCoySender: boolean;
}): WebsiteRequestMailEvidence | null {
  const conversationId = input.conversationId?.trim();
  if (conversationId && input.knownConversationIds.has(conversationId)) {
    return "conversation_id";
  }

  for (const candidate of [input.inReplyTo, ...(input.references ?? [])]) {
    const normalised = normaliseInternetMessageId(candidate);
    if (normalised && input.knownMessageIds.has(normalised)) {
      return "known_message_id";
    }
  }

  if (!input.isReplyOrForward) return null;

  const from = (input.fromAddress || "").trim().toLowerCase();
  if (!from) return null;

  const submitter = (input.submitterEmail || "").trim().toLowerCase();
  const mailbox = input.mailbox.trim().toLowerCase();
  const senderOk =
    (submitter && from === submitter) || (mailbox && from === mailbox) || input.isMcCoySender;
  if (!senderOk) return null;

  if (textCitesRequestNumber(input.requestNumber, input.subject, input.bodyPreview)) {
    return "request_number";
  }

  return null;
}
