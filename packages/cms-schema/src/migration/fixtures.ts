import type { BuiltinCmsPage, Block } from "../types";
import { CURRENT_LAYOUT_VERSION, type FixedSectionKey } from "../sections";
import { createMigrationBlockId } from "./block-id";
import { FIXED_SECTION_MIGRATION_ROLES } from "./roles";

function basePage(overrides: Partial<BuiltinCmsPage> & { id: string; pageKey: BuiltinCmsPage["pageKey"] }): BuiltinCmsPage {
  return {
    kind: "builtin",
    isCustom: false,
    slug: "/",
    title: "Fixture",
    description: "fixture",
    inNav: true,
    blocks: [],
    layout: [],
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionContent: {},
    updatedAt: 1,
    version: 1,
    ...overrides,
  };
}

function fixedLayout(keys: FixedSectionKey[]) {
  return keys.map((key) => ({
    id: `fixed:${key}` as `fixed:${string}`,
    kind: "fixed" as const,
    key,
    hidden: false,
  }));
}

/** Untouched home layout — classic fixed sections. */
export function fixtureUntouchedHome(): BuiltinCmsPage {
  return basePage({
    id: "page_home",
    pageKey: "home",
    title: "Home",
    layout: fixedLayout(["home.hero", "home.partners", "home.stats", "home.workGallery"]),
    sectionContent: {
      "home.hero": { heading: "NL hero", body: "NL body" },
      "home.partners": { heading: "Partners", items: [] },
      "home.stats": {
        heading: "Stats",
        items: [{ id: "stat_1", value: "25", label: "jaren" }],
      },
      "home.workGallery": { heading: "Werk", items: [] },
    } as unknown as BuiltinCmsPage["sectionContent"],
    enFieldDrafts: {
      "section:home.hero:heading": "EN hero",
    },
  });
}

/** Partially migrated: hero block already present with deterministic ID; other fixed remain. */
export function fixturePartiallyMigratedHome(): BuiltinCmsPage {
  const page = fixtureUntouchedHome();
  const heroId = createMigrationBlockId({
    pageId: page.id,
    fixedKey: "home.hero",
    role: "primary",
  });
  const heroBlock: Block = {
    id: heroId,
    type: "hero",
    data: { title: "NL hero", subtitle: "NL body" },
  };
  page.blocks = [heroBlock];
  page.layout = [
    { id: `block:${heroId}`, kind: "block", blockId: heroId },
    ...fixedLayout(["home.partners", "home.stats", "home.workGallery"]),
  ];
  return page;
}

/** Already fully planned: all deterministic blocks present; no fixed items. */
export function fixtureAlreadyMigratedHome(): BuiltinCmsPage {
  const page = fixtureUntouchedHome();
  const blocks: Block[] = [];
  const layout: BuiltinCmsPage["layout"] = [];
  for (const key of ["home.hero", "home.partners", "home.stats", "home.workGallery"] as FixedSectionKey[]) {
    for (const spec of FIXED_SECTION_MIGRATION_ROLES[key]) {
      const blockId = createMigrationBlockId({ pageId: page.id, fixedKey: key, role: spec.role });
      blocks.push({
        id: blockId,
        // Gate 1 fixtures may reference types registered in Gate 2.
        type: (spec.blockType === "partnersMarquee" ||
        spec.blockType === "statsCounters"
          ? "gallery"
          : spec.blockType) as Block["type"],
        data: {},
      });
      layout.push({ id: `block:${blockId}`, kind: "block", blockId });
    }
  }
  page.blocks = blocks;
  page.layout = layout;
  return page;
}

/** Fixed layout plus an extra user-created custom block in the middle. */
export function fixtureWithExtraCustomBlocks(): BuiltinCmsPage {
  const page = fixtureUntouchedHome();
  const custom: Block = { id: "user_block_cta_1", type: "cta", data: { title: "Custom CTA" } };
  page.blocks = [custom];
  page.layout = [
    page.layout[0]!,
    { id: "block:user_block_cta_1", kind: "block", blockId: custom.id },
    ...page.layout.slice(1),
  ];
  return page;
}

/** Fixed layout but empty sectionContent. */
export function fixtureMissingSectionContent(): BuiltinCmsPage {
  const page = fixtureUntouchedHome();
  page.sectionContent = {} as BuiltinCmsPage["sectionContent"];
  delete page.enFieldDrafts;
  return page;
}

/** Malformed legacy content (non-object section). */
export function fixtureMalformedLegacyContent(): BuiltinCmsPage {
  const page = fixtureUntouchedHome();
  (page.sectionContent as Record<string, unknown>)["home.hero"] = "not-an-object";
  (page.sectionContent as Record<string, unknown>)["home.stats"] = {
    heading: "ok",
    items: [],
    secretField: "should-warn",
  };
  return page;
}

/** About page with NL content + EN overlays. */
export function fixtureAboutNlEn(): BuiltinCmsPage {
  return basePage({
    id: "page_about",
    pageKey: "about",
    slug: "/over-ons",
    title: "Over ons",
    layout: fixedLayout(["about.main"]),
    sectionContent: {
      "about.main": {
        heading: "Over NL",
        missionTitle: "Missie",
        missionBody: "Missie NL",
        visionTitle: "Visie",
        visionBody: "Visie NL",
        historyTitle: "Historie",
        historyBody: "Historie NL",
      },
    } as BuiltinCmsPage["sectionContent"],
    enFieldDrafts: {
      "section:about.main:heading": "About EN",
      "section:about.main:missionBody": "Mission EN",
    },
  });
}
