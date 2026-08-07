import { readServerEnv } from "@mccoy/security";

/**
 * Fetch unique visitors from Vercel Web Analytics (production storefront project).
 * Returns null when env is incomplete or the API fails — never invents numbers.
 *
 * Required (admin server only):
 * - VERCEL_TOKEN — Vercel access token with read access to the storefront project
 * - VERCEL_WEB_ANALYTICS_PROJECT_ID — storefront Vercel project id (prj_…)
 * Optional:
 * - VERCEL_TEAM_ID — team id when the project is under a team
 */

export type WebsiteVisitorWindow = {
  visitors: number;
  previousVisitors: number;
};

type VisitsCountResponse = {
  data?: {
    visitors?: unknown;
    pageviews?: unknown;
  };
};

function parseVisitorCount(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const visitors = (payload as VisitsCountResponse).data?.visitors;
  if (typeof visitors !== "number" || !Number.isFinite(visitors) || visitors < 0) {
    return null;
  }
  return Math.floor(visitors);
}

export function isVercelWebAnalyticsConfigured(): boolean {
  return Boolean(
    readServerEnv("VERCEL_TOKEN") && readServerEnv("VERCEL_WEB_ANALYTICS_PROJECT_ID"),
  );
}

async function fetchVisitsCount(sinceIso: string, untilIso: string): Promise<number | null> {
  const token = readServerEnv("VERCEL_TOKEN");
  const projectId = readServerEnv("VERCEL_WEB_ANALYTICS_PROJECT_ID");
  if (!token || !projectId) return null;

  const url = new URL("https://api.vercel.com/v1/query/web-analytics/visits/count");
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("since", sinceIso);
  url.searchParams.set("until", untilIso);

  const teamId = readServerEnv("VERCEL_TEAM_ID");
  if (teamId) url.searchParams.set("teamId", teamId);

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return parseVisitorCount(json);
  } catch {
    return null;
  }
}

/**
 * Unique visitors for the last 7 days and the prior 7-day window (trend).
 * Hobby reporting window is ~1 month, so both windows are within plan limits.
 */
export async function fetchWebsiteVisitorStats(
  now = new Date(),
): Promise<WebsiteVisitorWindow | null> {
  if (!isVercelWebAnalyticsConfigured()) return null;

  const until = now.toISOString();
  const last7 = new Date(now.getTime());
  last7.setUTCDate(last7.getUTCDate() - 7);
  const prev7 = new Date(now.getTime());
  prev7.setUTCDate(prev7.getUTCDate() - 14);

  const last7From = last7.toISOString();
  const prev7From = prev7.toISOString();

  const [visitors, previousVisitors] = await Promise.all([
    fetchVisitsCount(last7From, until),
    fetchVisitsCount(prev7From, last7From),
  ]);

  if (visitors === null) return null;
  return {
    visitors,
    previousVisitors: previousVisitors ?? 0,
  };
}

/** Exported for unit tests — validates API payload shape without network. */
export function __testParseVisitorCount(payload: unknown): number | null {
  return parseVisitorCount(payload);
}
