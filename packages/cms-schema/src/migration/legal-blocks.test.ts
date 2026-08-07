import { describe, expect, it } from "vitest";
import { CURRENT_LAYOUT_VERSION } from "../sections";
import { defaultSectionContent, type LegalMainContent } from "../content";
import { defaultFixedLayout } from "../layout";
import type { BuiltinCmsPage } from "../types";
import {
  LEGAL_PAGE_HEADING_EN,
  legalMainMigrationBlockId,
  mapLegalMainToLegalArticlesData,
  remapLegalEnFieldDrafts,
  resolveLegalBlocksLayout,
  suppressedLegalFixedKeys,
} from "./legal-blocks";

function privacyPage(overrides: Partial<BuiltinCmsPage> = {}): BuiltinCmsPage {
  return {
    id: "page_privacy",
    slug: "/privacy",
    title: "Privacyverklaring",
    description: "",
    kind: "builtin",
    isCustom: false,
    inNav: false,
    pageKey: "privacy",
    blocks: [],
    layout: defaultFixedLayout("privacy"),
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionContent: {
      "privacy.main": defaultSectionContent("privacy.main") as LegalMainContent,
    },
    updatedAt: 1,
    version: 1,
    ...overrides,
  };
}

function termsPage(overrides: Partial<BuiltinCmsPage> = {}): BuiltinCmsPage {
  return {
    id: "page_terms",
    slug: "/terms",
    title: "Algemene voorwaarden",
    description: "",
    kind: "builtin",
    isCustom: false,
    inNav: false,
    pageKey: "terms",
    blocks: [],
    layout: defaultFixedLayout("terms"),
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionContent: {
      "terms.main": defaultSectionContent("terms.main") as LegalMainContent,
    },
    updatedAt: 1,
    version: 1,
    ...overrides,
  };
}

describe("mapLegalMainToLegalArticlesData", () => {
  it("preserves exact NL privacy heading, eyebrow, updatedLabel, and article bodies", () => {
    const source = defaultSectionContent("privacy.main") as LegalMainContent;
    const { data } = mapLegalMainToLegalArticlesData(source, "privacy");
    expect(data.eyebrow).toBe(source.eyebrow);
    expect(data.heading).toBe(source.heading);
    expect(data.updatedLabel).toBe(source.updatedLabel);
    expect(data.articles).toHaveLength(source.articles.length);
    for (let i = 0; i < source.articles.length; i++) {
      expect(data.articles[i]!.heading).toBe(source.articles[i]!.title);
      expect(data.articles[i]!.content).toBe(source.articles[i]!.body);
    }
  });

  it("preserves exact NL terms article titles and bodies", () => {
    const source = defaultSectionContent("terms.main") as LegalMainContent;
    const { data } = mapLegalMainToLegalArticlesData(source, "terms");
    expect(data.heading).toBe("Algemene Voorwaarden");
    expect(data.articles[0]!.heading).toBe("Artikel 1 – Definities");
    expect(data.articles[0]!.content).toBe(source.articles[0]!.body);
  });
});

describe("resolveLegalBlocksLayout", () => {
  it("replaces privacy.main with a legalArticles block and seeds EN heading", () => {
    const first = resolveLegalBlocksLayout(privacyPage());
    expect(first.changed).toBe(true);
    const id = legalMainMigrationBlockId("page_privacy", "privacy.main");
    expect(first.page.blocks.some((b) => b.id === id && b.type === "legalArticles")).toBe(true);
    expect(first.page.layout.some((i) => i.kind === "fixed" && i.key === "privacy.main")).toBe(
      false,
    );
    expect(first.page.legalBlocksMigration?.status).toBe("migrated");
    expect(first.page.enFieldDrafts?.[`block:${id}:heading`]).toBe(LEGAL_PAGE_HEADING_EN.privacy);

    const second = resolveLegalBlocksLayout(first.page);
    expect(second.changed).toBe(false);
  });

  it("replaces terms.main and suppresses the fixed key", () => {
    const migrated = resolveLegalBlocksLayout(termsPage()).page;
    expect(suppressedLegalFixedKeys(migrated).has("terms.main")).toBe(true);
    const id = legalMainMigrationBlockId("page_terms", "terms.main");
    expect(migrated.enFieldDrafts?.[`block:${id}:heading`]).toBe(LEGAL_PAGE_HEADING_EN.terms);
  });
});

describe("remapLegalEnFieldDrafts", () => {
  it("moves section EN drafts onto migrated block paths", () => {
    const id = legalMainMigrationBlockId("page_privacy", "privacy.main");
    const remapped = remapLegalEnFieldDrafts({
      pageId: "page_privacy",
      pageKey: "privacy",
      enFieldDrafts: {
        "section:privacy.main:heading": "EN heading",
        "section:privacy.main:articles.0.title": "EN article",
        "section:privacy.main:articles.0.body": "EN body",
      },
      enFieldDraftSources: {},
    });
    expect(remapped.enFieldDrafts[`block:${id}:heading`]).toBe("EN heading");
    expect(remapped.enFieldDrafts[`block:${id}:articles.0.heading`]).toBe("EN article");
    expect(remapped.enFieldDrafts[`block:${id}:articles.0.content`]).toBe("EN body");
    expect(remapped.enFieldDrafts["section:privacy.main:heading"]).toBeUndefined();
  });
});
