import { describe, expect, it } from "vitest";
import {
  isSafeExternalUrl,
  linkFromLegacyHref,
  parseCmsLink,
  resolveCmsLinkHref,
} from "./links";
import { normalizeSlug, validateCustomSlug } from "./slugs";
import { createPreviewSnapshot, isDraftDirty } from "./draft";
import { migrateAndValidate, parseMigrateNormalizePage } from "./migrate";
import { CMS_SCHEMA_VERSION } from "./types";

describe("links", () => {
  it("rejects javascript: URLs", () => {
    expect(isSafeExternalUrl("javascript:alert(1)")).toBe(false);
    expect(parseCmsLink({ type: "external", url: "javascript:alert(1)" })).toBeNull();
  });

  it("accepts https URLs", () => {
    expect(isSafeExternalUrl("https://example.com/a")).toBe(true);
  });

  it("resolves internal_route and pageId", () => {
    expect(
      resolveCmsLinkHref({ type: "internal_route", route: "about" }, []),
    ).toBe("/about");
    expect(
      resolveCmsLinkHref(
        { type: "internal", pageId: "page_x" },
        [{ id: "page_x", slug: "/custom" }],
      ),
    ).toBe("/custom");
  });

  it("maps legacy hrefs to internal_route", () => {
    expect(linkFromLegacyHref("/services")).toEqual({
      type: "internal_route",
      route: "services",
    });
  });
});

describe("slugs", () => {
  it("normalizes and reserves", () => {
    expect(normalizeSlug("  Hello World ")).toBe("hello-world");
    expect(validateCustomSlug("about", []).ok).toBe(false);
    expect(validateCustomSlug("mijn-pagina", []).ok).toBe(true);
  });
});

describe("draft + preview snapshot", () => {
  it("marks dirty drafts and clones snapshots", () => {
    expect(isDraftDirty({ overrides: { a: "1" } })).toBe(true);
    expect(isDraftDirty({ overrides: {} })).toBe(false);
    const page = parseMigrateNormalizePage({
      id: "p1",
      slug: "/",
      title: "Home",
      description: "",
      isCustom: false,
      inNav: true,
      blocks: [],
      updatedAt: 1,
      version: 1,
    })!;
    const snap = createPreviewSnapshot("p1", page, { k: "v" }, 3);
    page.title = "Changed";
    expect(snap.page.title).toBe("Home");
    expect(snap.overrides.k).toBe("v");
  });
});

describe("migrateAndValidate", () => {
  it("migrates legacy draft overrides map", () => {
    const result = migrateAndValidate({
      pages: [
        {
          id: "page_home",
          slug: "/",
          title: "Home",
          description: "",
          isCustom: false,
          inNav: true,
          blocks: [],
          updatedAt: 1,
        },
      ],
      draft: { page_home: { "hero.title": "Hi" } },
      saved: {},
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.schemaVersion).toBe(CMS_SCHEMA_VERSION);
      expect(result.state.pages[0].layout.length).toBeGreaterThan(0);
      expect(result.state.pages[0].kind).toBe("builtin");
      expect(result.state.draft.page_home.overrides["hero.title"]).toBe("Hi");
      expect(result.state.previewSnapshots).toEqual({});
    }
  });

  it("preserves draft.page.sectionContent through localStorage round-trip", () => {
    const hero = {
      eyebrow: "Edited eyebrow",
      heading: "Edited heading that must persist",
      headingAccent: "zichtbaar.",
      body: "Al meer dan 25 jaar staan wij voor schoonmaak met karakter — uitgevoerd door een vast eigen team, met professionele middelen en een onmiskenbaar oog voor detail. Geen onderaannemers, geen losse krachten: alleen vakmensen die uw pand behandelen alsof het hun eigen pand is.",
      image: {
        assetId: "local:images/cms/hero-cleaning.jpg",
        src: "/images/cms/hero-cleaning.jpg",
        alt: "Hero",
        decorative: false,
      },
      secondaryCta: {
        label: "Bekijk onze diensten",
        link: { type: "internal_route" as const, route: "services" as const },
      },
    };
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
          layout: [],
          layoutVersion: 1,
          sectionContent: {},
          updatedAt: 1,
          version: 1,
        },
      ],
      draft: {
        page_home: {
          overrides: {},
          page: {
            id: "page_home",
            slug: "/",
            title: "Home",
            description: "",
            isCustom: false,
            kind: "builtin",
            pageKey: "home",
            inNav: true,
            blocks: [],
            layout: [],
            layoutVersion: 1,
            sectionContent: { "home.hero": hero },
            updatedAt: 2,
            version: 42,
          },
        },
      },
      saved: {},
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const draftPage = result.state.draft.page_home.page;
      expect(draftPage?.kind).toBe("builtin");
      if (draftPage?.kind === "builtin") {
        expect(draftPage.sectionContent["home.hero"]?.heading).toBe(
          "Edited heading that must persist",
        );
        expect(draftPage.sectionContent["home.hero"]?.eyebrow).toBe("Edited eyebrow");
        expect(draftPage.version).toBe(42);
      }
    }
  });
});