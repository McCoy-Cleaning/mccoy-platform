import type { FormInboxMessageSummary } from "@mccoy/email/contracts";
import { decodeInboxMessageId } from "@mccoy/email/contracts";

/**
 * Request-backed inbox ids carry the durable website_requests id. Mailbox-only
 * rows keep their provider read state and are intentionally excluded.
 */
export function websiteRequestIdFromInboxId(id: string): string | null {
  try {
    const decoded = decodeInboxMessageId(id);
    return decoded.provider === "request" || decoded.provider === "e2e" ? decoded.requestId : null;
  } catch {
    return null;
  }
}

export function websiteRequestIdsFromInboxItems(items: FormInboxMessageSummary[]): string[] {
  return [
    ...new Set(
      items
        .map((item) => websiteRequestIdFromInboxId(item.id))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

/**
 * For persisted requests, unread is per staff recipient and comes from the
 * notification system. Request lifecycle (new/open/replied/closed) is a
 * separate workflow state and must never recreate a read indicator.
 */
export function applyRequestNotificationUnreadState(
  items: FormInboxMessageSummary[],
  unreadRequestIds: ReadonlySet<string>,
): FormInboxMessageSummary[] {
  return items.map((item) => {
    const requestId = websiteRequestIdFromInboxId(item.id);
    return requestId ? { ...item, unread: unreadRequestIds.has(requestId) } : item;
  });
}
