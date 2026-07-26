import { describe, expect, it } from "vitest";
import {
  buildCmsHeadFromSnapshot,
  resolveLocaleForRequest,
  resolvePublishedCmsPage,
} from "./resolve";
import { ensurePageLocaleFields } from "./migrate-locale";
import type { BuiltinCmsPage } from "./types";

function samplePage(enPublished: boolean): BuiltinCmsPage {
  return ensurePageLocaleFields({
    id: "page_home",
    kind: "builtin",
    isCustom: false,
    pageKey: "home",
    slug: "/",
    title: "Home",
    description: "NL desc",
    inNav: true,
    blocks: [],
    layout: [],
    layoutVersion: 0,
    sectionContent: {},
    updatedAt: 1,
    version: 1,
    paths: { nl: "/", en: "/" },
    localeContent: {
      nl: {
        navigationLabel: "Home",
        pageTitle: "Home NL",
        seo: { title: "NL Title", description: "NL desc" },
      },
      en: {
        navigationLabel: "Home",
        pageTitle: "Home EN",
        seo: { title: "EN Title", description: "EN desc" },
      },
    },
    localeStates: {
      nl: { publicationState: "published", freshness: "current" },
      en: {
        publicationState: enPublished ? "published" : "draft",
        freshness: enPublished ? "current" : "unknown",
      },
    },
  }) as BuiltinCmsPage;
}

describe("resolvePublishedCmsPage", () => {
  it("builds EN snapshot only when EN is published", () => {
    const ok = resolvePublishedCmsPage({
      page: samplePage(true),
      revisionId: "rev_1",
      publishedAt: "2026-07-19T12:00:00Z",
      locale: "en",
      site: { origin: "https://www.mccoy.nl" },
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.snapshot.content.seo.title).toBe("EN Title");
    expect(ok.snapshot.path).toBe("/en");
    expect(ok.snapshot.alternates.some((a) => a.locale === "en")).toBe(true);
  });

  it("rejects EN when not published (never Dutch under EN URL)", () => {
    const bad = resolvePublishedCmsPage({
      page: samplePage(false),
      revisionId: "rev_1",
      publishedAt: "2026-07-19T12:00:00Z",
      locale: "en",
      site: { origin: "https://www.mccoy.nl" },
    });
    expect(bad.ok).toBe(false);
  });

  it("head and body share the same snapshot fields", () => {
    const resolved = resolvePublishedCmsPage({
      page: samplePage(true),
      revisionId: "rev_1",
      publishedAt: "2026-07-19T12:00:00Z",
      locale: "nl",
      site: { origin: "https://www.mccoy.nl" },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const head = buildCmsHeadFromSnapshot(resolved.snapshot, {
      origin: "https://www.mccoy.nl",
    });
    expect(head.title).toBe(resolved.snapshot.content.seo.title);
    expect(head.links.some((l) => l.rel === "canonical")).toBe(true);
    expect(head.jsonLd.inLanguage).toBe("nl");
  });
  it("overlays enFieldDrafts onto section body for EN snapshots", () => {
    const page = samplePage(true);
    page.sectionContent = {
      "home.hero": {
        heading: "NL hero",
        body: "NL body",
      },
    } as BuiltinCmsPage["sectionContent"];
    page.enFieldDrafts = {
      "section:home.hero:heading": "EN hero",
    };
    const resolved = resolvePublishedCmsPage({
      page,
      revisionId: "rev_1",
      publishedAt: "2026-07-19T12:00:00Z",
      locale: "en",
      site: { origin: "https://www.mccoy.nl" },
    });
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const hero = resolved.snapshot.page.kind === "builtin"
      ? resolved.snapshot.page.sectionContent["home.hero"]
      : undefined;
    expect(hero).toMatchObject({ heading: "EN hero", body: "NL body" });
    expect(resolved.snapshot.sections.find((s) => s.key === "home.hero")?.content).toMatchObject({
      heading: "EN hero",
    });
  });
});

describe("resolveLocaleForRequest", () => {
  it("uses URL locale for public requests", () => {
    expect(resolveLocaleFromUrlLike("/en/services")).toEqual({
      locale: "en",
      source: "url",
    });
  });

  it("honours _cmsLocale only for authenticated preview", () => {
    expect(
      resolveLocaleForRequest({
        pathname: "/services",
        previewLocale: "en",
        authenticatedPreview: true,
      }),
    ).toEqual({ locale: "en", source: "authenticated_preview" });
    expect(
      resolveLocaleForRequest({
        pathname: "/services",
        previewLocale: "en",
        authenticatedPreview: false,
      }),
    ).toEqual({ locale: "nl", source: "url" });
  });
});

function resolveLocaleFromUrlLike(pathname: string) {
  return resolveLocaleForRequest({
    pathname,
    previewLocale: null,
    authenticatedPreview: false,
  });
}
