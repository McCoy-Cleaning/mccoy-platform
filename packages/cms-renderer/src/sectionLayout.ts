/**
 * Shared section rhythm for CMS blocks and storefront marketing sections.
 * Keep class strings complete and static so Tailwind `@source` can detect them.
 *
 * Vertical padding and title→content gaps are intentionally generous so
 * published pages and admin preview feel open, not cramped.
 *
 * Horizontal layout (LTR):
 *   section (full-bleed background)
 *     → page rail (max-w-7xl + gutters, always centered)
 *       → align row (flex justify-* places the content column)
 *         → content column (optional narrower max-w-3xl / 2xl)
 *
 * contentAlign shifts the column inside the page rail — not the viewport —
 * so Links/Midden/Rechts line up with the same edges as other sections.
 */

import { DEFAULT_CONTENT_ALIGN, type ContentAlign } from "@mccoy/cms-schema";

export const SECTION_SHELL_Y = "relative py-28 sm:py-36";

export const SECTION_SHELL_Y_HERO = "relative overflow-hidden py-28 sm:py-40";

/** Slightly tighter band for full-bleed image sections. */
export const SECTION_SHELL_Y_COMPACT = "relative py-16 sm:py-24";

export type SectionInnerMaxWidth = "7xl" | "3xl" | "2xl";

/**
 * Centered page content rail. Gutters live here so left/center/right columns
 * share the same flush edges as the rest of the site.
 */
export const SECTION_PAGE_RAIL = "mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8";

/**
 * Content column widths inside the page rail.
 * No horizontal padding here — gutters are on {@link SECTION_PAGE_RAIL}.
 *
 * Use `w-fit` (not `basis-full` / `w-full`) so the column shrinks to its content.
 * A full-width flex child has zero free space, so justify-* cannot move it — that
 * made Links look like Midden when the visible copy was only half the rail.
 */
const SECTION_INNER_WIDTH: Record<SectionInnerMaxWidth, string> = {
  "7xl": "min-w-0 w-fit max-w-full",
  "3xl": "min-w-0 w-fit max-w-3xl",
  "2xl": "min-w-0 w-fit max-w-2xl",
};

/**
 * Force Tailwind to emit align + width utilities even if a call site is dynamic.
 * Referenced from sectionInnerAlignRowClass / sectionInnerColumnClass paths.
 */
export const CONTENT_ALIGN_TW_SOURCE =
  "flex w-full justify-start justify-center justify-end min-w-0 w-fit max-w-full max-w-3xl max-w-2xl max-w-7xl mx-auto ml-0 mr-auto ml-auto mr-0 px-4 sm:px-6 lg:px-8";

/** @deprecated Prefer rail + column. Kept for CityLanding and similar one-class call sites. */
export const SECTION_INNER_BASE = "w-full max-w-7xl px-4 sm:px-6 lg:px-8";

/**
 * Flex justify utilities for horizontal placement of the constrained column.
 * Static complete strings so Tailwind `@source` on this package emits them.
 */
export function contentAlignJustifyClass(align: ContentAlign = DEFAULT_CONTENT_ALIGN): string {
  if (align === "left") return "justify-start";
  if (align === "right") return "justify-end";
  return "justify-center";
}

/**
 * Full-width flex row that places the content column via justify-*.
 * Must sit inside {@link SECTION_PAGE_RAIL}.
 */
export function sectionInnerAlignRowClass(align: ContentAlign = DEFAULT_CONTENT_ALIGN): string {
  if (align === "left") return "flex w-full justify-start";
  if (align === "right") return "flex w-full justify-end";
  return "flex w-full justify-center";
}

export function sectionInnerColumnClass(maxWidth: SectionInnerMaxWidth = "7xl"): string {
  return SECTION_INNER_WIDTH[maxWidth];
}

/**
 * @deprecated Prefer rail + {@link sectionInnerAlignRowClass} + {@link sectionInnerColumnClass}.
 * Single-node fallback: gutters + max width + margin placement (legacy callers).
 */
export function sectionInnerClass(
  align: ContentAlign = DEFAULT_CONTENT_ALIGN,
  maxWidth: SectionInnerMaxWidth = "7xl",
): string {
  const width =
    maxWidth === "3xl"
      ? "w-full max-w-3xl px-4 sm:px-6 lg:px-8"
      : maxWidth === "2xl"
        ? "w-full max-w-2xl px-4 sm:px-6 lg:px-8"
        : SECTION_INNER_BASE;
  if (align === "left") return `ml-0 mr-auto ${width}`;
  if (align === "right") return `ml-auto mr-0 ${width}`;
  return `mx-auto ${width}`;
}

/** Default centered constrained column — legacy alias for storefront sections. */
export const SECTION_INNER = `mx-auto ${SECTION_INNER_BASE}`;

export const SECTION_TITLE =
  "mb-14 font-display text-3xl font-semibold tracking-tight text-white break-words sm:mb-20 sm:text-4xl";

/** Title used when empty-state copy sits directly under the heading. */
export const SECTION_TITLE_TIGHT =
  "mb-6 font-display text-3xl font-semibold text-white break-words sm:mb-8 sm:text-4xl";

export const SECTION_GRID = "grid gap-6 sm:gap-8 lg:gap-10";

export const SECTION_STACK = "space-y-8 sm:space-y-10";

export const SECTION_HEADER_TO_CONTENT = "mt-14 sm:mt-20";
