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
});
