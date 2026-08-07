import { describe, expect, it } from "vitest";
import { CURRENT_LAYOUT_VERSION } from "../sections";
import { defaultSectionContent, type AboutMainContent } from "../content";
import { defaultFixedLayout } from "../layout";
import type { BuiltinCmsPage } from "../types";
import {
  aboutMigrationBlockId,
  mapAboutIntroToCenteredData,
  mapAboutPillarToTextImageData,
  remapAboutEnFieldDrafts,
  resolveAboutBlocksLayout,
  suppressedAboutFixedKeys,
} from "./about-blocks";

function aboutPage(overrides: Partial<BuiltinCmsPage> = {}): BuiltinCmsPage {
  return {
    id: "page_about",
    slug: "/about",
    title: "Over ons",
    description: "",
    kind: "builtin",
    isCustom: false,
    inNav: true,
    pageKey: "about",
    blocks: [],
    layout: defaultFixedLayout("about"),
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionContent: {
      "about.main": defaultSectionContent("about.main") as AboutMainContent,
    },
    updatedAt: 1,
    version: 1,
    ...overrides,
  };
}

describe("mapAboutIntroToCenteredData", () => {
  it("preserves Over ons eyebrow/heading and seeds pillar tiles", () => {
    const { data } = mapAboutIntroToCenteredData({
      eyebrow: "Over ons",
      heading: "Kwaliteit, missie & visie",
    });
    expect(data.presentation).toBe("aboutIntro");
    expect(data.title).toBe("Kwaliteit, missie & visie");
    expect(Array.isArray(data.pillars)).toBe(true);
    expect((data.pillars as unknown[]).length).toBe(4);
  });
});

describe("mapAboutPillarToTextImageData", () => {
  it("maps mission fields with aboutPillar presentation", () => {
    const { data } = mapAboutPillarToTextImageData(
      {
        missionTitle: "Missie",
        missionBody: "Body",
      },
      "mission",
      0,
    );
    expect(data.presentation).toBe("aboutPillar");
    expect(data.title).toBe("Missie");
    expect(data.tag).toBe("01");
    expect(data.icon).toBe("target");
  });
});

describe("resolveAboutBlocksLayout", () => {
  it("replaces fixed about.main with intro + three pillars", () => {
    const first = resolveAboutBlocksLayout(aboutPage());
    expect(first.changed).toBe(true);
    expect(first.report.createdBlocks).toHaveLength(4);
    expect(first.page.layout.some((i) => i.kind === "fixed" && i.key === "about.main")).toBe(
      false,
    );
    const introId = aboutMigrationBlockId("page_about", "intro");
    expect(first.page.blocks.some((b) => b.id === introId && b.type === "centered")).toBe(true);
    expect(first.page.aboutBlocksMigration?.status).toBe("migrated");

    const second = resolveAboutBlocksLayout(first.page);
    expect(second.changed).toBe(false);
  });

  it("suppresses fixed about.main when migrated", () => {
    const migrated = resolveAboutBlocksLayout(aboutPage()).page;
    expect(suppressedAboutFixedKeys(migrated).has("about.main")).toBe(true);
  });
});

describe("remapAboutEnFieldDrafts", () => {
  it("moves section EN drafts onto migrated block paths", () => {
    const introId = aboutMigrationBlockId("page_about", "intro");
    const remapped = remapAboutEnFieldDrafts({
      pageId: "page_about",
      enFieldDrafts: {
        "section:about.main:heading": "EN heading",
        "section:about.main:missionTitle": "EN mission",
      },
      enFieldDraftSources: {},
    });
    expect(remapped.enFieldDrafts[`block:${introId}:title`]).toBe("EN heading");
    expect(remapped.enFieldDrafts["section:about.main:heading"]).toBeUndefined();
  });
});
