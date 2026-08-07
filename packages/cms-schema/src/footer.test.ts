import { describe, expect, it } from "vitest";
import {
  defaultSiteFooter,
  effectiveSiteFooter,
  isFooterDraftDirty,
  mergeFooterPatch,
  parseSiteFooter,
  parseSiteFooterResult,
} from "./footer";
import { migrateAndValidate } from "./migrate";

describe("site footer", () => {
  it("parses default footer", () => {
    const footer = defaultSiteFooter();
    expect(parseSiteFooter(footer)?.tagline).toBe(footer.tagline);
    expect(footer.servicesLinks.length).toBeGreaterThan(0);
    expect(footer.legalLinks.length).toBe(2);
  });

  it("rejects malformed footer", () => {
    expect(parseSiteFooter({ tagline: 1 })).toBeNull();
    expect(parseSiteFooterResult(null).ok).toBe(false);
  });

  it("merges patch and clears logo with null", () => {
    const base = defaultSiteFooter();
    const withLogo = mergeFooterPatch(base, {
      logo: { assetId: "local:x.png", src: "/x.png", alt: "x", decorative: true },
      logoHeight: 72,
      tagline: "Nieuw",
    });
    expect(withLogo.tagline).toBe("Nieuw");
    expect(withLogo.logo?.src).toBe("/x.png");
    expect(withLogo.logoHeight).toBe(72);
    const cleared = mergeFooterPatch(withLogo, { logo: null });
    expect(cleared.logo).toBeUndefined();
  });

  it("clamps footer logo height", () => {
    const base = defaultSiteFooter();
    expect(mergeFooterPatch(base, { logoHeight: 999 }).logoHeight).toBe(96);
    expect(mergeFooterPatch(base, { logoHeight: 1 }).logoHeight).toBe(24);
    expect(mergeFooterPatch(base, { logoHeightMobile: 999 }).logoHeightMobile).toBe(72);
    expect(mergeFooterPatch(base, { logoHeightMobile: 1 }).logoHeightMobile).toBe(20);
  });

  it("detects dirty draft footer", () => {
    const published = defaultSiteFooter();
    expect(isFooterDraftDirty(published, null)).toBe(false);
    expect(
      isFooterDraftDirty(published, { ...published, tagline: "Anders" }),
    ).toBe(true);
  });

  it("effective footer prefers draft then published then default", () => {
    const published = { ...defaultSiteFooter(), tagline: "Published" };
    const draft = { ...defaultSiteFooter(), tagline: "Draft" };
    expect(effectiveSiteFooter(published, draft).tagline).toBe("Draft");
    expect(effectiveSiteFooter(published, null).tagline).toBe("Published");
    expect(effectiveSiteFooter(undefined, null).tagline).toContain("karakter");
  });

  it("migrates persisted state without footer to defaults", () => {
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
    expect(parseSiteFooter(result.state.footer)?.copyright).toContain("McCoy");
    expect(result.state.footerDraft).toBeNull();
  });
});
