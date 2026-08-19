import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  __testExtractSafeErrorCode,
  __testParseVisitorCount,
  fetchWebsiteVisitorStats,
  getVercelWebAnalyticsMissingEnv,
  isVercelWebAnalyticsConfigured,
  resolveStorefrontAnalyticsProjectId,
  resolveVercelAnalyticsTeamId,
} from "./vercel-web-analytics.server";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "vercel-web-analytics.server.ts"),
  "utf8",
);

const ENV_KEYS = [
  "VERCEL_TOKEN",
  "VERCEL_WEB_ANALYTICS_PROJECT_ID",
  "STOREFRONT_VERCEL_PROJECT_ID",
  "VERCEL_TEAM_ID",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
] as const;

const saved: Record<string, string | undefined> = {};

function snapshotEnv() {
  for (const key of ENV_KEYS) saved[key] = process.env[key];
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

function setEnv(partial: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>) {
  for (const key of ENV_KEYS) {
    const value = key in partial ? partial[key] : undefined;
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

snapshotEnv();

afterEach(() => {
  restoreEnv();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("parseVisitorCount", () => {
  it("reads a finite non-negative visitors total", () => {
    expect(
      __testParseVisitorCount({
        version: 1,
        data: { visitors: 42, pageviews: 100 },
      }),
    ).toBe(42);
  });

  it("floors fractional values", () => {
    expect(__testParseVisitorCount({ data: { visitors: 3.9 } })).toBe(3);
  });

  it("accepts numeric strings and other safe visitor shapes", () => {
    expect(__testParseVisitorCount({ data: { visitors: "12" } })).toBe(12);
    expect(__testParseVisitorCount({ data: { visitors: "3.9" } })).toBe(3);
    expect(__testParseVisitorCount({ visitors: 7 })).toBe(7);
    expect(__testParseVisitorCount({ data: { visitors: { value: 11 } } })).toBe(11);
  });

  it("rejects missing or invalid payloads and never invents numbers", () => {
    expect(__testParseVisitorCount(null)).toBeNull();
    expect(__testParseVisitorCount({})).toBeNull();
    expect(__testParseVisitorCount({ data: { visitors: -1 } })).toBeNull();
    expect(__testParseVisitorCount({ data: { visitors: "nope" } })).toBeNull();
    expect(__testParseVisitorCount({ data: { visitors: Number.NaN } })).toBeNull();
    expect(__testParseVisitorCount({ data: { pageviews: 9 } })).toBeNull();
  });
});

describe("env resolution", () => {
  it("never uses VERCEL_PROJECT_ID for storefront analytics", () => {
    expect(src).not.toContain('readServerEnv("VERCEL_PROJECT_ID")');
    setEnv({
      VERCEL_PROJECT_ID: "prj_admin_must_not_be_used",
      VERCEL_WEB_ANALYTICS_PROJECT_ID: undefined,
      STOREFRONT_VERCEL_PROJECT_ID: undefined,
    });
    expect(resolveStorefrontAnalyticsProjectId()).toBe("");
  });

  it("accepts STOREFRONT_VERCEL_PROJECT_ID as an alias", () => {
    setEnv({
      STOREFRONT_VERCEL_PROJECT_ID: "prj_storefront",
      VERCEL_WEB_ANALYTICS_PROJECT_ID: undefined,
    });
    expect(resolveStorefrontAnalyticsProjectId()).toBe("prj_storefront");
  });

  it("uses VERCEL_ORG_ID as teamId fallback", () => {
    setEnv({
      VERCEL_TEAM_ID: undefined,
      VERCEL_ORG_ID: "team_from_org",
    });
    expect(resolveVercelAnalyticsTeamId()).toBe("team_from_org");
    setEnv({
      VERCEL_TEAM_ID: "team_explicit",
      VERCEL_ORG_ID: "team_from_org",
    });
    expect(resolveVercelAnalyticsTeamId()).toBe("team_explicit");
  });

  it("treats token + storefront project as configured (org is team fallback, not required)", () => {
    setEnv({
      VERCEL_TOKEN: "tok",
      VERCEL_WEB_ANALYTICS_PROJECT_ID: "prj_sf",
      VERCEL_TEAM_ID: undefined,
      VERCEL_ORG_ID: "team_org",
    });
    expect(isVercelWebAnalyticsConfigured()).toBe(true);
    expect(getVercelWebAnalyticsMissingEnv()).toEqual([]);
    setEnv({
      VERCEL_TOKEN: undefined,
      VERCEL_WEB_ANALYTICS_PROJECT_ID: undefined,
    });
    expect(isVercelWebAnalyticsConfigured()).toBe(false);
    expect(getVercelWebAnalyticsMissingEnv()).toEqual([
      "VERCEL_TOKEN",
      "VERCEL_WEB_ANALYTICS_PROJECT_ID",
    ]);
  });
});

describe("safe error codes", () => {
  it("reads status-adjacent codes without treating the body as a visitor count", () => {
    expect(__testExtractSafeErrorCode({ error: { code: "forbidden" } })).toBe("forbidden");
    expect(__testExtractSafeErrorCode({ code: "bad_request" })).toBe("bad_request");
    expect(__testParseVisitorCount({ error: { code: "forbidden" } })).toBeNull();
  });
});

describe("fetchWebsiteVisitorStats", () => {
  it("returns not_configured with env names only when required keys are missing", async () => {
    setEnv({
      VERCEL_TOKEN: undefined,
      VERCEL_WEB_ANALYTICS_PROJECT_ID: undefined,
    });
    const result = await fetchWebsiteVisitorStats(new Date("2026-08-19T12:00:00.000Z"));
    expect(result).toEqual({
      visitors: null,
      previousVisitors: null,
      status: "not_configured",
      missingEnv: ["VERCEL_TOKEN", "VERCEL_WEB_ANALYTICS_PROJECT_ID"],
    });
  });

  it("sends teamId, production filter, and retries ISO failure with epoch ms", async () => {
    setEnv({
      VERCEL_TOKEN: "tok",
      VERCEL_WEB_ANALYTICS_PROJECT_ID: "prj_sf",
      VERCEL_TEAM_ID: undefined,
      VERCEL_ORG_ID: "team_org",
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const href = String(input);
      const url = new URL(href);
      expect(url.searchParams.get("projectId")).toBe("prj_sf");
      expect(url.searchParams.get("teamId")).toBe("team_org");
      expect(url.searchParams.get("filter")).toBe("environment eq 'production'");
      const since = url.searchParams.get("since") ?? "";
      if (since.includes("T")) {
        return new Response(JSON.stringify({ error: { code: "invalid_since" } }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ data: { visitors: "21", pageviews: 40 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWebsiteVisitorStats(new Date("2026-08-19T12:00:00.000Z"));
    expect(result.status).toBe("ok");
    expect(result.visitors).toBe(21);
    expect(result.previousVisitors).toBe(21);
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it("returns failed without inventing a count when the API errors", async () => {
    setEnv({
      VERCEL_TOKEN: "tok",
      VERCEL_WEB_ANALYTICS_PROJECT_ID: "prj_sf",
      VERCEL_ORG_ID: "team_org",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: { code: "forbidden" } }), { status: 403 })),
    );
    const result = await fetchWebsiteVisitorStats(new Date("2026-08-19T12:00:00.000Z"));
    expect(result).toEqual({
      visitors: null,
      previousVisitors: null,
      status: "failed",
      missingEnv: [],
    });
  });
});
