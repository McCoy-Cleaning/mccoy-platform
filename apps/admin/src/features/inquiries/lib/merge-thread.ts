import type { FormInboxThreadItem } from "@mccoy/email/contracts";

function fingerprintAdminBody(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** True when optimistic plain text matches a server admin bubble (possibly templated). */
function adminBodiesMatch(a: string, b: string): boolean {
  const na = fingerprintAdminBody(a);
  const nb = fingerprintAdminBody(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length < 4) return false;
  return longer.includes(shorter);
}

/**
 * Merge a server thread with any still-pending optimistic rows.
 * Drops `local-reply:*` bubbles once the server already has the same admin text.
 */
export function mergeInquiryThreads(
  incoming: FormInboxThreadItem[],
  previous: FormInboxThreadItem[] | null | undefined,
): FormInboxThreadItem[] {
  if (!previous?.length) return incoming;

  const incomingIds = new Set(incoming.map((item) => item.id));
  const extras = previous.filter((item) => {
    if (incomingIds.has(item.id)) return false;
    if (item.id.startsWith("local-reply:")) {
      return !incoming.some(
        (server) =>
          server.direction === "admin" && adminBodiesMatch(item.textBody, server.textBody),
      );
    }
    return true;
  });

  if (extras.length === 0) return incoming;

  return [...incoming, ...extras].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}
