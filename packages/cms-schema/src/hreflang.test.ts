import { describe, expect, it } from "vitest";
import {
  acceptHreflangPair,
  assertReciprocalHreflangPair,
  getPublishedLocaleAlternates,
  isEnglishLegalDutchBleed,
  isHreflangEligibleLocale,
  robotsIndicateNoindex,
} from "./index";
import { ensurePageLocaleFields } from "./migrate-locale";
import { buildCmsHeadFromSnapshot, resolvePublishedCmsPage } from "./resolve";
import type { BuiltinCmsPage } from "./types";

describe("robotsIndicateNoindex", () => {
  it("detects noindex tokens", () => {
    expect(robotsIndicateNoindex("noindex,follow")).toBe(true);
    expect(robotsIndicateNoindex("index, follow")).toBe(false);
    expect(robotsIndicateNoindex(undefined)).toBe(false);
  });
});

describe("isHreflangEligibleLocale", () => {
  it("requires published + indexable", () => {
    expect(
      isHreflangEligibleLocale({ publicationState: "published", indexable: true }),
    ).toBe(true);
    expect(
      isHreflangEligibleLocale({ publicationState: "draft", indexable: true }),
    ).toBe(false);
    expect(
      isHreflangEligibleLocale({
        publicationState: "published",
        robots: "noindex,follow",
      }),
    ).toBe(false);
    expect(
      isHreflangEligibleLocale({ publicationState: "published", indexable: false }),
    ).toBe(false);
  });
});

describe("getPublishedLocaleAlternates indexable gate", () => {
  it("omits EN when published but not indexable (no hreflang to noindex)", () => {
    const alts = getPublishedLocaleAlternates(
      { nl: "/terms", en: "/terms" },
      {
        nl: { publicationState: "published", indexable: true },
        en: { publicationState: "published", indexable: false },
      },
      { origin: "https://www.mccoy.nl" },
    );
    expect(alts.map((a) => a.locale)).toEqual(["nl", "x-default"]);
  });
});

describe("acceptHreflangPair / reciprocity", () => {
  const nlAlts = [
    { locale: "nl", url: "https://www.mccoy.nl/services" },
    { locale: "en", url: "https://www.mccoy.nl/en/services" },
    { locale: "x-default", url: "https://www.mccoy.nl/services" },
  ];
  const enAlts = [
    { locale: "nl", url: "https://www.mccoy.nl/services" },
    { locale: "en", url: "https://www.mccoy.nl/en/services" },
    { locale: "x-default", url: "https://www.mccoy.nl/services" },
  ];

  it("accepts reciprocal published 200 indexable pair", () => {
    const result = assertReciprocalHreflangPair({
      nl: { canonical: "https://www.mccoy.nl/services", alternates: nlAlts },
      en: {
        canonical: "https://www.mccoy.nl/en/services",
        alternates: enAlts,
        published: true,
        httpStatus: 200,
      },
    });
    expect(result).toEqual({ ok: true });
  });

  it("rejects hreflang toward unpublished peer", () => {
    const result = acceptHreflangPair({
      originLocale: "nl",
      originCanonical: "https://www.mccoy.nl/services",
      originInLanguage: "nl",
      originAlternates: nlAlts,
      peer: {
        published: false,
        httpStatus: 302,
        canonical: "https://www.mccoy.nl/en/services",
        inLanguage: "en",
        alternates: [{ locale: "nl", url: "https://www.mccoy.nl/services" }],
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.some((r) => /unpublished|HTTP 302/.test(r))).toBe(true);
  });

  it("rejects hreflang toward noindex peer", () => {
    const result = acceptHreflangPair({
      originLocale: "nl",
      originCanonical: "https://www.mccoy.nl/terms",
      originInLanguage: "nl",
      originAlternates: [
        { locale: "nl", url: "https://www.mccoy.nl/terms" },
        { locale: "en", url: "https://www.mccoy.nl/en/terms" },
      ],
      peer: {
        published: true,
        httpStatus: 200,
        canonical: "https://www.mccoy.nl/en/terms",
        inLanguage: "en",
        robots: "noindex,follow",
        alternates: [{ locale: "nl", url: "https://www.mccoy.nl/terms" }],
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.some((r) => /noindex/.test(r))).toBe(true);
  });

  it("rejects missing reciprocal hreflang", () => {
    const result = acceptHreflangPair({
      originLocale: "nl",
      originCanonical: "https://www.mccoy.nl/about",
      originInLanguage: "nl",
      originAlternates: [
        { locale: "nl", url: "https://www.mccoy.nl/about" },
        { locale: "en", url: "https://www.mccoy.nl/en/about" },
      ],
      peer: {
        published: true,
        httpStatus: 200,
        canonical: "https://www.mccoy.nl/en/about",
        inLanguage: "en",
        alternates: [{ locale: "en", url: "https://www.mccoy.nl/en/about" }],
      },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reasons.some((r) => /reciprocate/.test(r))).toBe(true);
  });
});

function legalPage(enOverlays: Record<string, string> | null): BuiltinCmsPage {
  return ensurePageLocaleFields({
    id: "page_terms",
    kind: "builtin",
    isCustom: false,
    pageKey: "terms",
    slug: "/terms",
    title: "Algemene voorwaarden",
    description: "NL terms",
    inNav: false,
    blocks: [],
    layout: [],
    layoutVersion: 0,
    sectionContent: {
      "terms.main": {
        heading: "Algemene Voorwaarden",
        articles: [{ id: "a1", title: "Artikel 1", body: "Nederlandse tekst." }],
      },
    },
    updatedAt: 1,
    version: 1,
    paths: { nl: "/terms", en: "/terms" },
    localeContent: {
      nl: {
        navigationLabel: "Voorwaarden",
        pageTitle: "Algemene voorwaarden",
        seo: { title: "Algemene Voorwaarden — McCoy Cleaning", description: "NL" },
      },
      en: {
        navigationLabel: "Terms",
        pageTitle: enOverlays ? "Terms and conditions" : "Algemene voorwaarden",
        seo: {
          title: enOverlays ? "Terms — McCoy Cleaning" : "Algemene Voorwaarden — McCoy Cleaning",
          description: "EN or NL",
        },
      },
    },
    localeStates: {
      nl: { publicationState: "published", freshness: "current" },
      en: { publicationState: "published", freshness: "current" },
    },
    enFieldDrafts: enOverlays ?? {},
  }) as BuiltinCmsPage;
}

describe("English legal Dutch bleed", () => {
  it("detects /en/terms without EN overlays", () => {
    expect(isEnglishLegalDutchBleed(legalPage(null))).toBe(true);
    expect(
      isEnglishLegalDutchBleed(
        legalPage({ "section:terms.main:heading": "Terms and Conditions" }),
      ),
    ).toBe(false);
  });

  it("noindexes bleed EN and omits EN from NL hreflang", () => {
    const page = legalPage(null);
    const en = resolvePublishedCmsPage({
      page,
      revisionId: "r1",
      publishedAt: "2026-08-11T00:00:00Z",
      locale: "en",
      site: { origin: "https://www.mccoy.nl" },
    });
    expect(en.ok).toBe(true);
    if (!en.ok) return;
    expect(en.snapshot.content.seo.robots).toMatch(/noindex/i);
    expect(en.snapshot.alternates).toEqual([]);
    expect(en.snapshot.path).toBe("/en/terms");

    const head = buildCmsHeadFromSnapshot(en.snapshot, { origin: "https://www.mccoy.nl" });
    expect(head.meta.find((m) => m.property === "og:locale")?.content).toBe("en_GB");
    expect(head.meta.find((m) => m.name === "robots")?.content).toMatch(/noindex/i);
    expect(head.links.filter((l) => l.rel === "alternate")).toEqual([]);

    const nl = resolvePublishedCmsPage({
      page,
      revisionId: "r1",
      publishedAt: "2026-08-11T00:00:00Z",
      locale: "nl",
      site: { origin: "https://www.mccoy.nl" },
    });
    expect(nl.ok).toBe(true);
    if (!nl.ok) return;
    expect(nl.snapshot.alternates.map((a) => a.locale)).toEqual(["nl", "x-default"]);
  });

  it("keeps reciprocal hreflang when EN legal overlays exist", () => {
    const page = legalPage({
      "section:terms.main:heading": "Terms and Conditions",
    });
    const nl = resolvePublishedCmsPage({
      page,
      revisionId: "r1",
      publishedAt: "2026-08-11T00:00:00Z",
      locale: "nl",
      site: { origin: "https://www.mccoy.nl" },
    });
    const en = resolvePublishedCmsPage({
      page,
      revisionId: "r1",
      publishedAt: "2026-08-11T00:00:00Z",
      locale: "en",
      site: { origin: "https://www.mccoy.nl" },
    });
    expect(nl.ok && en.ok).toBe(true);
    if (!nl.ok || !en.ok) return;
    expect(en.snapshot.content.seo.robots).toBeUndefined();
    const result = assertReciprocalHreflangPair({
      nl: {
        canonical: "https://www.mccoy.nl/terms",
        alternates: nl.snapshot.alternates.map((a) => ({ locale: a.locale, url: a.url })),
      },
      en: {
        canonical: "https://www.mccoy.nl/en/terms",
        alternates: en.snapshot.alternates.map((a) => ({ locale: a.locale, url: a.url })),
        published: true,
        httpStatus: 200,
      },
    });
    expect(result).toEqual({ ok: true });
  });
});

describe("locale body smoke (resolve overlays)", () => {
  it("NL URL resolves Dutch hero; EN URL resolves English overlay H1", () => {
    const page = ensurePageLocaleFields({
      id: "page_home",
      kind: "builtin",
      isCustom: false,
      pageKey: "home",
      slug: "/",
      title: "Home",
      description: "desc",
      inNav: true,
      blocks: [],
      layout: [],
      layoutVersion: 0,
      sectionContent: {
        "home.hero": { heading: "Schoonmaak met karakter", body: "NL alinea" },
      },
      updatedAt: 1,
      version: 1,
      paths: { nl: "/", en: "/" },
      localeContent: {
        nl: {
          navigationLabel: "Home",
          pageTitle: "Home",
          seo: { title: "Home NL", description: "NL" },
        },
        en: {
          navigationLabel: "Home",
          pageTitle: "Home",
          seo: { title: "Home EN", description: "EN" },
        },
      },
      localeStates: {
        nl: { publicationState: "published", freshness: "current" },
        en: { publicationState: "published", freshness: "current" },
      },
      enFieldDrafts: {
        "section:home.hero:heading": "Cleaning with character",
        "section:home.hero:body": "EN paragraph",
      },
    }) as BuiltinCmsPage;

    const nl = resolvePublishedCmsPage({
      page,
      revisionId: "r1",
      publishedAt: "2026-08-11T00:00:00Z",
      locale: "nl",
      site: { origin: "https://www.mccoy.nl" },
    });
    const en = resolvePublishedCmsPage({
      page,
      revisionId: "r1",
      publishedAt: "2026-08-11T00:00:00Z",
      locale: "en",
      site: { origin: "https://www.mccoy.nl" },
    });
    expect(nl.ok && en.ok).toBe(true);
    if (!nl.ok || !en.ok) return;

    const nlHero =
      nl.snapshot.page.kind === "builtin"
        ? (nl.snapshot.page.sectionContent["home.hero"] as { heading: string; body: string })
        : null;
    const enHero =
      en.snapshot.page.kind === "builtin"
        ? (en.snapshot.page.sectionContent["home.hero"] as { heading: string; body: string })
        : null;
    expect(nlHero?.heading).toBe("Schoonmaak met karakter");
    expect(enHero?.heading).toBe("Cleaning with character");
    expect(enHero?.body).toBe("EN paragraph");

    const nlHead = buildCmsHeadFromSnapshot(nl.snapshot, { origin: "https://www.mccoy.nl" });
    const enHead = buildCmsHeadFromSnapshot(en.snapshot, { origin: "https://www.mccoy.nl" });
    expect(nlHead.links.find((l) => l.rel === "canonical")?.href).toBe("https://www.mccoy.nl");
    expect(enHead.links.find((l) => l.rel === "canonical")?.href).toBe("https://www.mccoy.nl/en");
    expect(nlHead.meta.find((m) => m.property === "og:locale")?.content).toBe("nl_NL");
    expect(enHead.meta.find((m) => m.property === "og:locale")?.content).toBe("en_GB");
    expect(nl.snapshot.locale).toBe("nl");
    expect(en.snapshot.locale).toBe("en");
  });
});
