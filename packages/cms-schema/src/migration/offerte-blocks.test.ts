import { describe, expect, it } from "vitest";
import { CURRENT_LAYOUT_VERSION } from "../sections";
import {
  defaultSectionContent,
  type ContactFormContent,
  type ContactInfoContent,
  type FormPageChromeContent,
} from "../content";
import { defaultFixedLayout } from "../layout";
import type { BuiltinCmsPage } from "../types";
import {
  mapOfferteFormToQuoteRequestData,
  mapOfferteMainToHeroBlockData,
  offerteFormMigrationBlockId,
  offerteMainMigrationBlockId,
  resolveOfferteBlocksLayout,
  suppressedOfferteFixedKeys,
} from "./offerte-blocks";

function offertePage(overrides: Partial<BuiltinCmsPage> = {}): BuiltinCmsPage {
  return {
    id: "page_offerte",
    slug: "/offerte",
    title: "Offerte",
    description: "",
    kind: "builtin",
    isCustom: false,
    inNav: true,
    pageKey: "offerte",
    blocks: [],
    layout: defaultFixedLayout("offerte"),
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionContent: {
      "offerte.main": defaultSectionContent("offerte.main") as FormPageChromeContent,
      "offerte.info": defaultSectionContent("offerte.info") as ContactInfoContent,
      "offerte.form": defaultSectionContent("offerte.form") as ContactFormContent,
    },
    updatedAt: 1,
    version: 1,
    ...overrides,
  };
}

describe("mapOfferteMainToHeroBlockData", () => {
  it("maps intro into formChrome hero fields", () => {
    const { data } = mapOfferteMainToHeroBlockData({
      eyebrow: "Offerte",
      heading: "Vraag een offerte aan",
      body: "Vertel ons wat u nodig heeft.",
    });
    expect(data.presentation).toBe("formChrome");
    expect(data.title).toBe("Vraag een offerte aan");
    expect(data.subtitle).toBe("Vertel ons wat u nodig heeft.");
  });
});

describe("mapOfferteFormToQuoteRequestData", () => {
  it("seeds two tabs with glass/furniture fields", () => {
    const { data } = mapOfferteFormToQuoteRequestData({});
    expect(data.tabs).toHaveLength(2);
    expect(data.tabs[0]?.kind).toBe("glass_washing");
    expect(data.tabs[1]?.kind).toBe("furniture_cleaning");
    expect(data.tabs[0]?.fields.length).toBeGreaterThan(3);
  });
});

describe("resolveOfferteBlocksLayout", () => {
  it("replaces offerte.main and offerte.form with reusable blocks", () => {
    const first = resolveOfferteBlocksLayout(offertePage());
    expect(first.changed).toBe(true);
    const mainId = offerteMainMigrationBlockId("page_offerte");
    const formId = offerteFormMigrationBlockId("page_offerte");
    expect(first.page.blocks.some((b) => b.id === mainId && b.type === "hero")).toBe(true);
    expect(first.page.blocks.some((b) => b.id === formId && b.type === "quoteRequestForm")).toBe(
      true,
    );
    expect(first.page.layout.some((i) => i.kind === "fixed" && i.key === "offerte.main")).toBe(
      false,
    );
    expect(first.page.layout.some((i) => i.kind === "fixed" && i.key === "offerte.form")).toBe(
      false,
    );
    // info cards stay fixed for now
    expect(first.page.layout.some((i) => i.kind === "fixed" && i.key === "offerte.info")).toBe(
      true,
    );
    expect(first.page.offerteBlocksMigration?.status).toBe("migrated");

    const suppressed = suppressedOfferteFixedKeys(first.page);
    expect(suppressed.has("offerte.main")).toBe(true);
    expect(suppressed.has("offerte.form")).toBe(true);
  });
});
