import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  CMS_SCHEMA_VERSION,
  type BuiltinCmsPage,
  type CmsPage,
} from "@mccoy/cms-schema";
import { HomePageLoadingShell } from "@/components/site/HomePageLoadingShell";
import { PageLayoutRenderer } from "@/components/site/PageLayoutRenderer";
import { publishedClientSnapshotForPage } from "./route-page-loader";
import { describe, expect, it } from "vitest";

function EagerHeroRenderer({ blocks }: { blocks: CmsPage["blocks"] }) {
  const title = String(blocks[0]?.data && "title" in blocks[0].data ? blocks[0].data.title : "");
  return createElement("section", { "data-cms-block-type": "hero" }, title);
}

function publishedHome(): BuiltinCmsPage {
  return {
    kind: "builtin",
    isCustom: false,
    pageKey: "home",
    id: "page_home",
    slug: "/",
    title: "Home",
    description: "Published home",
    inNav: true,
    blocks: [
      {
        id: "hero-block",
        type: "hero",
        data: {
          title: "Published Hero",
          subtitle: "Trusted loader content",
          align: "left",
        },
      },
    ],
    layout: [
      {
        id: "block:hero-block",
        kind: "block",
        blockId: "hero-block",
      },
      {
        id: "fixed:home:partners",
        kind: "fixed",
        key: "home.partners",
        hidden: false,
      },
      {
        id: "fixed:home:stats",
        kind: "fixed",
        key: "home.stats",
        hidden: false,
      },
      {
        id: "fixed:home:workGallery",
        kind: "fixed",
        key: "home.workGallery",
        hidden: false,
      },
    ],
    layoutVersion: 1,
    homeHeroBlocksMigration: {
      version: 1,
      status: "migrated",
      sources: ["home.hero"],
    },
    sectionContent: {},
    updatedAt: 2,
    version: CMS_SCHEMA_VERSION,
    localeStates: {
      nl: { publicationState: "published", freshness: "current" },
      en: { publicationState: "missing", freshness: "unknown" },
    },
    paths: { nl: "/" },
    localeContent: {
      nl: {
        navigationLabel: "Home",
        pageTitle: "Home",
        seo: { title: "Home", description: "Published home" },
      },
    },
  };
}

function PartnersMarker() {
  return createElement("section", { "data-testid": "partners" }, "Published Partners");
}

function BelowFoldMarker() {
  return createElement("section", { "aria-hidden": true });
}

describe("storefront first render", () => {
  it("renders the persisted Hero before Partners without a lazy block fallback", () => {
    const html = renderToStaticMarkup(
      createElement(PageLayoutRenderer, {
        page: publishedHome(),
        pageKey: "home",
        renderers: {
          home: {
            "home.partners": PartnersMarker,
            "home.stats": BelowFoldMarker,
            "home.workGallery": BelowFoldMarker,
          },
        },
        blocksRenderer: EagerHeroRenderer,
        mode: "public",
        respectHidden: true,
      }),
    );

    expect(html).toContain("Published Hero");
    expect(html).toContain("Published Partners");
    expect(html.indexOf("Published Hero")).toBeLessThan(
      html.indexOf("Published Partners"),
    );
    expect(html).not.toContain("min-h-[12rem]");
  });

  it("lazy default block renderer would paint Partners beside an empty hero hole", () => {
    const html = renderToStaticMarkup(
      createElement(PageLayoutRenderer, {
        page: publishedHome(),
        pageKey: "home",
        renderers: {
          home: {
            "home.partners": PartnersMarker,
            "home.stats": BelowFoldMarker,
            "home.workGallery": BelowFoldMarker,
          },
        },
        mode: "public",
        respectHidden: true,
      }),
    );

    expect(html).not.toContain("Published Hero");
    expect(html).toContain("Published Partners");
    expect(html).toContain("min-h-[12rem]");
    expect(html.indexOf("min-h-[12rem]")).toBeLessThan(html.indexOf("Published Partners"));
  });

  it("uses a stable viewport shell with no fabricated CMS section content", () => {
    const html = renderToStaticMarkup(createElement(HomePageLoadingShell));
    expect(html).toContain('data-page-loading-shell="home"');
    expect(html).toContain("min-h-[100svh]");
    expect(html).not.toMatch(/Partners|Published Hero|data-cms-block-type/);
  });

  it("rejects seed, wrong-page, and wrong-locale client snapshots", () => {
    const home = publishedHome();
    expect(publishedClientSnapshotForPage("/", home, false)).toBeNull();
    expect(
      publishedClientSnapshotForPage(
        "/",
        { ...home, id: "page_about", pageKey: "about" } as CmsPage,
        true,
      ),
    ).toBeNull();
    expect(publishedClientSnapshotForPage("/en", home, true)).toBeNull();
  });

  it("preserves persisted layout order while resolving a valid client locale", () => {
    const home = publishedHome();
    const enHome: BuiltinCmsPage = {
      ...home,
      localeStates: {
        nl: home.localeStates!.nl,
        en: { publicationState: "published", freshness: "current" },
      },
      paths: { nl: "/", en: "/en" },
      localeContent: {
        nl: home.localeContent!.nl,
        en: {
          navigationLabel: "Home",
          pageTitle: "Home",
          seo: { title: "Home", description: "Published English home" },
        },
      },
    };
    const result = publishedClientSnapshotForPage("/en", enHome, true);
    expect(result?.snapshot.locale).toBe("en");
    const resolvedIds = result?.snapshot.page.layout.map((item) => item.id) ?? [];
    expect(resolvedIds.indexOf("block:hero-block")).toBeGreaterThanOrEqual(0);
    expect(resolvedIds.indexOf("fixed:home:partners")).toBeGreaterThan(
      resolvedIds.indexOf("block:hero-block"),
    );
    const sourceIds = enHome.layout.map((item) => item.id);
    expect(sourceIds.indexOf("fixed:home:partners")).toBeGreaterThan(
      sourceIds.indexOf("block:hero-block"),
    );
  });
});
