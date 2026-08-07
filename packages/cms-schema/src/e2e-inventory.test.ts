import { describe, expect, it } from "vitest";
import { PUBLISHABLE_BLOCK_TYPES } from "./blocks/registry";
import {
  ALL_FIXED_SECTION_KEYS,
  BUILTIN_CMS_INVENTORY_PAGES,
  INVENTORY_PUBLISHABLE_BLOCK_TYPES,
  allFixedKeysFromPageMap,
  expectedFixedInventoryForPage,
  pickerInventoryPageIdForBlockType,
  publishableTypesByPickerPage,
} from "./e2e-inventory";
import { FIXED_SECTION_DEFS, FIXED_SECTIONS_BY_PAGE, fixedLayoutId } from "./sections";
import { compositeEditorRowId } from "./composite-sections";
import { productsMigrationBlockId } from "./migration/products-blocks";

describe("e2e-inventory catalog (M5)", () => {
  it("ALL_FIXED_SECTION_KEYS matches FIXED_SECTION_DEFS and page map", () => {
    expect(ALL_FIXED_SECTION_KEYS).toEqual(
      [...Object.keys(FIXED_SECTION_DEFS)].sort(),
    );
    expect(allFixedKeysFromPageMap()).toEqual(ALL_FIXED_SECTION_KEYS);
    const fromPages = new Set(allFixedKeysFromPageMap());
    for (const key of Object.keys(FIXED_SECTION_DEFS)) {
      expect(fromPages.has(key as keyof typeof FIXED_SECTION_DEFS)).toBe(true);
    }
  });

  it("INVENTORY_PUBLISHABLE_BLOCK_TYPES stays sorted and equal to registry", () => {
    expect(INVENTORY_PUBLISHABLE_BLOCK_TYPES).toEqual(
      [...PUBLISHABLE_BLOCK_TYPES].sort(),
    );
    expect(new Set(INVENTORY_PUBLISHABLE_BLOCK_TYPES).size).toBe(
      INVENTORY_PUBLISHABLE_BLOCK_TYPES.length,
    );
  });

  it("BUILTIN_CMS_INVENTORY_PAGES covers every FIXED_SECTIONS_BY_PAGE key", () => {
    const covered = new Set(BUILTIN_CMS_INVENTORY_PAGES.map((p) => p.pageKey));
    for (const pageKey of Object.keys(FIXED_SECTIONS_BY_PAGE)) {
      expect(covered.has(pageKey as keyof typeof FIXED_SECTIONS_BY_PAGE)).toBe(true);
    }
    expect(BUILTIN_CMS_INVENTORY_PAGES.every((p) => p.title.length > 0)).toBe(true);
  });

  it("about.main accepts composite fixed rows or migrated block rows", () => {
    const rows = expectedFixedInventoryForPage("page_about", "about");
    const about = rows.find((r) => r.fixedKey === "about.main");
    expect(about?.kind).toBe("fixed-or-migrated-blocks");
    expect(about?.layoutRowIds).toEqual([
      compositeEditorRowId(fixedLayoutId("about.main"), "header"),
      compositeEditorRowId(fixedLayoutId("about.main"), "mission"),
      compositeEditorRowId(fixedLayoutId("about.main"), "vision"),
      compositeEditorRowId(fixedLayoutId("about.main"), "history"),
    ]);
    if (about?.kind === "fixed-or-migrated-blocks") {
      expect(about.migratedLayoutRowIds).toHaveLength(4);
    }
  });

  it("products keys accept fixed or pilot migrated layout row ids", () => {
    const rows = expectedFixedInventoryForPage("page_products", "products");
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.kind).toBe("fixed-or-products-pilot");
      if (row.kind !== "fixed-or-products-pilot") continue;
      expect(row.layoutRowIds).toEqual([fixedLayoutId(row.fixedKey)]);
      expect(row.migratedLayoutRowId).toBe(
        `block:${productsMigrationBlockId("page_products", row.fixedKey as "products.main" | "products.info")}`,
      );
    }
  });

  it("quoteRequestForm picker inventory probes offerte, others custom", () => {
    expect(pickerInventoryPageIdForBlockType("quoteRequestForm")).toBe("page_offerte");
    expect(pickerInventoryPageIdForBlockType("hero")).toBe("page_e2e_custom");
    const byPage = publishableTypesByPickerPage();
    expect(byPage.get("page_offerte")).toEqual(["quoteRequestForm"]);
    expect(byPage.get("page_e2e_custom")?.includes("hero")).toBe(true);
    expect(byPage.get("page_e2e_custom")?.includes("quoteRequestForm")).toBe(false);
  });
});
