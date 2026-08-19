import type { FormInboxThreadItem } from "@mccoy/email/contracts";

function fingerprintBody(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True when optimistic plain text matches a server admin bubble (possibly templated). */
function adminBodiesMatch(a: string, b: string): boolean {
  const na = fingerprintBody(a);
  const nb = fingerprintBody(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length < 4) return false;
  return longer.includes(shorter);
}

function sameRfcMessageId(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const left = (a || "").replace(/[<>\s]/g, "").toLowerCase();
  const right = (b || "").replace(/[<>\s]/g, "").toLowerCase();
  return Boolean(left && right && left === right);
}

function timestampsWithinMinutes(aIso: string, bIso: string, minutes: number): boolean {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) <= minutes * 60 * 1000;
}

function isLocalReplyId(id: string): boolean {
  return id.startsWith("local-reply:");
}

function isGraphThreadId(id: string): boolean {
  return id.startsWith("graph:");
}

function attachmentCount(item: FormInboxThreadItem): number {
  return item.attachments?.length ?? 0;
}

/** Same bubble across hydrate id rewrite (`req:…:mail:` → `graph:`). */
function threadItemsMatch(a: FormInboxThreadItem, b: FormInboxThreadItem): boolean {
  if (a.id === b.id) return true;
  if (sameRfcMessageId(a.messageId, b.messageId)) return true;
  if (a.direction !== b.direction) return false;
  if (a.direction === "form") return false;
  const fa = fingerprintBody(a.textBody);
  const fb = fingerprintBody(b.textBody);
  if (!fa || !fb || fa !== fb) return false;
  return timestampsWithinMinutes(a.date, b.date, 3);
}

function preferRicherThreadItem(
  a: FormInboxThreadItem,
  b: FormInboxThreadItem,
): FormInboxThreadItem {
  const aAtt = attachmentCount(a);
  const bAtt = attachmentCount(b);
  if (bAtt !== aAtt) return bAtt > aAtt ? b : a;
  if (isGraphThreadId(b.id) && !isGraphThreadId(a.id)) return b;
  if (isGraphThreadId(a.id) && !isGraphThreadId(b.id)) return a;
  return a;
}

function collapseDuplicateThreadItems(items: FormInboxThreadItem[]): FormInboxThreadItem[] {
  const kept: FormInboxThreadItem[] = [];
  for (const item of items) {
    if (item.direction === "form" || isLocalReplyId(item.id)) {
      kept.push(item);
      continue;
    }
    const duplicateIndex = kept.findIndex((existing) => {
      if (existing.direction === "form" || isLocalReplyId(existing.id)) return false;
      return threadItemsMatch(existing, item);
    });
    if (duplicateIndex < 0) {
      kept.push(item);
      continue;
    }
    kept[duplicateIndex] = preferRicherThreadItem(kept[duplicateIndex]!, item);
  }
  return kept;
}

/**
 * Merge a server thread with any still-pending optimistic rows.
 * Drops `local-reply:*` bubbles once the server already has the same admin text.
 * Drops previous customer/admin bubbles that hydrate rewrote to `graph:` ids.
 */
export function mergeInquiryThreads(
  incoming: FormInboxThreadItem[],
  previous: FormInboxThreadItem[] | null | undefined,
): FormInboxThreadItem[] {
  if (!previous?.length) return collapseDuplicateThreadItems(incoming);

  const incomingIds = new Set(incoming.map((item) => item.id));
  const extras = previous.filter((item) => {
    if (item.direction === "form") return !incomingIds.has(item.id);
    if (isLocalReplyId(item.id)) {
      return !incoming.some(
        (server) =>
          server.direction === "admin" && adminBodiesMatch(item.textBody, server.textBody),
      );
    }
    return !incoming.some((server) => threadItemsMatch(item, server));
  });

  const merged =
    extras.length === 0
      ? incoming
      : [...incoming, ...extras].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );

  return collapseDuplicateThreadItems(merged);
}
