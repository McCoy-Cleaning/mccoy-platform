/**
 * Layout-level horizontal placement for constrained-width sections.
 * Leaf module — no layout/types imports.
 */

export const CONTENT_ALIGNS = ["left", "center", "right"] as const;
export type ContentAlign = (typeof CONTENT_ALIGNS)[number];

export const DEFAULT_CONTENT_ALIGN: ContentAlign = "center";

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
