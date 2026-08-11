import { describe, expect, it } from "vitest";
import {
  absoluteCanonicalUrl,
  assertFactOnlyJsonLd,
  CANONICAL_SITE_ORIGIN,
  resolveCanonicalOrigin,
  resolveSeoMetadata,
} from "./resolve-seo";
import { buildCmsHeadFromSnapshot, resolvePublishedCmsPage } from "./resolve";
import { ensurePageLocaleFields } from "./migrate-locale";
import type { BuiltinCmsPage } from "./types";

function samplePage(): BuiltinCmsPage {
  return ensurePageLocaleFields({
    id: "page_contact",
    kind: "builtin",
    isCustom: false,
    pageKey: "contact",
    slug: "/contact",
    title: "Contact",
    description: "Contact",
    inNav: true,
    blocks: [],
    layout: [],
    layoutVersion: 0,
    sectionContent: {},
    updatedAt: 1,
    version: 1,
    paths: { nl: "/contact", en: "/contact" },
    localeContent: {
      nl: {
        navigationLabel: "Contact",
        pageTitle: "Contact",
        seo: { title: "CMS Title", description: "CMS desc" },
      },
    },
    localeStates: {
      nl: { publicationState: "published", freshness: "current" },
    },
  }) as BuiltinCmsPage;
}

describe("resolveCanonicalOrigin", () => {
  it("never promotes preview/localhost to canonical", () => {
    expect(resolveCanonicalOrigin("https://mccoy-platform-git-x.vercel.app")).toBe(
      CANONICAL_SITE_ORIGIN,
    );
    expect(resolveCanonicalOrigin("http://localhost:3000")).toBe(CANONICAL_SITE_ORIGIN);
    expect(resolveCanonicalOrigin("https://admin.mccoy.nl")).toBe(CANONICAL_SITE_ORIGIN);
    expect(resolveCanonicalOrigin("https://www.mccoy.nl")).toBe(CANONICAL_SITE_ORIGIN);
  });
});

describe("resolveSeoMetadata", () => {
  it("emits absolute www canonical and preserves frozen titles (SEO-7 ≠ SEO-8)", () => {
    const resolved = resolvePublishedCmsPage({
      page: samplePage(),
      revisionId: "r1",
      publishedAt: "2026-08-08T00:00:00Z",
      locale: "nl",
      site: { origin: "https://preview.vercel.app" },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const head = resolveSeoMetadata(resolved.snapshot, { origin: "https://preview.vercel.app" }, {
      seo: {
        title: "Contact — Schoonmaak Twente | McCoy Cleaning",
        description: "Frozen deployed description",
      },
    });
    expect(head.title).toBe("Contact — Schoonmaak Twente | McCoy Cleaning");
    expect(head.links.find((l) => l.rel === "canonical")?.href).toBe(
      "https://www.mccoy.nl/contact",
    );
    expect(head.meta.find((m) => m.property === "og:url")?.content).toBe(
      "https://www.mccoy.nl/contact",
    );
    expect(head.meta.some((m) => m.name === "keywords")).toBe(false);
    assertFactOnlyJsonLd(head.jsonLd);
  });

  it("does not emit ranking keywords meta even when seo.keywords is set", () => {
    const resolved = resolvePublishedCmsPage({
      page: samplePage(),
      revisionId: "r1",
      publishedAt: "2026-08-08T00:00:00Z",
      locale: "nl",
      site: { origin: CANONICAL_SITE_ORIGIN },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const head = resolveSeoMetadata(resolved.snapshot, { origin: CANONICAL_SITE_ORIGIN }, {
      seo: {
        title: "Contact — McCoy Cleaning Twente | Oldenzaal",
        description: "Desc",
        keywords: "stuffed, keywords, for, ranking",
      },
    });
    expect(head.meta.some((m) => m.name === "keywords")).toBe(false);
  });

  it("buildCmsHeadFromSnapshot uses absolute www even when site origin is wrong", () => {
    const resolved = resolvePublishedCmsPage({
      page: samplePage(),
      revisionId: "r1",
      publishedAt: "2026-08-08T00:00:00Z",
      locale: "nl",
      site: { origin: "http://127.0.0.1:5173" },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const head = buildCmsHeadFromSnapshot(resolved.snapshot, {
      origin: "http://127.0.0.1:5173",
    });
    expect(head.links.find((l) => l.rel === "canonical")?.href).toBe(
      absoluteCanonicalUrl("/contact"),
    );
  });

  it("rejects invented review JSON-LD", () => {
    expect(() =>
      assertFactOnlyJsonLd({
        "@type": "LocalBusiness",
        aggregateRating: { "@type": "AggregateRating", ratingValue: 5 },
      }),
    ).toThrow(/ratings/);
  });

  it("sets og:locale to match URL locale (nl_NL / en_GB)", () => {
    const page = samplePage();
    page.paths = { nl: "/contact", en: "/contact" };
    page.localeContent = {
      ...page.localeContent!,
      en: {
        navigationLabel: "Contact",
        pageTitle: "Contact",
        seo: { title: "Contact EN", description: "EN desc" },
      },
    };
    page.localeStates = {
      nl: { publicationState: "published", freshness: "current" },
      en: { publicationState: "published", freshness: "current" },
    };

    const nl = resolvePublishedCmsPage({
      page,
      revisionId: "r1",
      publishedAt: "2026-08-08T00:00:00Z",
      locale: "nl",
      site: { origin: "https://www.mccoy.nl" },
    });
    const en = resolvePublishedCmsPage({
      page,
      revisionId: "r1",
      publishedAt: "2026-08-08T00:00:00Z",
      locale: "en",
      site: { origin: "https://www.mccoy.nl" },
    });
    expect(nl.ok && en.ok).toBe(true);
    if (!nl.ok || !en.ok) return;
    const nlHead = resolveSeoMetadata(nl.snapshot, { origin: CANONICAL_SITE_ORIGIN });
    const enHead = resolveSeoMetadata(en.snapshot, { origin: CANONICAL_SITE_ORIGIN });
    expect(nlHead.meta.find((m) => m.property === "og:locale")?.content).toBe("nl_NL");
    expect(enHead.meta.find((m) => m.property === "og:locale")?.content).toBe("en_GB");
    expect(nlHead.links.find((l) => l.rel === "canonical")?.href).toBe(
      "https://www.mccoy.nl/contact",
    );
    expect(enHead.links.find((l) => l.rel === "canonical")?.href).toBe(
      "https://www.mccoy.nl/en/contact",
    );
  });
});


describe("Phase 11 — single canonical invariant", () => {
  it("emits exactly one self-referencing www canonical link", () => {
    const resolved = resolvePublishedCmsPage({
      page: samplePage(),
      revisionId: "r1",
      publishedAt: "2026-08-08T00:00:00Z",
      locale: "nl",
      site: { origin: "https://preview.vercel.app" },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const head = resolveSeoMetadata(resolved.snapshot, { origin: "https://preview.vercel.app" });
    const canonicals = head.links.filter((l) => l.rel === "canonical");
    expect(canonicals).toHaveLength(1);
    expect(canonicals[0]?.href).toBe("https://www.mccoy.nl/contact");
    expect(head.meta.filter((m) => m.property === "og:url")).toHaveLength(1);
    expect(head.meta.find((m) => m.property === "og:url")?.content).toBe(
      "https://www.mccoy.nl/contact",
    );
  });
});