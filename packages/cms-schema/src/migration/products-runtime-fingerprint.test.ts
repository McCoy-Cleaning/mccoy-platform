import { describe, expect, it } from "vitest";
import { normalizeCmsPage } from "../pipeline";
import { defaultSectionContent } from "../content";
import { CURRENT_LAYOUT_VERSION } from "../sections";
import {
  forceProductsIntroAssortmentPair,
  productsMigrationBlockId,
  resolveProductsBlocksLayout,
} from "./products-blocks";
import type { BuiltinCmsPage } from "../types";

function layoutPresentations(page: BuiltinCmsPage): string[] {
  return page.layout.map((item) => {
    if (item.kind === "fixed") return `fixed:${item.key}`;
    const block = page.blocks.find((b) => b.id === item.blockId);
    const presentation =
      block?.data && typeof block.data === "object"
        ? String((block.data as { presentation?: string }).presentation ?? "none")
        : "none";
    return `${block?.type ?? "missing"}:${presentation}`;
  });
}

describe("runtime Assortiment-only repair", () => {
  it("restores Intro when infoId holds Assortiment (after normalize)", () => {
    const infoId = productsMigrationBlockId("page_products", "products.info");
    const raw = {
      kind: "builtin",
      isCustom: false,
      id: "page_products",
      pageKey: "products",
      slug: "/products",
      title: "Producten",
      description: "Producten",
      inNav: true,
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
      layout: [{ id: `block:${infoId}`, kind: "block", blockId: infoId }],
      layoutVersion: CURRENT_LAYOUT_VERSION,
      sectionContent: {
        "products.main": defaultSectionContent("products.main"),
        "products.info": defaultSectionContent("products.info"),
      },
      updatedAt: 1,
      version: 1,
      productsBlocksMigration: {
        version: 1,
        status: "migrated",
        migratedAt: "2026-07-29T21:59:18.912Z",
        sources: ["products.main", "products.info"],
      },
    } as BuiltinCmsPage;

    const page = normalizeCmsPage(raw) as BuiltinCmsPage;
    const result = resolveProductsBlocksLayout(page);
    const presentations = layoutPresentations(result.page);
    expect(result.changed).toBe(true);
    expect(presentations[0]).toBe("textImage:productsIntro");
    expect(presentations).toContain("featureGrid:productsAssortment");
  });

  it("restores Intro when mainId was wrongly typed as Assortiment", () => {
    const mainId = productsMigrationBlockId("page_products", "products.main");
    const raw = {
      kind: "builtin",
      isCustom: false,
      id: "page_products",
      pageKey: "products",
      slug: "/products",
      title: "Producten",
      description: "Producten",
      inNav: true,
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
      layoutVersion: CURRENT_LAYOUT_VERSION,
      sectionContent: {
        "products.main": defaultSectionContent("products.main"),
        "products.info": defaultSectionContent("products.info"),
      },
      updatedAt: 1,
      version: 1,
      productsBlocksMigration: {
        version: 1,
        status: "migrated",
        migratedAt: "2026-07-29T21:59:18.912Z",
        sources: ["products.main", "products.info"],
      },
    } as BuiltinCmsPage;

    const page = normalizeCmsPage(raw) as BuiltinCmsPage;
    const result = resolveProductsBlocksLayout(page);
    const presentations = layoutPresentations(result.page);
    expect(result.changed).toBe(true);
    expect(presentations[0]).toBe("textImage:productsIntro");
    expect(presentations).toContain("featureGrid:productsAssortment");
  });

  it("createUuidV5 never collapses to ---- (browser crypto shim regression)", () => {
    const a = productsMigrationBlockId("page_products", "products.main");
    const b = productsMigrationBlockId("page_products", "products.info");
    expect(a).not.toBe("----");
    expect(b).not.toBe("----");
    expect(a).not.toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("forceProductsIntroAssortmentPair rebuilds Assortiment-only into ordered pair", () => {
    const infoId = productsMigrationBlockId("page_products", "products.info");
    const raw = {
      kind: "builtin",
      isCustom: false,
      id: "page_products",
      pageKey: "products",
      slug: "/products",
      title: "Producten",
      description: "Producten",
      inNav: true,
      blocks: [
        {
          id: infoId,
          type: "featureGrid",
          data: {
            presentation: "productsAssortment",
            title: "Keep me",
            features: [{ id: "c1", icon: "sparkles", title: "A", body: "b" }],
          },
        },
      ],
      layout: [{ id: `block:${infoId}`, kind: "block", blockId: infoId }],
      layoutVersion: CURRENT_LAYOUT_VERSION,
      sectionContent: {
        "products.main": defaultSectionContent("products.main"),
        "products.info": defaultSectionContent("products.info"),
      },
      updatedAt: 1,
      version: 1,
      productsBlocksMigration: {
        version: 1,
        status: "migrated",
        sources: ["products.main", "products.info"],
      },
    } as BuiltinCmsPage;
    const result = forceProductsIntroAssortmentPair(raw);
    expect(result.changed).toBe(true);
    const presentations = layoutPresentations(result.page);
    expect(presentations[0]).toBe("textImage:productsIntro");
    expect(presentations[1]).toBe("featureGrid:productsAssortment");
    const assortment = result.page.blocks.find(
      (b) => (b.data as { presentation?: string }).presentation === "productsAssortment",
    );
    expect((assortment?.data as { title?: string }).title).toBe("Keep me");
  });

  it("forceProductsIntroAssortmentPair preserves Assortiment-first editor order", () => {
    const mainId = productsMigrationBlockId("page_products", "products.main");
    const infoId = productsMigrationBlockId("page_products", "products.info");
    const raw = {
      kind: "builtin",
      isCustom: false,
      id: "page_products",
      pageKey: "products",
      slug: "/products",
      title: "Producten",
      description: "Producten",
      inNav: true,
      blocks: [
        {
          id: infoId,
          type: "featureGrid",
          data: {
            presentation: "productsAssortment",
            title: "Assortiment",
            features: [{ id: "c1", icon: "sparkles", title: "A", body: "b" }],
          },
        },
        {
          id: mainId,
          type: "textImage",
          data: { presentation: "productsIntro", title: "Intro" },
        },
      ],
      layout: [
        { id: `block:${infoId}`, kind: "block", blockId: infoId },
        { id: `block:${mainId}`, kind: "block", blockId: mainId },
      ],
      layoutVersion: CURRENT_LAYOUT_VERSION,
      sectionContent: {
        "products.main": defaultSectionContent("products.main"),
        "products.info": defaultSectionContent("products.info"),
      },
      updatedAt: 1,
      version: 1,
      productsBlocksMigration: {
        version: 1,
        status: "migrated",
        sources: ["products.main", "products.info"],
      },
    } as BuiltinCmsPage;
    const result = forceProductsIntroAssortmentPair(raw);
    expect(result.changed).toBe(false);
    expect(layoutPresentations(result.page)).toEqual([
      "featureGrid:productsAssortment",
      "textImage:productsIntro",
    ]);
    const resolved = resolveProductsBlocksLayout(raw);
    expect(layoutPresentations(resolved.page)).toEqual([
      "featureGrid:productsAssortment",
      "textImage:productsIntro",
    ]);
  });
});
