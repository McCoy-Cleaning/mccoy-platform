import { describe, expect, it } from "vitest";
import { CURRENT_LAYOUT_VERSION } from "../sections";
import { normalizeCmsPage } from "../pipeline";
import { createDefaultBlock, getBlockDataDefinition } from "../blocks/registry";
import { defaultSectionContent } from "../content";
import type { BuiltinCmsPage, Block } from "../types";
import {
  mapProductsInfoToFeatureGridData,
  mapProductsMainToTextImageData,
  productsMigrationBlockId,
  remapProductsEnFieldDrafts,
  resolveProductsBlocksLayout,
  shouldServeProductsMigratedBlocks,
  suppressedProductsFixedKeys,
} from "./products-blocks";
import {
  productAssortmentTemplateData,
  productIntroTemplateData,
} from "./products-templates";

function productsPage(overrides: Partial<BuiltinCmsPage> = {}): BuiltinCmsPage {
  const main = defaultSectionContent("products.main");
  const info = defaultSectionContent("products.info");
  return {
    kind: "builtin",
    isCustom: false,
    id: "page_products",
    pageKey: "products",
    slug: "/products",
    title: "Producten",
    description: "Producten",
    inNav: true,
    blocks: [],
    layout: [
      { id: "fixed:products:main", kind: "fixed", key: "products.main", hidden: false },
      { id: "fixed:products:info", kind: "fixed", key: "products.info", hidden: false },
    ],
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionContent: {
      "products.main": main,
      "products.info": info,
    } as BuiltinCmsPage["sectionContent"],
    updatedAt: 1,
    version: 1,
    productsBlocksMigration: {
      version: 1,
      status: "not_started",
    },
    ...overrides,
  };
}

describe("productsMigrationBlockId", () => {
  it("is deterministic for page + fixed key + primary role", () => {
    const a = productsMigrationBlockId("page_products", "products.main");
    const b = productsMigrationBlockId("page_products", "products.main");
    const c = productsMigrationBlockId("page_products", "products.info");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("mapProductsMainToTextImageData", () => {
  it("maps intro/notice separately with productsIntro presentation", () => {
    const { data } = mapProductsMainToTextImageData({
      eyebrow: "Producten",
      heading: "Titel",
      intro: "Intro tekst",
      body: "Webshop notice",
      image: {
        assetId: "local:x",
        src: "/images/cms/products-flyer.png",
        alt: "Flyer",
        decorative: false,
      },
    });
    expect(data.presentation).toBe("productsIntro");
    expect(data.title).toBe("Titel");
    expect(data.body).toBe("Intro tekst");
    expect(data.notice).toBe("Webshop notice");
    expect(data.eyebrow).toBe("Producten");
    expect(data.reverse).toBe(false);
    expect((data.image as { src: string }).src).toContain("products-flyer");
    expect(data.metrics).toEqual([
      { id: "metric_products", value: "100+", label: "Producten" },
      { id: "metric_b2b", value: "B2B", label: "Groothandel" },
      { id: "metric_contact", value: "24/7", label: "Contact" },
    ]);
  });
});

describe("mapProductsInfoToFeatureGridData", () => {
  it("preserves card ids, intro/eyebrow, and maps description→body", () => {
    const { data } = mapProductsInfoToFeatureGridData({
      heading: "Assortiment",
      eyebrow: "Ons assortiment",
      intro: "Korte intro",
      cards: [
        { id: "prod_hygiene", title: "Papier", description: "Desc" },
      ],
    });
    expect(data.presentation).toBe("productsAssortment");
    expect(data.title).toBe("Assortiment");
    expect(data.eyebrow).toBe("Ons assortiment");
    expect(data.intro).toBe("Korte intro");
    const features = data.features as Array<{ id: string; body: string }>;
    expect(features[0]?.id).toBe("prod_hygiene");
    expect(features[0]?.body).toBe("Desc");
  });
});

describe("remapProductsEnFieldDrafts", () => {
  it("remaps section paths onto deterministic block field paths", () => {
    const mainId = productsMigrationBlockId("page_products", "products.main");
    const infoId = productsMigrationBlockId("page_products", "products.info");
    const result = remapProductsEnFieldDrafts({
      pageId: "page_products",
      enFieldDrafts: {
        "section:products.main:heading": "EN title",
        "section:products.main:intro": "EN intro",
        "section:products.main:body": "EN notice",
        "section:products.info:heading": "EN grid",
        "section:products.info:intro": "EN assortment intro",
        "section:products.info:cards:prod_hygiene:title": "EN card",
        "section:products.info:cards:prod_hygiene:description": "EN desc",
      },
      enFieldDraftSources: {},
      migratedSources: ["products.main", "products.info"],
    });
    expect(result.enFieldDrafts[`block:${mainId}:title`]).toBe("EN title");
    expect(result.enFieldDrafts[`block:${mainId}:body`]).toBe("EN intro");
    expect(result.enFieldDrafts[`block:${mainId}:notice`]).toBe("EN notice");
    expect(result.enFieldDrafts[`block:${infoId}:title`]).toBe("EN grid");
    expect(result.enFieldDrafts[`block:${infoId}:intro`]).toBe("EN assortment intro");
    expect(result.enFieldDrafts[`block:${infoId}:features:prod_hygiene:title`]).toBe("EN card");
    expect(result.enFieldDrafts[`block:${infoId}:features:prod_hygiene:body`]).toBe("EN desc");
    expect(result.enFieldDrafts["section:products.main:heading"]).toBeUndefined();
    expect(result.localePathsRemapped).toBeGreaterThan(0);
  });
});

describe("resolveProductsBlocksLayout", () => {
  it("migrates untouched legacy Producten into exactly two blocks in original slots", () => {
    const custom: Block = {
      id: "custom_cta",
      type: "cta",
      data: { title: "CTA", body: "x" },
    };
    const page = productsPage({
      blocks: [custom],
      layout: [
        { id: "fixed:products:main", kind: "fixed", key: "products.main", hidden: false },
        { id: `block:${custom.id}`, kind: "block", blockId: custom.id },
        { id: "fixed:products:info", kind: "fixed", key: "products.info", hidden: false },
      ],
    });
    const first = resolveProductsBlocksLayout(page);
    expect(first.changed).toBe(true);
    expect(first.report.createdBlocks).toHaveLength(2);
    expect(first.page.productsBlocksMigration?.status).toBe("migrated");

    const mainId = productsMigrationBlockId("page_products", "products.main");
    const infoId = productsMigrationBlockId("page_products", "products.info");
    expect(first.page.layout.map((i) => (i.kind === "block" ? i.blockId : i.key))).toEqual([
      mainId,
      custom.id,
      infoId,
    ]);

    const textImage = first.page.blocks.find((b) => b.id === mainId);
    expect(textImage?.type).toBe("textImage");
    expect((textImage?.data as { presentation?: string }).presentation).toBe("productsIntro");
    expect(String((textImage?.data as { notice?: string }).notice ?? "")).toContain("webshop");
    expect(String((textImage?.data as { body?: string }).body ?? "")).toContain("McCoy Products");

    const grid = first.page.blocks.find((b) => b.id === infoId);
    const features = (grid?.data as { features: Array<{ id: string }> }).features;
    expect(features.map((f) => f.id)).toEqual(["prod_hygiene", "prod_soaps", "prod_agents"]);
  });

  it("is idempotent on rerun — no duplicates, stable ids", () => {
    const first = resolveProductsBlocksLayout(productsPage());
    const second = resolveProductsBlocksLayout(first.page);
    expect(second.changed).toBe(false);
    expect(second.page.layout.filter((i) => i.kind === "block")).toHaveLength(2);
    expect(second.page.blocks.map((b) => b.id).sort()).toEqual(
      first.page.blocks.map((b) => b.id).sort(),
    );
  });

  it("keeps intentionally empty migrated layout empty (no reseed)", () => {
    const empty: BuiltinCmsPage = {
      ...productsPage({
        layout: [],
        blocks: [],
        productsBlocksMigration: {
          version: 1,
          status: "migrated",
          migratedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    };
    const resolved = resolveProductsBlocksLayout(empty);
    expect(resolved.changed).toBe(false);
    expect(resolved.page.layout).toHaveLength(0);
    expect(resolved.page.blocks).toHaveLength(0);
    expect(resolved.report.warnings.some((w) => w.includes("not reseeding"))).toBe(true);

    const normalized = normalizeCmsPage(empty) as BuiltinCmsPage;
    expect(normalized.layout).toHaveLength(0);
  });

  it("restores Assortiment when Intro remains after Assortiment was dropped", () => {
    const migrated = resolveProductsBlocksLayout(productsPage()).page;
    expect(migrated.productsBlocksMigration?.sources).toContain("products.info");
    const infoId = productsMigrationBlockId("page_products", "products.info");
    const withoutInfo: BuiltinCmsPage = {
      ...migrated,
      blocks: migrated.blocks.filter((b) => b.id !== infoId),
      layout: migrated.layout.filter((i) => !(i.kind === "block" && i.blockId === infoId)),
    };
    const again = resolveProductsBlocksLayout(withoutInfo);
    expect(again.changed).toBe(true);
    expect(again.page.blocks.some((b) => b.id === infoId)).toBe(true);
    expect(
      again.page.layout.some((i) => i.kind === "block" && i.blockId === infoId),
    ).toBe(true);
  });

  it("does not reseed Assortiment into an intentionally empty migrated layout", () => {
    const empty: BuiltinCmsPage = {
      ...productsPage({
        layout: [],
        blocks: [],
        productsBlocksMigration: {
          version: 1,
          status: "migrated",
          sources: ["products.main", "products.info"],
          migratedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    };
    const again = resolveProductsBlocksLayout(empty);
    expect(again.page.layout).toHaveLength(0);
    expect(again.page.blocks).toHaveLength(0);
  });

  it("repairs incomplete Producten (main-only, no flyer) into Intro + Assortiment", () => {
    const page = productsPage({
      layout: [
        { id: "fixed:products:main", kind: "fixed", key: "products.main", hidden: false },
      ],
      sectionContent: {
        "products.main": {
          heading: "McCoy Products",
          intro: "Hygiënepapier, zepen, reinigingsmiddelen en meer.",
        },
      } as BuiltinCmsPage["sectionContent"],
    });
    const result = resolveProductsBlocksLayout(page);
    expect(result.changed).toBe(true);
    expect(result.report.createdBlocks).toHaveLength(2);
    expect(result.report.createdBlocks.map((b) => b.source).sort()).toEqual([
      "products.info",
      "products.main",
    ]);
    const mainId = productsMigrationBlockId("page_products", "products.main");
    const infoId = productsMigrationBlockId("page_products", "products.info");
    const intro = result.page.blocks.find((b) => b.id === mainId);
    const assortment = result.page.blocks.find((b) => b.id === infoId);
    expect((intro?.data as { presentation?: string }).presentation).toBe("productsIntro");
    expect((intro?.data as { image?: { src: string } }).image?.src).toContain("products-flyer");
    expect(String((intro?.data as { body?: string }).body ?? "")).toContain("McCoy Products");
    expect((assortment?.data as { presentation?: string }).presentation).toBe(
      "productsAssortment",
    );
    expect(
      ((assortment?.data as { features?: unknown[] }).features ?? []).length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("leaves layout unchanged and reports errors for malformed section content", () => {
    const page = productsPage({
      sectionContent: {
        "products.main": "not-an-object",
        "products.info": "also-broken",
      } as unknown as BuiltinCmsPage["sectionContent"],
    });
    const result = resolveProductsBlocksLayout(page);
    expect(result.changed).toBe(false);
    expect(result.report.errors.length).toBeGreaterThan(0);
    expect(result.page.layout.every((i) => i.kind === "fixed")).toBe(true);
  });

  it("preserves EN overlays onto new block ids", () => {
    const page = productsPage({
      enFieldDrafts: {
        "section:products.main:heading": "Products EN",
        "section:products.info:heading": "Assortment EN",
        "section:products.info:cards:prod_hygiene:title": "Hygiene EN",
      },
    });
    const result = resolveProductsBlocksLayout(page);
    const mainId = productsMigrationBlockId("page_products", "products.main");
    const infoId = productsMigrationBlockId("page_products", "products.info");
    expect(result.page.enFieldDrafts?.[`block:${mainId}:title`]).toBe("Products EN");
    expect(result.page.enFieldDrafts?.[`block:${infoId}:title`]).toBe("Assortment EN");
    expect(result.page.enFieldDrafts?.[`block:${infoId}:features:prod_hygiene:title`]).toBe(
      "Hygiene EN",
    );
  });

  it("serialise/reload preserves migrated layout", () => {
    const migrated = resolveProductsBlocksLayout(productsPage()).page;
    const json = JSON.stringify(migrated);
    const reloaded = normalizeCmsPage(JSON.parse(json) as BuiltinCmsPage) as BuiltinCmsPage;
    expect(reloaded.layout).toEqual(migrated.layout);
    expect(reloaded.blocks.map((b) => b.id).sort()).toEqual(
      migrated.blocks.map((b) => b.id).sort(),
    );
    expect(reloaded.productsBlocksMigration?.status).toBe("migrated");
  });
});

describe("dual-read precedence helpers", () => {
  it("suppresses fixed when migrated blocks present", () => {
    const migrated = resolveProductsBlocksLayout(productsPage()).page;
    expect(shouldServeProductsMigratedBlocks(migrated)).toBe(true);
    const suppressed = suppressedProductsFixedKeys(migrated);
    expect(suppressed.has("products.main")).toBe(true);
    expect(suppressed.has("products.info")).toBe(true);
  });

  it("does not suppress fixed on not_started legacy layout", () => {
    const page = productsPage();
    expect(shouldServeProductsMigratedBlocks(page)).toBe(false);
    expect(suppressedProductsFixedKeys(page).size).toBe(0);
  });

  it("blocks win when both fixed and deterministic blocks unexpectedly present", () => {
    const migrated = resolveProductsBlocksLayout(productsPage()).page;
    const both: BuiltinCmsPage = {
      ...migrated,
      productsBlocksMigration: { version: 1, status: "not_started" },
      layout: [
        ...migrated.layout,
        { id: "fixed:products:main", kind: "fixed", key: "products.main", hidden: false },
      ],
    };
    const suppressed = suppressedProductsFixedKeys(both);
    expect(suppressed.has("products.main")).toBe(true);
  });

  it("suppresses fixed Intro when a productsIntro picker block is present (not only migration ids)", () => {
    const page = productsPage({
      blocks: [
        {
          id: "picker_intro",
          type: "textImage",
          data: {
            presentation: "productsIntro",
            title: "Waar luxe voelbaar wordt door geur",
            body: "x",
          },
        },
      ],
      layout: [
        { id: "fixed:products:main", kind: "fixed", key: "products.main", hidden: false },
        { id: "block:picker_intro", kind: "block", blockId: "picker_intro" },
      ],
    });
    expect(suppressedProductsFixedKeys(page).has("products.main")).toBe(true);
  });

  it("dedupes duplicate layout refs to the same productsIntro blockId", () => {
    const mainId = productsMigrationBlockId("page_products", "products.main");
    const page = productsPage({
      productsBlocksMigration: {
        version: 1,
        status: "migrated",
        sources: ["products.main", "products.info"],
      },
      blocks: [
        {
          id: mainId,
          type: "textImage",
          data: { presentation: "productsIntro", title: "A", body: "a" },
        },
      ],
      layout: [
        { id: "block:ref-a", kind: "block", blockId: mainId },
        { id: "block:ref-b", kind: "block", blockId: mainId },
      ],
    });
    const result = resolveProductsBlocksLayout(page);
    expect(result.changed).toBe(true);
    expect(result.page.layout.filter((i) => i.kind === "block" && i.blockId === mainId)).toHaveLength(
      1,
    );
  });

  it("is idempotent after restoring Assortiment onto Intro-only migrated layout", () => {
    const mainId = productsMigrationBlockId("page_products", "products.main");
    const page = productsPage({
      productsBlocksMigration: {
        version: 1,
        status: "migrated",
        sources: ["products.main", "products.info"],
      },
      blocks: [
        {
          id: mainId,
          type: "textImage",
          data: {
            presentation: "productsIntro",
            title: "Waar luxe voelbaar wordt door geur",
            body: "Custom intro",
          },
        },
      ],
      layout: [{ id: `block:${mainId}`, kind: "block", blockId: mainId }],
    });
    const first = resolveProductsBlocksLayout(page);
    expect(first.changed).toBe(true);
    const second = resolveProductsBlocksLayout(first.page);
    expect(second.changed).toBe(false);
    expect(second.page.layout).toHaveLength(2);
  });

  it("restores Assortiment when migrated layout only has Intro", () => {
    const mainId = productsMigrationBlockId("page_products", "products.main");
    const page = productsPage({
      productsBlocksMigration: {
        version: 1,
        status: "migrated",
        sources: ["products.main", "products.info"],
      },
      blocks: [
        {
          id: mainId,
          type: "textImage",
          data: {
            presentation: "productsIntro",
            title: "Waar luxe voelbaar wordt door geur",
            body: "Custom intro",
          },
        },
      ],
      layout: [{ id: `block:${mainId}`, kind: "block", blockId: mainId }],
    });
    const result = resolveProductsBlocksLayout(page);
    const presentations = result.page.layout.map((item) => {
      if (item.kind !== "block") return item.key;
      const block = result.page.blocks.find((b) => b.id === item.blockId);
      return (block?.data as { presentation?: string } | undefined)?.presentation;
    });
    expect(presentations).toEqual(["productsIntro", "productsAssortment"]);
  });

  it("restores Intro for not_started Assortiment-only picker layout", () => {
    const page = productsPage({
      productsBlocksMigration: { version: 1, status: "not_started" },
      blocks: [
        {
          id: "picker_assortment",
          type: "featureGrid",
          data: {
            presentation: "productsAssortment",
            title: "McCoy Cleaning Products",
            features: [{ id: "c1", icon: "sparkles", title: "A", body: "b" }],
          },
        },
      ],
      layout: [
        { id: "block:picker_assortment", kind: "block", blockId: "picker_assortment" },
      ],
      // No fixed slots — previously skipped Intro repair when status stayed not_started.
      sectionContent: {
        "products.main": defaultSectionContent("products.main"),
        "products.info": defaultSectionContent("products.info"),
      } as BuiltinCmsPage["sectionContent"],
    });
    const result = resolveProductsBlocksLayout(page);
    const presentations = result.page.layout
      .filter((i): i is Extract<typeof i, { kind: "block" }> => i.kind === "block")
      .map((item) => {
        const block = result.page.blocks.find((b) => b.id === item.blockId);
        return (block?.data as { presentation?: string } | undefined)?.presentation;
      })
      .filter(Boolean);
    expect(presentations).toContain("productsIntro");
    expect(presentations).toContain("productsAssortment");
    expect(result.page.productsBlocksMigration?.status).toBe("migrated");
  });

  it("restores Intro when migrated layout is Assortiment-only (no productsIntro)", () => {
    const infoId = productsMigrationBlockId("page_products", "products.info");
    const mainId = productsMigrationBlockId("page_products", "products.main");
    // Corruption: mainId reused as featureGrid — must still restore real Intro.
    const page = productsPage({
      productsBlocksMigration: {
        version: 1,
        status: "migrated",
        sources: ["products.main", "products.info"],
      },
      blocks: [
        {
          id: mainId,
          type: "featureGrid",
          data: {
            presentation: "productsAssortment",
            title: "McCoy Cleaning Products",
            features: [{ id: "c1", icon: "sparkles", title: "A", body: "b" }],
          },
        },
      ],
      layout: [{ id: `block:${mainId}`, kind: "block", blockId: mainId }],
    });
    const result = resolveProductsBlocksLayout(page);
    const presentations = result.page.layout.map((item) => {
      if (item.kind !== "block") return item.key;
      const block = result.page.blocks.find((b) => b.id === item.blockId);
      return (block?.data as { presentation?: string } | undefined)?.presentation;
    });
    expect(presentations[0]).toBe("productsIntro");
    expect(presentations).toContain("productsAssortment");
    expect(result.page.blocks.find((b) => b.id === mainId)?.type).toBe("textImage");
    expect(result.page.blocks.some((b) => b.id === infoId)).toBe(true);
  });

  it("restores Intro when migrated layout only has duplicate Assortiment sections", () => {
    const infoId = productsMigrationBlockId("page_products", "products.info");
    const page = productsPage({
      productsBlocksMigration: {
        version: 1,
        status: "migrated",
        sources: ["products.main", "products.info"],
      },
      blocks: [
        {
          id: infoId,
          type: "featureGrid",
          data: {
            presentation: "productsAssortment",
            title: "McCoy Cleaning Products",
            features: [{ id: "c1", icon: "sparkles", title: "A", body: "b" }],
          },
        },
      ],
      layout: [
        { id: "block:ref-a", kind: "block", blockId: infoId },
        { id: "block:ref-b", kind: "block", blockId: infoId },
      ],
    });
    const result = resolveProductsBlocksLayout(page);
    const mainId = productsMigrationBlockId("page_products", "products.main");
    const presentations = result.page.layout.map((item) => {
      if (item.kind !== "block") return item.key;
      const block = result.page.blocks.find((b) => b.id === item.blockId);
      return (block?.data as { presentation?: string } | undefined)?.presentation;
    });
    expect(presentations).toEqual(["productsIntro", "productsAssortment"]);
    expect(result.page.blocks.some((b) => b.id === mainId)).toBe(true);
  });

  it("dedupes duplicate productsIntro blocks", () => {
    const mainId = productsMigrationBlockId("page_products", "products.main");
    const page = productsPage({
      productsBlocksMigration: { version: 1, status: "migrated", sources: ["products.main"] },
      blocks: [
        {
          id: mainId,
          type: "textImage",
          data: { presentation: "productsIntro", title: "A", body: "a" },
        },
        {
          id: "dup_intro",
          type: "textImage",
          data: { presentation: "productsIntro", title: "B", body: "b" },
        },
      ],
      layout: [
        { id: `block:${mainId}`, kind: "block", blockId: mainId },
        { id: "block:dup_intro", kind: "block", blockId: "dup_intro" },
      ],
    });
    const result = resolveProductsBlocksLayout(page);
    const intros = result.page.blocks.filter(
      (b) =>
        b.type === "textImage" &&
        (b.data as { presentation?: string }).presentation === "productsIntro",
    );
    expect(intros).toHaveLength(1);
    expect(intros[0]?.id).toBe(mainId);
  });

  it("normalize after migrate does not re-insert fixed Producten into admin layout", () => {
    const migrated = resolveProductsBlocksLayout(productsPage()).page;
    // Simulate older drafts that still carried a pre-bump layoutVersion.
    const staleVersion: BuiltinCmsPage = {
      ...migrated,
      layoutVersion: 1,
      layout: [
        ...migrated.layout,
        { id: "fixed:products:main", kind: "fixed", key: "products.main", hidden: false },
      ],
    };
    const normalized = normalizeCmsPage(staleVersion) as BuiltinCmsPage;
    expect(
      normalized.layout.some(
        (i) => i.kind === "fixed" && (i.key === "products.main" || i.key === "products.info"),
      ),
    ).toBe(false);
    expect(normalized.layout.filter((i) => i.kind === "block").length).toBe(2);

    const again = resolveProductsBlocksLayout(normalized);
    expect(
      again.page.layout.some(
        (i) => i.kind === "fixed" && (i.key === "products.main" || i.key === "products.info"),
      ),
    ).toBe(false);
  });

  it("absorbs Productintro picker + fixed main into one Intro + Assortiment", () => {
    const page = productsPage({
      blocks: [
        {
          id: "picker_intro",
          type: "textImage",
          data: {
            presentation: "productsIntro",
            title: "Waar luxe voelbaar wordt door geur",
            body: "Custom intro",
            eyebrow: "MCCOY PREMIUM GEURBELEVING",
            notice: "We zijn momenteel druk achter de schermen met de online webshop! Deze volgt binnenkort.",
          },
        },
      ],
      layout: [
        { id: "fixed:products:main", kind: "fixed", key: "products.main", hidden: false },
        { id: "block:picker_intro", kind: "block", blockId: "picker_intro" },
      ],
      sectionContent: {
        "products.main": {
          heading: "McCoy Products",
          intro: "Legacy short intro",
          cards: [
            {
              id: "prod_hygiene",
              title: "Hygiëne papier",
              description: "Professioneel hygiënepapier.",
            },
          ],
        },
      } as BuiltinCmsPage["sectionContent"],
    });
    const result = resolveProductsBlocksLayout(page);
    const mainId = productsMigrationBlockId("page_products", "products.main");
    const infoId = productsMigrationBlockId("page_products", "products.info");
    const intros = result.page.blocks.filter(
      (b) =>
        b.type === "textImage" &&
        (b.data as { presentation?: string }).presentation === "productsIntro",
    );
    const assortments = result.page.blocks.filter(
      (b) =>
        b.type === "featureGrid" &&
        (b.data as { presentation?: string }).presentation === "productsAssortment",
    );
    expect(intros).toHaveLength(1);
    expect(assortments).toHaveLength(1);
    expect(intros[0]?.id).toBe(mainId);
    expect(assortments[0]?.id).toBe(infoId);
    expect((intros[0]?.data as { title?: string }).title).toBe(
      "Waar luxe voelbaar wordt door geur",
    );
    expect(
      ((assortments[0]?.data as { features?: Array<{ id: string }> }).features ?? []).map(
        (f) => f.id,
      ),
    ).toContain("prod_hygiene");
    expect(result.page.layout.filter((i) => i.kind === "block")).toHaveLength(2);
    expect(result.page.blocks.some((b) => b.id === "picker_intro")).toBe(false);
  });
});

describe("picker fixtures vs generic defaults", () => {
  it("featureGrid createDefault stays generic (not Producten cards)", () => {
    const def = getBlockDataDefinition("featureGrid");
    const data = def.createDefault() as { title: string; features: Array<{ id: string; title: string }> };
    expect(data.title).toBe("Kenmerken");
    expect(data.features.some((f) => f.id === "prod_hygiene")).toBe(false);
    expect(def.label).toBe("Kenmerkenraster");
  });

  it("productAssortmentTemplateData is frozen Producten starter", () => {
    expect(productAssortmentTemplateData.presentation).toBe("productsAssortment");
    expect(productAssortmentTemplateData.features[0]?.id).toBe("prod_hygiene");
    expect(productIntroTemplateData.presentation).toBe("productsIntro");
    expect(productIntroTemplateData.image.src).toContain("products-flyer");
    expect(productIntroTemplateData.notice).toContain("webshop");
    expect(productIntroTemplateData.metrics).toHaveLength(3);
    expect(productIntroTemplateData.metrics[0]).toMatchObject({
      value: "100+",
      label: "Producten",
    });
  });

  it("createDefaultBlock(featureGrid) does not bind to page_products", () => {
    const block = createDefaultBlock("featureGrid");
    expect(block.type).toBe("featureGrid");
    expect(JSON.stringify(block.data)).not.toContain("prod_hygiene");
  });
});
