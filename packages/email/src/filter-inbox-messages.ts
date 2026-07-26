import type { FormKind } from "@mccoy/domain";
import type { FormInboxMessageSummary } from "./form-inbox-contracts";

export type InboxListFilters = {
  kind?: FormKind | "all";
  scopeKey?: string | "all";
  q?: string;
};

export type InboxScopeFacet = {
  key: string;
  label: string;
  count: number;
};

export type InboxKindFacet = {
  value: FormKind;
  count: number;
};

export type InboxFacets = {
  kinds: InboxKindFacet[];
  scopes: InboxScopeFacet[];
};

/**
 * Shared post-normalization filter for Graph and IMAP summaries.
 * AND semantics when both kind and scopeKey are set.
 */
export function filterInboxMessages(
  messages: FormInboxMessageSummary[],
  filters: InboxListFilters,
): FormInboxMessageSummary[] {
  const kind = filters.kind ?? "all";
  const scopeKey = filters.scopeKey ?? "all";
  const q = filters.q?.trim().toLowerCase() ?? "";

  return messages.filter((summary) => {
    if (kind !== "all" && summary.kind !== kind) return false;
    if (scopeKey !== "all" && (summary.scopeKey ?? null) !== scopeKey) return false;
    if (!q) return true;
    const hay = [
      summary.subject,
      summary.from,
      summary.snippet,
      summary.submitterName ?? "",
      summary.submitterEmail ?? "",
      summary.requestNumber ?? "",
      summary.scopeKey ?? "",
      summary.scopeLabel ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/** Build facets from a full candidate window (not the paginated page). */
export function buildInboxFacets(messages: FormInboxMessageSummary[]): InboxFacets {
  const kindCounts = new Map<FormKind, number>();
  const scopeCounts = new Map<string, { label: string; count: number }>();

  for (const msg of messages) {
    kindCounts.set(msg.kind, (kindCounts.get(msg.kind) ?? 0) + 1);
    if (msg.scopeKey) {
      const prev = scopeCounts.get(msg.scopeKey);
      scopeCounts.set(msg.scopeKey, {
        label: msg.scopeLabel?.trim() || prev?.label || msg.scopeKey,
        count: (prev?.count ?? 0) + 1,
      });
    }
  }

  return {
    kinds: [...kindCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value)),
    scopes: [...scopeCounts.entries()]
      .map(([key, { label, count }]) => ({ key, label, count }))
      .sort((a, b) => a.label.localeCompare(b.label, "nl")),
  };
}

/** Merge request-store facets with mailbox-window facets (mailbox counts win on overlap). */
export function mergeScopeFacets(
  fromStore: InboxScopeFacet[],
  fromMailbox: InboxScopeFacet[],
): InboxScopeFacet[] {
  const map = new Map<string, InboxScopeFacet>();
  for (const facet of fromStore) {
    map.set(facet.key, { ...facet });
  }
  for (const facet of fromMailbox) {
    const prev = map.get(facet.key);
    if (!prev) {
      map.set(facet.key, facet);
      continue;
    }
    map.set(facet.key, {
      key: facet.key,
      label: facet.label || prev.label,
      count: Math.max(prev.count, facet.count),
    });
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, "nl"));
}
