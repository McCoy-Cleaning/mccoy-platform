import type { FormInboxMessageSummary } from "./form-inbox-contracts";

export type InboxScopeEnrichmentSource = {
  number: string;
  scopeKey: string | null;
  scopeLabel: string | null;
};

export type MergeInboxSummariesOptions = {
  /**
   * WR- numbers for closed/spam website requests. Mailbox copies of those
   * inquiries must not reappear as graph:/imap: rows after Aanvragen delete.
   */
  hiddenRequestNumbers?: ReadonlySet<string>;
};

/**
 * Merge mailbox rows with website_requests. Same WR- number → keep mailbox
 * (attachments / Graph thread) but prefer request scope when mailbox lacks it.
 * Prefer the website-request / non-reply row over an applicant reply that
 * incorrectly shared the WR- number.
 * Request-only rows (no mailbox copy) stay visible — that is the product rule.
 */
export function mergeMailboxAndWebsiteRequestSummaries(
  mailboxItems: FormInboxMessageSummary[],
  requestItems: FormInboxMessageSummary[],
  options?: MergeInboxSummariesOptions,
): FormInboxMessageSummary[] {
  const byNumber = new Map<string, FormInboxMessageSummary>();
  const withoutNumber: FormInboxMessageSummary[] = [];
  const hidden = options?.hiddenRequestNumbers;

  const isReplySubject = (subject: string) =>
    /^(?:(?:RE|FW|FWD|AW|WG)\s*:\s*)+/i.test(subject.trim());

  const isHiddenNumber = (number: string | null | undefined) => {
    if (!number || !hidden || hidden.size === 0) return false;
    return hidden.has(number.trim().toUpperCase());
  };

  for (const item of mailboxItems) {
    const number = item.requestNumber?.trim().toUpperCase();
    if (!number) {
      withoutNumber.push(item);
      continue;
    }
    if (isHiddenNumber(number)) continue;
    // Never let a reply-shaped mailbox message become the inquiry list row.
    if (isReplySubject(item.subject)) continue;
    byNumber.set(number, item);
  }

  for (const item of requestItems) {
    const number = item.requestNumber?.trim().toUpperCase();
    if (!number) {
      withoutNumber.push(item);
      continue;
    }
    if (isHiddenNumber(number)) continue;
    const existing = byNumber.get(number);
    if (!existing) {
      byNumber.set(number, item);
      continue;
    }
    byNumber.set(number, {
      ...existing,
      // Prefer request-backed id for stable inquiry identity when available.
      id: item.id.startsWith("req:") ? item.id : existing.id,
      scopeKey: existing.scopeKey ?? item.scopeKey,
      scopeLabel: existing.scopeLabel ?? item.scopeLabel,
      submitterEmail: existing.submitterEmail ?? item.submitterEmail,
      submitterName: existing.submitterName ?? item.submitterName,
      unread: existing.unread || item.unread,
      date:
        new Date(existing.date).getTime() >= new Date(item.date).getTime()
          ? existing.date
          : item.date,
    });
  }

  return [...byNumber.values(), ...withoutNumber].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
}

/**
 * Fill missing mailbox scopeKey/scopeLabel from persisted website requests
 * (matched by WR-… request number). Subject markers / Graph headers can be
 * absent on list fetches; the request row remains authoritative at submit time.
 */
export function enrichInboxSummariesWithRequestScopes(
  summaries: FormInboxMessageSummary[],
  requests: InboxScopeEnrichmentSource[],
): FormInboxMessageSummary[] {
  const byNumber = new Map<string, InboxScopeEnrichmentSource>();
  for (const request of requests) {
    const number = request.number.trim().toUpperCase();
    if (!number || !request.scopeKey) continue;
    byNumber.set(number, request);
  }

  return summaries.map((summary) => {
    if (summary.scopeKey) return summary;
    const number = summary.requestNumber?.trim().toUpperCase();
    if (!number) return summary;
    const hit = byNumber.get(number);
    if (!hit?.scopeKey) return summary;
    return {
      ...summary,
      scopeKey: hit.scopeKey,
      scopeLabel: hit.scopeLabel?.trim() || summary.scopeLabel || hit.scopeKey,
    };
  });
}
