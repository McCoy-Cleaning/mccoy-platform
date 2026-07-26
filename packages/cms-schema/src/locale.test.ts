import { describe, expect, it } from "vitest";
import {
  CMS_SCHEMA_VERSION,
  assertRedirectValid,
  defaultLocaleStates,
  getPublishedLocaleAlternates,
  hashSourcePayload,
  localeContentFromLegacy,
  migrateAndValidate,
  missingEnglishTranslationMeta,
  normalizeCmsPath,
  normalizeCmsPage,
  pathsFromLegacySlug,
  resolveEnglishPathAccess,
  stripLocalePrefix,
  type CmsPage,
} from "./index";

describe("normalizeCmsPath", () => {
  it("normalizes Dutch paths", () => {
    expect(normalizeCmsPath("nl", "/Services/")).toBe("/services");
    expect(normalizeCmsPath("nl", "about")).toBe("/about");
    expect(normalizeCmsPath("nl", "/")).toBe("/");
  });

  it("prefixes English paths with /en", () => {
    expect(normalizeCmsPath("en", "/services")).toBe("/en/services");
    expect(normalizeCmsPath("en", "/en/services")).toBe("/en/services");
    expect(normalizeCmsPath("en", "/")).toBe("/en");
  });
});

describe("stripLocalePrefix", () => {
  it("detects en prefix", () => {
    expect(stripLocalePrefix("/en/services")).toEqual({ locale: "en", path: "/services" });
    expect(stripLocalePrefix("/en")).toEqual({ locale: "en", path: "/" });
    expect(stripLocalePrefix("/about")).toEqual({ locale: "nl", path: "/about" });
  });
});

describe("resolveEnglishPathAccess", () => {
  it("renders when English is published", () => {
    expect(
      resolveEnglishPathAccess({
        knownPage: true,
        englishPublished: true,
        dutchPath: "/services",
        requestPath: "/en/services",
        redirects: [],
      }).action,
    ).toBe("render");
  });

  it("302 redirects known pending English to Dutch", () => {
    const result = resolveEnglishPathAccess({
      knownPage: true,
      englishPublished: false,
      dutchPath: "/services",
      requestPath: "/en/services",
      redirects: [],
    });
    expect(result).toEqual({
      action: "redirect_pending",
      statusCode: 302,
      toPath: "/services",
    });
  });

  it("uses CmsRedirect for retired English paths", () => {
    const result = resolveEnglishPathAccess({
      knownPage: false,
      englishPublished: false,
      dutchPath: "/services",
      requestPath: "/en/old-services",
      redirects: [
        {
          id: "r1",
          locale: "en",
          fromPath: "/en/old-services",
          toPath: "/en/services",
          statusCode: 301,
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(result).toEqual({
      action: "redirect_retired",
      statusCode: 301,
      toPath: "/en/services",
    });
  });

  it("404s unknown English paths", () => {
    expect(
      resolveEnglishPathAccess({
        knownPage: false,
        englishPublished: false,
        dutchPath: "/",
        requestPath: "/en/unknown",
        redirects: [],
      }).action,
    ).toBe("not_found");
  });
});

describe("assertRedirectValid", () => {
  it("rejects target equal to source", () => {
    const result = assertRedirectValid({
      id: "r1",
      locale: "en",
      fromPath: "/en/a",
      toPath: "/en/a",
      statusCode: 301,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.ok).toBe(false);
  });
});

describe("getPublishedLocaleAlternates", () => {
  it("emits only published locales with absolute URLs", () => {
    const alts = getPublishedLocaleAlternates(
      { nl: "/services", en: "/services" },
      {
        nl: { publicationState: "published" },
        en: { publicationState: "published" },
      },
      { origin: "https://www.mccoy.nl" },
    );
    expect(alts).toEqual([
      { locale: "nl", url: "https://www.mccoy.nl/services", published: true },
      { locale: "en", url: "https://www.mccoy.nl/en/services", published: true },
      { locale: "x-default", url: "https://www.mccoy.nl/services", published: true },
    ]);
  });

  it("omits English when not published", () => {
    const alts = getPublishedLocaleAlternates(
      { nl: "/services", en: "/services" },
      defaultLocaleStates(),
      { origin: "https://www.mccoy.nl/" },
    );
    expect(alts.map((a) => a.locale)).toEqual(["nl", "x-default"]);
  });
});

describe("locale content migration", () => {
  it("wraps Dutch-only pages into localized bags on migrate", () => {
    const raw = {
      schemaVersion: 5,
      pages: [
        {
          id: "page_services",
          slug: "/services",
          title: "Diensten",
          description: "Ons aanbod",
          isCustom: false,
          kind: "builtin",
          pageKey: "services",
          inNav: true,
          blocks: [],
          layout: [],
          layoutVersion: 0,
          sectionContent: {},
          updatedAt: 1,
          version: 1,
        },
      ],
      version: 5,
    };

    const result = migrateAndValidate(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.schemaVersion).toBe(CMS_SCHEMA_VERSION);
    expect(result.state.schemaVersion).toBe(6);
    const page = result.state.pages[0]!;
    expect(page.paths?.nl).toBe("/services");
    expect(page.localeContent?.nl.pageTitle).toBe("Diensten");
    expect(page.localeContent?.nl.seo.description).toBe("Ons aanbod");
    expect(page.localeStates?.en?.publicationState).toBe("missing");
    expect(page.localeStates?.en?.freshness).toBe("unknown");
    expect(page.translationMeta?.page?.publicationState).toBe("missing");
    expect(page.slug).toBe("/services");
    expect(page.title).toBe("Diensten");
  });

  it("is idempotent when locale fields already exist", () => {
    const once = normalizeCmsPage({
      kind: "custom",
      isCustom: true,
      id: "page_x",
      slug: "/mijn-pagina",
      title: "Mijn pagina",
      description: "Beschrijving",
      inNav: false,
      blocks: [],
      layout: [],
      layoutVersion: 0,
      updatedAt: 1,
      version: 2,
    } as CmsPage);

    const twice = normalizeCmsPage(once);
    expect(twice.paths).toEqual(once.paths);
    expect(twice.localeContent).toEqual(once.localeContent);
    expect(twice.localeStates?.en?.publicationState).toBe("missing");
  });

  it("builds locale content and paths from legacy helpers", () => {
    expect(pathsFromLegacySlug("about")).toEqual({ nl: "/about" });
    expect(localeContentFromLegacy("Home", "Desc").nl.seo.title).toBe("Home");
    expect(missingEnglishTranslationMeta(3).sourceRevision).toBe(3);
    expect(hashSourcePayload({ a: 1 })).toMatch(/^[0-9a-f]+$/);
  });
});
