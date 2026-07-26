/**
 * Graph/IMAP dedupe guard (Stage C).
 *
 * Inbound form mail is already represented in-app via `website_request.received`,
 * enqueued atomically with the request row (create_website_request_with_notification
 * RPC, see supabase/migrations/20260725121000_website_requests.sql). A separate
 * mailbox-arrival notification must never fire for mail that correlates to an
 * existing website request — that would double-notify staff for one submission.
 *
 * `mail.received:{internetMessageId}` is reserved here as the dedupe key for a
 * future mailbox-watch notification. No such notification type is registered or
 * emitted today (see docs/architecture/platform-notification-system.md) — adding
 * one is a product/UX decision (new staff-facing notification surface) left for
 * a follow-up, not invented here. This module only computes whether emitting one
 * would ever be safe, so a future watcher cannot accidentally double-notify.
 */
import { listWebsiteRequests } from "@mccoy/database/server";

import { extractRequestNumber } from "./classify-form-email";

export type MailCorrelationResult =
  | { correlated: true; requestId: string; requestNumber: string }
  | { correlated: false; dedupeKey: string | null };

/**
 * Correlate an inbox message to an existing `website_requests` row by request
 * number (a `WR-YYYY-NNNNN` token in the subject or body). Returns
 * `correlated: false` with the `mail.received:{internetMessageId}` dedupe key
 * only when no existing request matches. Callers must never enqueue a
 * mailbox-arrival notification when `correlated` is true.
 */
export async function correlateInboundMailToWebsiteRequest(params: {
  internetMessageId: string | null;
  subject?: string | null;
  textBody?: string | null;
}): Promise<MailCorrelationResult> {
  const dedupeKey = params.internetMessageId ? `mail.received:${params.internetMessageId}` : null;

  const requestNumber = extractRequestNumber(params.subject, params.textBody);
  if (!requestNumber) {
    return { correlated: false, dedupeKey };
  }

  try {
    const matches = await listWebsiteRequests({ q: requestNumber });
    const match = matches.find((r) => r.number.toUpperCase() === requestNumber.toUpperCase());
    if (match) {
      return { correlated: true, requestId: match.id, requestNumber: match.number };
    }
  } catch (error) {
    // Store unavailable — fail closed on correlation (never throw from a dedupe guard).
    console.error("[mail-received-correlation] lookup failed", error);
  }

  return { correlated: false, dedupeKey };
}
