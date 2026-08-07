import { describe, expect, it } from "vitest";
import {
  defaultSiteFooter,
  defaultSiteNavigation,
  parseSiteFooterResult,
  parseSiteNavigationResult,
} from "@mccoy/cms-schema";

/**
 * Mirrors published-hydrate chrome parsing + hydratePublishedCmsState fallback:
 * durable bundle → in-memory chrome → defaults.
 */
function resolveHydrateChrome(input: {
  navigationJson?: string | null;
  footerJson?: string | null;
  currentNavigation?: ReturnType<typeof defaultSiteNavigation>;
  currentFooter?: ReturnType<typeof defaultSiteFooter>;
}) {
  let navigationFromBundle: ReturnType<typeof defaultSiteNavigation> | undefined;
  let footerFromBundle: ReturnType<typeof defaultSiteFooter> | undefined;
  if (typeof input.navigationJson === "string" && input.navigationJson.length > 0) {
    try {
      const parsed = parseSiteNavigationResult(JSON.parse(input.navigationJson) as unknown);
      if (parsed.ok) navigationFromBundle = parsed.data;
    } catch {
      /* ignore */
    }
  }
  if (typeof input.footerJson === "string" && input.footerJson.length > 0) {
    try {
      const parsed = parseSiteFooterResult(JSON.parse(input.footerJson) as unknown);
      if (parsed.ok) footerFromBundle = parsed.data;
    } catch {
      /* ignore */
    }
  }
  return {
    navigation:
      navigationFromBundle ?? input.currentNavigation ?? defaultSiteNavigation(),
    footer: footerFromBundle ?? input.currentFooter ?? defaultSiteFooter(),
  };
}

describe("published hydrate chrome resolution", () => {
  it("uses durable navigation logo heights from the bundle", () => {
    const navigation = {
      ...defaultSiteNavigation(),
      logoHeightDesktop: 110,
      logoHeightMobile: 36,
    };
    const resolved = resolveHydrateChrome({
      navigationJson: JSON.stringify(navigation),
    });
    expect(resolved.navigation.logoHeightDesktop).toBe(110);
    expect(resolved.navigation.logoHeightMobile).toBe(36);
  });

  it("keeps in-memory chrome when the bundle omits navigation", () => {
    const current = {
      ...defaultSiteNavigation(),
      logoHeightDesktop: 88,
      logoHeightMobile: 44,
    };
    const resolved = resolveHydrateChrome({
      navigationJson: null,
      currentNavigation: current,
    });
    expect(resolved.navigation.logoHeightDesktop).toBe(88);
    expect(resolved.navigation.logoHeightMobile).toBe(44);
  });

  it("falls back to defaults when neither bundle nor memory has chrome", () => {
    const resolved = resolveHydrateChrome({ navigationJson: null, footerJson: null });
    expect(resolved.navigation).toEqual(defaultSiteNavigation());
    expect(resolved.footer).toEqual(defaultSiteFooter());
  });
});
