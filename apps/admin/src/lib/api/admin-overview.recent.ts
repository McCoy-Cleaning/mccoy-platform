import { KIND_LABELS } from "@mccoy/domain";
import type { WebsiteRequestSummary } from "@mccoy/domain";

import { encodeWebsiteRequestInboxId } from "@/lib/notifications/destinations";

export const OVERVIEW_RECENT_REQUEST_LIMIT = 4;

export type AdminOverviewRecentRequest = {
  /** Inbox id (`req:website-requests:…`) for `/inquiries?id=`. */
  id: string;
  text: string;
  tag: string;
  createdAt: string;
};

export function mapOverviewRecentRequests(
  rows: WebsiteRequestSummary[],
  limit = OVERVIEW_RECENT_REQUEST_LIMIT,
): AdminOverviewRecentRequest[] {
  return [...rows]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, limit)
    .map((row) => {
      const kindLabel = KIND_LABELS[row.kind] ?? "Aanvraag";
      const scope = row.scopeLabel?.trim() || kindLabel;
      const who = row.submitterName.trim() || "Nieuwe aanvraag";
      return {
        id: encodeWebsiteRequestInboxId(row.id),
        text: `${who} — ${scope}`,
        tag: kindLabel,
        createdAt: row.createdAt,
      };
    });
}
