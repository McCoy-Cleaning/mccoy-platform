/**
 * Authoritative CMS inventory catalog for E2E Phase 5 / M5.
 *
 * Fixed section keys come from {@link FIXED_SECTIONS_BY_PAGE} + composites.
 * Publishable block types come from {@link PUBLISHABLE_BLOCK_TYPES}.
 * Do not hand-maintain parallel lists in Playwright helpers — import from here.
 */

import type { BlockType } from "./block-types";
import { PUBLISHABLE_BLOCK_TYPES } from "./blocks/registry";
import {
  COMPOSITE_SECTION_PARTS,
  compositeEditorRowId,
  compositePartsFor,
} from "./composite-sections";
import { productsMigrationBlockId } from "./migration/products-blocks";
import { aboutMigrationBlockId } from "./migration/about-blocks";
import {
  offerteFormMigrationBlockId,
  offerteMainMigrationBlockId,
} from "./migration/offerte-blocks";
import {
  FIXED_SECTION_DEFS,
  FIXED_SECTIONS_BY_PAGE,
  fixedLayoutId,
  pageKeyFromPageId,
  type BuiltinPageKey,
  type FixedSectionKey,
} from "./sections";

/** Builtin admin editor pages that expose fixed (or products-pilot) layout inventory. */
export const BUILTIN_CMS_INVENTORY_PAGES = [
  { pageId: "page_home", pageKey: "home" as const, title: "Home" },
  { pageId: "page_about", pageKey: "about" as const, title: "Over ons" },
  { pageId: "page_services", pageKey: "services" as const, title: "Diensten" },
  { pageId: "page_products", pageKey: "products" as const, title: "Producten" },
  { pageId: "page_contact", pageKey: "contact" as const, title: "Contact" },
  { pageId: "page_vacatures", pageKey: "vacatures" as const, title: "Vacatures" },
  { pageId: "page_offerte", pageKey: "offerte" as const, title: "Offerte" },
  { pageId: "page_privacy", pageKey: "privacy" as const, title: "Privacyverklaring" },
  { pageId: "page_terms", pageKey: "terms" as const, title: "Algemene voorwaarden" },
] as const;

export type BuiltinCmsInventoryPage = (typeof BUILTIN_CMS_INVENTORY_PAGES)[number];

/** Every fixed section key registered in schema (sorted). */
export const ALL_FIXED_SECTION_KEYS = Object.keys(FIXED_SECTION_DEFS).sort() as FixedSectionKey[];

/** Sorted publishable block types — same source as picker registry asserts. */
export const INVENTORY_PUBLISHABLE_BLOCK_TYPES = [...PUBLISHABLE_BLOCK_TYPES].sort() as BlockType[];

export type FixedInventoryExpectation =
  | {
      kind: "fixed";
      fixedKey: FixedSectionKey;
      /** `data-cms-layout-row` ids (composite keys expand to part rows). */
      layoutRowIds: string[];
    }
  | {
      kind: "fixed-or-products-pilot";
      fixedKey: FixedSectionKey;
      layoutRowIds: string[];
      /** Layout row id after Producten fixed→blocks pilot replace. */
      migratedLayoutRowId: string;
    }
  | {
      kind: "fixed-or-migrated-blocks";
      fixedKey: FixedSectionKey;
      layoutRowIds: string[];
      /** One or more layout row ids after fixed→blocks migration. */
      migratedLayoutRowIds: string[];
    };

function fixedLayoutRowIdsForKey(key: FixedSectionKey): string[] {
  const layoutId = fixedLayoutId(key);
  const parts = compositePartsFor(key);
  if (parts.length > 0) {
    return parts.map((part) => compositeEditorRowId(layoutId, part.id));
  }
  return [layoutId];
}

/**
 * Expected Secties inventory markers for a builtin page.
 * Producten keys accept either fixed rows or deterministic pilot block layout rows.
 */
export function expectedFixedInventoryForPage(
  pageId: string,
  pageKey: BuiltinPageKey,
): FixedInventoryExpectation[] {
  return FIXED_SECTIONS_BY_PAGE[pageKey].map((fixedKey) => {
    const layoutRowIds = fixedLayoutRowIdsForKey(fixedKey);
    if (pageKey === "products" && (fixedKey === "products.main" || fixedKey === "products.info")) {
      const blockId = productsMigrationBlockId(pageId, fixedKey);
      return {
        kind: "fixed-or-products-pilot",
        fixedKey,
        layoutRowIds,
        migratedLayoutRowId: `block:${blockId}`,
      };
    }
    if (pageKey === "about" && fixedKey === "about.main") {
      return {
        kind: "fixed-or-migrated-blocks",
        fixedKey,
        layoutRowIds,
        migratedLayoutRowIds: (
          ["intro", "mission", "vision", "history"] as const
        ).map((role) => `block:${aboutMigrationBlockId(pageId, role)}`),
      };
    }
    if (pageKey === "offerte" && fixedKey === "offerte.main") {
      return {
        kind: "fixed-or-migrated-blocks",
        fixedKey,
        layoutRowIds,
        migratedLayoutRowIds: [`block:${offerteMainMigrationBlockId(pageId)}`],
      };
    }
    if (pageKey === "offerte" && fixedKey === "offerte.form") {
      return {
        kind: "fixed-or-migrated-blocks",
        fixedKey,
        layoutRowIds,
        migratedLayoutRowIds: [`block:${offerteFormMigrationBlockId(pageId)}`],
      };
    }
    return {
      kind: "fixed",
      fixedKey,
      layoutRowIds,
    };
  });
}

export function expectedFixedInventoryForPageId(pageId: string): FixedInventoryExpectation[] {
  const pageKey = pageKeyFromPageId(pageId);
  if (!pageKey) {
    throw new Error(`Not a builtin CMS inventory page id: ${pageId}`);
  }
  return expectedFixedInventoryForPage(pageId, pageKey);
}

/**
 * Privileged form blocks are hidden from the picker outside their home page.
 * M5 picker inventory must probe these page ids (not only the custom fixture).
 */
export const PRIVILEGED_PICKER_BLOCK_PAGES: Partial<Record<BlockType, string>> = {
  quoteRequestForm: "page_offerte",
};

/** Page id to open when asserting a publishable type appears in the add-section picker. */
export function pickerInventoryPageIdForBlockType(type: BlockType): string {
  return PRIVILEGED_PICKER_BLOCK_PAGES[type] ?? "page_e2e_custom";
}

/** Group publishable types by the page used for picker inventory probes. */
export function publishableTypesByPickerPage(): Map<string, BlockType[]> {
  const map = new Map<string, BlockType[]>();
  for (const type of INVENTORY_PUBLISHABLE_BLOCK_TYPES) {
    const pageId = pickerInventoryPageIdForBlockType(type);
    const list = map.get(pageId) ?? [];
    list.push(type);
    map.set(pageId, list);
  }
  return map;
}

/** Flat list of every fixed key across builtin pages (for sync / completeness tests). */
export function allFixedKeysFromPageMap(): FixedSectionKey[] {
  const keys = new Set<FixedSectionKey>();
  for (const pageKey of Object.keys(FIXED_SECTIONS_BY_PAGE) as BuiltinPageKey[]) {
    for (const key of FIXED_SECTIONS_BY_PAGE[pageKey]) {
      keys.add(key);
    }
  }
  return [...keys].sort() as FixedSectionKey[];
}

/** Composite part ids registered for a fixed key (empty when not composite). */
export function compositePartIdsForFixedKey(key: FixedSectionKey): readonly string[] {
  return (COMPOSITE_SECTION_PARTS[key] ?? []).map((p) => p.id);
}
