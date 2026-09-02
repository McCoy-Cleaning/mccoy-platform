import { describe, expect, it } from "vitest";

/**
 * Mirrors apps/admin/src/routes/api.commerce-portal-jobs.ts auth gate.
 */
export function evaluateCommerceCronAuth(
  authorizationHeader: string | null,
  secret: string | undefined,
): { status: 200 | 401 | 503 } {
  const trimmed = secret?.trim();
  if (!trimmed) return { status: 503 };
  if (authorizationHeader !== `Bearer ${trimmed}`) return { status: 401 };
  return { status: 200 };
}

describe("commerce portal cron auth", () => {
  it("denies missing secret configuration", () => {
    expect(evaluateCommerceCronAuth("Bearer x", undefined)).toEqual({ status: 503 });
    expect(evaluateCommerceCronAuth("Bearer x", "")).toEqual({ status: 503 });
  });

  it("denies missing or wrong bearer", () => {
    const secret = "qual-test-secret-not-production";
    expect(evaluateCommerceCronAuth(null, secret)).toEqual({ status: 401 });
    expect(evaluateCommerceCronAuth("Bearer wrong", secret)).toEqual({ status: 401 });
  });

  it("accepts correct bearer", () => {
    const secret = "qual-test-secret-not-production";
    expect(evaluateCommerceCronAuth(`Bearer ${secret}`, secret)).toEqual({ status: 200 });
  });
});

describe("COMMERCE_CRON_SECRET client exposure guard", () => {
  it("is not referenced from VITE or PUBLIC env in admin route source", async () => {
    const { readFileSync } = await import("node:fs");
    const { join, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
    const routePath = join(root, "apps", "admin", "src", "routes", "api.commerce-portal-jobs.ts");
    const source = readFileSync(routePath, "utf8");
    expect(source).toContain("COMMERCE_CRON_SECRET");
    expect(source).not.toMatch(/VITE_.*CRON|NEXT_PUBLIC_.*CRON|PUBLIC_.*CRON/);
  });
});
