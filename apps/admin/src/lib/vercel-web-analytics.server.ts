import { readServerEnv } from "@mccoy/security";

/**
 * Fetch unique visitors from Vercel Web Analytics (production storefront project).
 * Returns a status object — never invents visitor numbers.
 *
 * Required (admin server only):
 * - VERCEL_TOKEN — Vercel access token with read access to the storefront project
 * - VERCEL_WEB_ANALYTICS_PROJECT_ID — storefront Vercel project id (prj_…)
 *   Alias: STOREFRONT_VERCEL_PROJECT_ID. Never VERCEL_PROJECT_ID (admin project).
 * Optional:
 * - VERCEL_TEAM_ID — team id when the project is under a team
 * - VERCEL_ORG_ID — Vercel deployments already set this; used as teamId fallback
 *
 * On 404/403: status "failed" + a safe errorCode for the overview tile.
 * Never silently fall back to another Vercel project (the admin app).
 */

export type WebsiteVisitorWindow = {
  visitors: number;
  previousVisitors: number;
};

export type WebsiteVisitorStatsStatus = "ok" | "not_configured" | "failed";

export type WebsiteVisitorStatsResult = {
  visitors: number | null;
  previousVisitors: number | null;
  status: WebsiteVisitorStatsStatus;
  missingEnv: string[];
  /** Safe HTTP/API code only — never tokens, URLs, or project ids. */
  errorCode?: string;
};

const VISITS_COUNT_URL = "https://api.vercel.com/v1/query/web-analytics/visits/count";
const PRODUCTION_FILTER = "environment eq 'production'";

type VisitsCountOutcome = {
  visitors: number | null;
  errorCode?: string;
};

type VisitsCountRequestOptions = {
  /** Same storefront id/name, but without teamId (hobby / wrong team). */
  omitTeamId?: boolean;
  /** Caller already logged — keep one warn per overview load. */
  silent?: boolean;
};

function coerceNonNegativeInt(value: unknown, depth = 0): number | null {
  if (depth > 2) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return null;
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const rec = value as Record<string, unknown>;
    for (const key of ["visitors", "value", "count", "total"]) {
      if (key in rec) {
        const inner = coerceNonNegativeInt(rec[key], depth + 1);
        if (inner !== null) return inner;
      }
    }
  }
  return null;
}

function parseVisitorCount(payload: unknown): number | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const obj = payload as Record<string, unknown>;
  const data = obj.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const fromData = coerceNonNegativeInt((data as Record<string, unknown>).visitors);
    if (fromData !== null) return fromData;
  }
  return coerceNonNegativeInt(obj.visitors);
}

/** Storefront project only — never the admin app's VERCEL_PROJECT_ID. */
export function resolveStorefrontAnalyticsProjectId(): string {
  return (
    readServerEnv("VERCEL_WEB_ANALYTICS_PROJECT_ID") ||
    readServerEnv("STOREFRONT_VERCEL_PROJECT_ID")
  );
}

/** Team projects require teamId. Vercel sets VERCEL_ORG_ID on deployments. */
export function resolveVercelAnalyticsTeamId(): string {
  return readServerEnv("VERCEL_TEAM_ID") || readServerEnv("VERCEL_ORG_ID");
}

export function getVercelWebAnalyticsMissingEnv(): string[] {
  const missing: string[] = [];
  if (!readServerEnv("VERCEL_TOKEN")) missing.push("VERCEL_TOKEN");
  if (!resolveStorefrontAnalyticsProjectId()) {
    missing.push("VERCEL_WEB_ANALYTICS_PROJECT_ID");
  }
  return missing;
}

export function isVercelWebAnalyticsConfigured(): boolean {
  return getVercelWebAnalyticsMissingEnv().length === 0;
}

function extractSafeErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const rec = payload as Record<string, unknown>;
  if (typeof rec.code === "string" && rec.code.trim()) {
    return rec.code.trim().slice(0, 80);
  }
  if (typeof rec.errorCode === "string" && rec.errorCode.trim()) {
    return rec.errorCode.trim().slice(0, 80);
  }
  const err = rec.error;
  if (typeof err === "string" && err.trim()) return err.trim().slice(0, 80);
  if (err && typeof err === "object") {
    const code = (err as Record<string, unknown>).code;
    if (typeof code === "string" && code.trim()) return code.trim().slice(0, 80);
  }
  return undefined;
}

/** Map HTTP status to a stable, secret-free code for the overview tile. */
export function mapVisitsCountHttpError(status: number, payload?: unknown): string {
  if (status === 404) return "not_found";
  if (status === 403) return "forbidden";
  return extractSafeErrorCode(payload) ?? `http_${status}`;
}

function isProjectAccessError(errorCode: string | undefined): boolean {
  return errorCode === "not_found" || errorCode === "forbidden";
}

function logVisitsCountHttpError(status: number, errorCode: string, hasTeamId: boolean): void {
  console.warn("[vercel-web-analytics] visits/count HTTP error", {
    status,
    errorCode,
    hasTeamId,
  });
}

async function requestVisitsCount(
  since: string,
  until: string,
  options: VisitsCountRequestOptions = {},
): Promise<VisitsCountOutcome> {
  const token = readServerEnv("VERCEL_TOKEN");
  const projectId = resolveStorefrontAnalyticsProjectId();
  if (!token || !projectId) return { visitors: null };

  const url = new URL(VISITS_COUNT_URL);
  url.searchParams.set("projectId", projectId);
  url.searchParams.set("since", since);
  url.searchParams.set("until", until);
  url.searchParams.set("filter", PRODUCTION_FILTER);

  const teamId = options.omitTeamId ? "" : resolveVercelAnalyticsTeamId();
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
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const errorCode = mapVisitsCountHttpError(res.status, json);
      if (!options.silent) {
        logVisitsCountHttpError(res.status, errorCode, Boolean(teamId));
      }
      return { visitors: null, errorCode };
    }
    const visitors = parseVisitorCount(json);
    if (visitors === null) {
      console.warn("[vercel-web-analytics] visits/count unexpected payload shape");
    }
    return { visitors };
  } catch (error) {
    if (!options.silent) {
      console.warn("[vercel-web-analytics] visits/count request failed", {
        name: error instanceof Error ? error.name : "unknown",
        hasTeamId: Boolean(teamId),
      });
    }
    return { visitors: null };
  }
}

async function fetchVisitsCount(
  since: Date,
  until: Date,
  options: VisitsCountRequestOptions = {},
): Promise<VisitsCountOutcome> {
  const iso = await requestVisitsCount(since.toISOString(), until.toISOString(), options);
  if (iso.visitors !== null) return iso;
  // 404/403 is the configured project/token — do not retry date format or switch project.
  if (isProjectAccessError(iso.errorCode)) return iso;
  const epoch = await requestVisitsCount(String(since.getTime()), String(until.getTime()), options);
  if (epoch.visitors !== null) return epoch;
  return { visitors: null, errorCode: epoch.errorCode ?? iso.errorCode };
}

function failedVisitorStats(errorCode?: string): WebsiteVisitorStatsResult {
  return {
    visitors: null,
    previousVisitors: null,
    status: "failed",
    missingEnv: [],
    errorCode,
  };
}

/**
 * Unique visitors for the last 7 days and the prior 7-day window (trend).
 * Hobby reporting window is ~1 month, so both windows are within plan limits.
 *
 * Current window first. 404/403 stops immediately (no previous window, no ISO+ms
 * retry). One optional retry: same storefront id/name without teamId. Never the
 * admin project.
 */
export async function fetchWebsiteVisitorStats(
  now = new Date(),
): Promise<WebsiteVisitorStatsResult> {
  const missingEnv = getVercelWebAnalyticsMissingEnv();
  if (missingEnv.length > 0) {
    return {
      visitors: null,
      previousVisitors: null,
      status: "not_configured",
      missingEnv,
    };
  }

  const last7 = new Date(now.getTime());
  last7.setUTCDate(last7.getUTCDate() - 7);
  const prev7 = new Date(now.getTime());
  prev7.setUTCDate(prev7.getUTCDate() - 14);

  const current = await fetchVisitsCount(last7, now);

  if (current.visitors === null && current.errorCode === "not_found" && resolveVercelAnalyticsTeamId()) {
    const withoutTeam = await fetchVisitsCount(last7, now, { omitTeamId: true, silent: true });
    if (withoutTeam.visitors !== null) {
      const previous = await fetchVisitsCount(prev7, last7, { omitTeamId: true });
      return {
        visitors: withoutTeam.visitors,
        previousVisitors: previous.visitors ?? 0,
        status: "ok",
        missingEnv: [],
      };
    }
    return failedVisitorStats(withoutTeam.errorCode ?? current.errorCode);
  }

  if (current.visitors === null) {
    return failedVisitorStats(current.errorCode);
  }

  const previous = await fetchVisitsCount(prev7, last7);
  return {
    visitors: current.visitors,
    previousVisitors: previous.visitors ?? 0,
    status: "ok",
    missingEnv: [],
  };
}

/** Exported for unit tests — validates API payload shape without network. */
export function __testParseVisitorCount(payload: unknown): number | null {
  return parseVisitorCount(payload);
}

export function __testExtractSafeErrorCode(payload: unknown): string | undefined {
  return extractSafeErrorCode(payload);
}
