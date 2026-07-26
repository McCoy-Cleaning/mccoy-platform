import { describe, expect, it } from "vitest";
import {
  createNavLink,
  DEFAULT_LOGO_HEIGHT_DESKTOP_PX,
  DEFAULT_LOGO_HEIGHT_MOBILE_PX,
  defaultSiteNavigation,
  effectiveSiteNavigation,
  isNavigationDraftDirty,
  LOGO_HEIGHT_DESKTOP_MAX,
  LOGO_HEIGHT_MOBILE_MIN,
  mergeNavigationPatch,
  parseSiteNavigation,
  parseSiteNavigationResult,
  resolveLogoHeightDesktop,
  resolveLogoHeightMobile,
} from "./navigation";
import { migrateAndValidate } from "./migrate";
import { CMS_SCHEMA_VERSION } from "./types";

describe("site navigation", () => {
  it("provides default links matching the storefront menu", () => {
    const nav = defaultSiteNavigation();
    expect(nav.links.map((l) => l.link)).toEqual([
      { type: "internal_route", route: "home" },
      { type: "internal_route", route: "services" },
      { type: "internal_route", route: "products" },
      { type: "internal_route", route: "about" },
      { type: "internal_route", route: "contact" },
    ]);
    expect(nav.jobsCta?.link).toEqual({ type: "internal_route", route: "vacatures" });
    expect(nav.quoteCta?.link).toEqual({ type: "internal_route", route: "offerte" });
  });

  it("merges patches and deletes optional fields with null", () => {
    const base = defaultSiteNavigation();
    const merged = mergeNavigationPatch(base, {
      logo: {
        assetId: "local:images/cms/hero-cleaning.jpg",
        src: "/images/cms/hero-cleaning.jpg",
        alt: "Logo",
        decorative: true,
      },
      jobsCta: null,
      links: [...base.links, createNavLink({ label: "Extra" })],
    });
    expect(merged.logo?.src).toBe("/images/cms/hero-cleaning.jpg");
    expect(merged.jobsCta).toBeUndefined();
    expect(merged.links).toHaveLength(base.links.length + 1);
  });

  it("detects dirty draft navigation", () => {
    const published = defaultSiteNavigation();
    expect(isNavigationDraftDirty(published, null)).toBe(false);
    const draft = { ...published, links: published.links.slice(0, 2) };
    expect(isNavigationDraftDirty(published, draft)).toBe(true);
    expect(effectiveSiteNavigation(published, draft).links).toHaveLength(2);
  });

  it("parseSiteNavigationResult surfaces field paths", () => {
    // merge clamps to max — bypass merge to feed an out-of-range value straight to parse
    const bad = { ...defaultSiteNavigation(), logoHeightDesktop: 9999 };
    const result = parseSiteNavigationResult(bad);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toMatch(/logoHeightDesktop|navigatie/i);
  });

  it("clamps and resolves logo heights for both navbars", () => {
    const nav = defaultSiteNavigation();
    expect(resolveLogoHeightDesktop(nav)).toBe(DEFAULT_LOGO_HEIGHT_DESKTOP_PX);
    expect(resolveLogoHeightMobile(nav)).toBe(DEFAULT_LOGO_HEIGHT_MOBILE_PX);
    const tall = mergeNavigationPatch(nav, { logoHeightDesktop: 999, logoHeightMobile: 1 });
    expect(tall.logoHeightDesktop).toBe(LOGO_HEIGHT_DESKTOP_MAX);
    expect(tall.logoHeightMobile).toBe(LOGO_HEIGHT_MOBILE_MIN);
  });

  it("migrates persisted state without navigation to defaults", () => {
    const result = migrateAndValidate({
      schemaVersion: 4,
      pages: [
        {
          id: "page_home",
          slug: "/",
          title: "Home",
          description: "",
          isCustom: false,
          kind: "builtin",
          pageKey: "home",
          inNav: true,
          blocks: [],
          updatedAt: 1,
          version: 1,
        },
      ],
      saved: {},
      draft: {},
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.schemaVersion).toBe(CMS_SCHEMA_VERSION);
    expect(parseSiteNavigation(result.state.navigation)?.links.length).toBeGreaterThan(0);
    expect(result.state.navigationDraft).toBeNull();
  });
});
