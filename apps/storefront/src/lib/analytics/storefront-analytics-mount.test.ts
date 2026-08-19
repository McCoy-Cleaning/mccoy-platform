import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));

describe("storefront analytics mount", () => {
  it("keeps cookieless Vercel Analytics mounted and not disabled", () => {
    const root = readFileSync(join(here, "../../routes/__root.tsx"), "utf8");
    expect(root).toContain('import { Analytics } from "@vercel/analytics/react"');
    expect(root).toContain("<Analytics");
    expect(root).not.toMatch(/<Analytics[^>]*disabled/);
    expect(root).toContain("StorefrontAnalytics");
    expect(root).toContain("__MCCOY_GA_MEASUREMENT_ID__");
  });

  it("lists @vercel/analytics as a storefront dependency", () => {
    const pkg = JSON.parse(
      readFileSync(join(here, "../../../package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };
    expect(pkg.dependencies?.["@vercel/analytics"]).toBeTruthy();
  });

  it("paints the consent banner only after client mount", () => {
    const source = readFileSync(
      join(here, "../../components/site/StorefrontAnalytics.tsx"),
      "utf8",
    );
    expect(source).not.toContain("readInitialAnalyticsConsent");
    expect(source).toContain("useState(false)");
    expect(source).toContain("useState<AnalyticsConsent | null>(null)");
    expect(source).toContain("retainExplicitAnalyticsConsent");
    expect(source).toContain("readAnalyticsConsent");
    expect(source).toMatch(
      /setConsent\(\(prev\) => retainExplicitAnalyticsConsent\(prev, readAnalyticsConsent\(\)\)\)/,
    );
    const acceptIdx = source.indexOf('setConsent("granted")');
    const writeGrantedIdx = source.indexOf('writeAnalyticsConsent("granted")');
    expect(acceptIdx).toBeGreaterThan(-1);
    expect(writeGrantedIdx).toBeGreaterThan(acceptIdx);
    expect(source).toMatch(/activateGoogleAnalyticsAfterConsent\([\s\S]*?\}\s*catch/);
    const rejectIdx = source.indexOf('setConsent("denied")');
    const writeDeniedIdx = source.indexOf('writeAnalyticsConsent("denied")');
    expect(rejectIdx).toBeGreaterThan(-1);
    expect(writeDeniedIdx).toBeGreaterThan(rejectIdx);
  });
});
