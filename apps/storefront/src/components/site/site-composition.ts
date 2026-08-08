/**
 * R7 storefront composition model (internal).
 *
 * Page orchestration is implemented by {@link PageLayoutRenderer}: it walks
 * persisted layout order and dispatches by representation CLASS (fixed vs block),
 * never by reusable BlockType. This module documents that contract for tests.
 */

import type { Block, BuiltinPageKey, FixedSectionKey, LayoutItem } from "@mccoy/cms-schema";
import { FIXED_SECTIONS_BY_PAGE } from "@mccoy/cms-schema";
import { usesStorefrontPresentationAdapter } from "./block-presentation";

export type SiteSectionKind = "block" | "fixed" | "application";

export type SiteSectionClass =
  | { kind: "block"; id: string; blockId: string; hidden: boolean }
  | { kind: "fixed"; id: string; sectionKey: FixedSectionKey; hidden: boolean }
  | { kind: "application"; id: string; type: string; hidden: boolean };

/** Map a persisted layout item to a class-level composition slot (no BlockType switch). */
export function classifyLayoutItem(item: LayoutItem): SiteSectionClass {
  if (item.kind === "fixed") {
    return {
      kind: "fixed",
      id: item.id,
      sectionKey: item.key,
      hidden: Boolean(item.hidden),
    };
  }
  return {
    kind: "block",
    id: item.id,
    blockId: item.blockId,
    hidden: Boolean(item.hidden),
  };
}

/** Ordered composition classes from a page layout (identity + hidden preserved). */
export function resolveSitePageComposition(layout: LayoutItem[]): SiteSectionClass[] {
  return layout.map(classifyLayoutItem);
}

/** Schema-expected fixed keys missing from a renderer registration map. */
export function missingFixedRenderersForPage(
  pageKey: BuiltinPageKey,
  registeredKeys: Iterable<string>,
): FixedSectionKey[] {
  const registered = new Set(registeredKeys);
  const expected = FIXED_SECTIONS_BY_PAGE[pageKey] ?? [];
  return expected.filter((key) => !registered.has(key));
}

/** Blocks that bypass RegisteredBlockView via storefront presentation adapters. */
export function presentationAdapterBlocks(blocks: Block[]): Block[] {
  return blocks.filter(usesStorefrontPresentationAdapter);
}

export const STOREFRONT_COMPOSITION_OWNERS = {
  orchestration: "PageLayoutRenderer",
  fixedRegistry: "pageSectionRenderers / homeSectionRenderers",
  reusableBlocks: "BlockView → RegisteredBlockView (@mccoy/cms-renderer)",
  presentationAdapters: "blockPresentationAdapters (Producten/About dual-read)",
  brandChrome: "Navbar / Footer / MarketingChrome / FormPageChrome",
} as const;
