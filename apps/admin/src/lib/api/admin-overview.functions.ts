import { createServerFn } from "@tanstack/react-start";

import {
  countWebsiteRequestsCreatedBetween,
  listStaffUsers,
  listWebsiteRequests,
  requireAdminSession,
} from "@mccoy/database/server";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";

import {
  mapOverviewRecentRequests,
  OVERVIEW_RECENT_REQUEST_LIMIT,
  type AdminOverviewRecentRequest,
} from "@/lib/api/admin-overview.recent";
import { fetchWebsiteVisitorStats } from "@/lib/vercel-web-analytics.server";

export type { AdminOverviewRecentRequest };

export type AdminOverviewStats = {
  /** Website requests created in the last 7 days (rolling). */
  newRequestsLast7Days: number;
  /** Same window shifted back 7 days, for trend. */
  newRequestsPrevious7Days: number;
  /** Active staff accounts (users who can log into admin). */
  activeStaffCount: number;
  /**
   * Unique storefront visitors (Vercel Web Analytics) for the last 7 days.
   * Null when env/API is unavailable — never a placeholder number.
   */
  websiteVisitors: number | null;
  /** Prior 7-day visitor window for trend; 0 when current is known but previous failed. */
  websiteVisitorsPrevious7Days: number | null;
  /** Safe status for the visitors tile (configured-but-failed vs missing env). */
  websiteVisitorsStatus: "ok" | "not_configured" | "failed";
  /** Missing env *names* only — never values. */
  websiteVisitorsMissingEnv: string[];
  /** Safe HTTP/API code when visitors failed (e.g. not_found, forbidden). */
  websiteVisitorsErrorCode?: string;
  /** Last four website requests for Overzicht. Never dummy product/user rows. */
  recentRequests: AdminOverviewRecentRequest[];
};

function daysAgoIso(days: number, now = new Date()): string {
  const d = new Date(now.getTime());
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

export const getAdminOverviewStats = createServerFn({ method: "POST" }).handler(
  async (): Promise<AdminOverviewStats> => {
    ensureMonorepoEnvLoaded();
    await requireAdminSession();

    const now = new Date();
    const last7From = daysAgoIso(7, now);
    const prev7From = daysAgoIso(14, now);
    const nowIso = now.toISOString();

    const [newRequestsLast7Days, newRequestsPrevious7Days, staffUsers, visitorStats, recentRows] =
      await Promise.all([
        countWebsiteRequestsCreatedBetween(last7From, nowIso).catch(() => 0),
        countWebsiteRequestsCreatedBetween(prev7From, last7From).catch(() => 0),
        listStaffUsers().catch(() => []),
        fetchWebsiteVisitorStats(now).catch(() => null),
        listWebsiteRequests().catch(() => []),
      ]);

    const visitorResult = visitorStats;
    return {
      newRequestsLast7Days,
      newRequestsPrevious7Days,
      activeStaffCount: staffUsers.filter((u) => u.status === "active").length,
      websiteVisitors: visitorResult?.visitors ?? null,
      websiteVisitorsPrevious7Days:
        visitorResult === null ? null : visitorResult.previousVisitors,
      websiteVisitorsStatus: visitorResult?.status ?? "failed",
      websiteVisitorsMissingEnv: visitorResult?.missingEnv ?? [],
      websiteVisitorsErrorCode: visitorResult?.errorCode,
      recentRequests: mapOverviewRecentRequests(recentRows, OVERVIEW_RECENT_REQUEST_LIMIT),
    };
  },
);
