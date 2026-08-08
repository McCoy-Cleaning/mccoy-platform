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
    assertFactOnlyJsonLd(head.jsonLd);
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
});
