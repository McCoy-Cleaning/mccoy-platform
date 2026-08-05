/**
 * Layout-level horizontal placement for constrained-width sections.
 * Distinct from block-internal text align (e.g. hero `align`).
 */

import type { BlockType } from "./block-types";
import type { FixedSectionKey } from "./sections";
import type { LayoutItem } from "./layout";
import {
  CONTENT_ALIGNS,
  DEFAULT_CONTENT_ALIGN,
  contentAlignMarginClass,
  isContentAlign,
  normalizeContentAlign,
  parseContentAlign,
  type ContentAlign,
} from "./content-align";

export {
  CONTENT_ALIGNS,
  DEFAULT_CONTENT_ALIGN,
  contentAlignMarginClass,
  isContentAlign,
  normalizeContentAlign,
  parseContentAlign,
  type ContentAlign,
};

/** Block types that bleed / have no meaningful constrained column to shift. */
export const FULL_WIDTH_BLOCK_TYPES: ReadonlySet<BlockType> = new Set([
  "hero",
  "spacer",
]);

/** Fixed sections that are full-bleed marketing chrome. */
export const FULL_WIDTH_FIXED_KEYS: ReadonlySet<FixedSectionKey> = new Set(["home.hero"]);

export function blockTypeSupportsContentAlign(type: BlockType): boolean {
  return !FULL_WIDTH_BLOCK_TYPES.has(type);
}

export function fixedKeySupportsContentAlign(key: FixedSectionKey): boolean {
  return !FULL_WIDTH_FIXED_KEYS.has(key);
}

export function layoutItemSupportsContentAlign(
  item: LayoutItem,
  blockType?: BlockType | null,
): boolean {
  if (item.kind === "fixed") return fixedKeySupportsContentAlign(item.key);
  if (!blockType) return false;
  return blockTypeSupportsContentAlign(blockType);
}

export function resolveLayoutItemContentAlign(item: LayoutItem): ContentAlign {
  return normalizeContentAlign(item.contentAlign);
}
