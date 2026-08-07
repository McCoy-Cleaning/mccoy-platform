import { describe, expect, it } from "vitest";
import { CURRENT_LAYOUT_VERSION } from "../sections";
import {
  defaultSectionContent,
  type HomeHeroContent,
  type PartnersContent,
  type StatsContent,
  type WorkGalleryContent,
} from "../content";
import { defaultFixedLayout } from "../layout";
import type { BuiltinCmsPage } from "../types";
import {
  homeHeroMigrationBlockId,
  mapHomeHeroToHeroBlockData,
  remapHomeHeroEnFieldDrafts,
  resolveHomeHeroBlocksLayout,
  suppressedHomeHeroFixedKeys,
} from "./home-hero-blocks";

function homePage(overrides: Partial<BuiltinCmsPage> = {}): BuiltinCmsPage {
  return {
    id: "page_home",
    slug: "/",
    title: "Home",
    description: "",
    kind: "builtin",
    isCustom: false,
    inNav: true,
    pageKey: "home",
    blocks: [],
    layout: defaultFixedLayout("home"),
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionContent: {
      "home.hero": defaultSectionContent("home.hero") as HomeHeroContent,
      "home.partners": defaultSectionContent("home.partners") as PartnersContent,
      "home.stats": defaultSectionContent("home.stats") as StatsContent,
      "home.workGallery": defaultSectionContent("home.workGallery") as WorkGalleryContent,
    },
    updatedAt: 1,
    version: 1,
    ...overrides,
  };
}

describe("mapHomeHeroToHeroBlockData", () => {
  it("maps heading/body/CTAs into hero block fields", () => {
    const { data } = mapHomeHeroToHeroBlockData({
      eyebrow: "Live Clean",
      heading: "Bij McCoy wordt kwaliteit",
      headingAccent: "zichtbaar.",
      body: "Body copy",
      secondaryCta: {
        label: "Bekijk onze diensten",
        link: { type: "internal_route", route: "services" },
      },
    });
    expect(data.title).toBe("Bij McCoy wordt kwaliteit");
    expect(data.subtitle).toBe("Body copy");
    expect(data.headingAccent).toEqual({ accent: "zichtbaar." });
    expect(data.trustItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: "25+", label: "Jaar ervaring" }),
      ]),
    );
  });
});

describe("resolveHomeHeroBlocksLayout", () => {
  it("replaces fixed home.hero with a deterministic hero block", () => {
    const page = homePage();
    const first = resolveHomeHeroBlocksLayout(page);
    expect(first.changed).toBe(true);
    expect(first.report.createdBlocks).toHaveLength(1);
    const heroId = homeHeroMigrationBlockId("page_home");
    expect(first.page.blocks.some((b) => b.id === heroId && b.type === "hero")).toBe(true);
    expect(first.page.layout.some((i) => i.kind === "fixed" && i.key === "home.hero")).toBe(
      false,
    );
    expect(first.page.layout.some((i) => i.kind === "block" && i.blockId === heroId)).toBe(
      true,
    );
    expect(first.page.homeHeroBlocksMigration?.status).toBe("migrated");

    const second = resolveHomeHeroBlocksLayout(first.page);
    expect(second.changed).toBe(false);
  });

  it("is a no-op for non-home pages", () => {
    const page = homePage({ pageKey: "about", id: "page_about" });
    const result = resolveHomeHeroBlocksLayout(page);
    expect(result.changed).toBe(false);
  });

  it("suppresses fixed home.hero when migrated block is present", () => {
    const migrated = resolveHomeHeroBlocksLayout(homePage()).page;
    const suppressed = suppressedHomeHeroFixedKeys(migrated);
    expect(suppressed.has("home.hero")).toBe(true);
  });
});

describe("remapHomeHeroEnFieldDrafts", () => {
  it("moves section EN drafts onto the migrated hero block paths", () => {
    const id = homeHeroMigrationBlockId("page_home");
    const remapped = remapHomeHeroEnFieldDrafts({
      pageId: "page_home",
      enFieldDrafts: {
        "section:home.hero:heading": "EN hero",
        "section:home.hero:body": "EN body",
      },
      enFieldDraftSources: {
        "section:home.hero:heading": "NL",
      },
    });
    expect(remapped.enFieldDrafts[`block:${id}:title`]).toBe("EN hero");
    expect(remapped.enFieldDrafts[`block:${id}:subtitle`]).toBe("EN body");
    expect(remapped.enFieldDrafts["section:home.hero:heading"]).toBeUndefined();
    expect(remapped.localePathsRemapped).toBe(2);
  });
});
