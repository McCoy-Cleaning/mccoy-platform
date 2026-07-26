/**
 * Layout-level horizontal placement for constrained-width sections.
 * Distinct from block-internal text align (e.g. hero `align`).
 */

import type { BlockType } from "./types";
import type { FixedSectionKey } from "./sections";
import type { LayoutItem } from "./layout";

export const CONTENT_ALIGNS = ["left", "center", "right"] as const;
export type ContentAlign = (typeof CONTENT_ALIGNS)[number];

export const DEFAULT_CONTENT_ALIGN: ContentAlign = "center";

/** Block types that bleed / have no meaningful constrained column to shift. */
export const FULL_WIDTH_BLOCK_TYPES: ReadonlySet<BlockType> = new Set([
  "hero",
  "spacer",
]);

/** Fixed sections that are full-bleed marketing chrome. */
export const FULL_WIDTH_FIXED_KEYS: ReadonlySet<FixedSectionKey> = new Set(["home.hero"]);

export function isContentAlign(value: unknown): value is ContentAlign {
  return value === "left" || value === "center" || value === "right";
}

/** Parse wire value; missing/invalid → undefined (caller applies default at render). */
export function parseContentAlign(value: unknown): ContentAlign | undefined {
  return isContentAlign(value) ? value : undefined;
}

export function normalizeContentAlign(value: unknown): ContentAlign {
  return parseContentAlign(value) ?? DEFAULT_CONTENT_ALIGN;
}

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

/**
 * Horizontal placement class contract (margin-auto, LTR).
 * Renderer prefers flex justify-* (see cms-renderer sectionLayout); keep this
 * map exact so callers never off-by-one:
 * - left   → ml-0 mr-auto
 * - center → mx-auto
 * - right  → ml-auto mr-0
 */
export function contentAlignMarginClass(align: ContentAlign = DEFAULT_CONTENT_ALIGN): string {
  if (align === "left") return "ml-0 mr-auto";
  if (align === "center") return "mx-auto";
  if (align === "right") return "ml-auto mr-0";
  return "mx-auto";
}
