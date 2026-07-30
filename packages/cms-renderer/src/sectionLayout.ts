/**
 * Shared section rhythm for CMS blocks and storefront marketing sections.
 * Keep class strings complete and static so Tailwind `@source` can detect them.
 *
 * Horizontal layout (LTR):
 *   section (full-bleed background / optional ambient)
 *     → page rail (SECTION_PAGE_RAIL + gutters)
 *       → align row (flex justify-* places the content column)
 *         → density rail (reading / form / media) when needed
 *
 * Wider page rail ≠ wider text measure — use reading/form rails inside.
 */

import { DEFAULT_CONTENT_ALIGN, type ContentAlign } from "@mccoy/cms-schema";

export const SECTION_SHELL_Y = "relative py-28 sm:py-36";

export const SECTION_SHELL_Y_HERO = "relative overflow-hidden py-28 sm:py-40";

/** Slightly tighter band for full-bleed image sections. */
export const SECTION_SHELL_Y_COMPACT = "relative py-16 sm:py-24";

/**
 * Primary page content rail — shared by navbar, footer, fixed sections, CMS shells.
 * ~96rem / 1536px (was max-w-7xl ≈ 1280px).
 */
export const SECTION_PAGE_RAIL =
  "mx-auto w-full max-w-[96rem] px-5 sm:px-8 lg:px-10 xl:px-12";

/** Readable article / rich-text column inside the page rail. */
export const SECTION_READING_RAIL = "mx-auto w-full max-w-3xl";

/** Slightly wider reading column (legal, long-form). */
export const SECTION_WIDE_READING_RAIL = "mx-auto w-full max-w-4xl";

/** Focused form controls column. */
export const SECTION_FORM_RAIL = "mx-auto w-full max-w-2xl";

/** Wide media / mosaic stage aligned to the page rail max (no extra gutters). */
export const SECTION_MEDIA_RAIL = "mx-auto w-full max-w-[96rem]";

/**
 * Break out of a centered page rail to viewport width.
 * Prefer {@link FullBleed} for nesting; test overflow at every breakpoint.
 * Uses 100vw + centering; parent sections should use `overflow-x-hidden` when needed.
 */
export const SECTION_FULL_BLEED =
  "relative left-[50%] right-[50%] ml-[-50vw] mr-[-50vw] w-[100vw] max-w-none";

export type SectionInnerMaxWidth = "7xl" | "3xl" | "2xl" | "4xl" | "page";

export type SectionWidthMode =
  | "page"
  | "reading"
  | "wideReading"
  | "form"
  | "media"
  | "fullBleed";

/**
 * Content column widths inside the page rail.
 * No horizontal padding here — gutters are on {@link SECTION_PAGE_RAIL}.
 *
 * Use `w-fit` (not `basis-full` / `w-full`) so the column shrinks to its content
 * for contentAlign — except `page` which fills the rail for grids/galleries.
 */
const SECTION_INNER_WIDTH: Record<SectionInnerMaxWidth, string> = {
  page: "min-w-0 w-full max-w-full",
  "7xl": "min-w-0 w-fit max-w-full",
  "4xl": "min-w-0 w-fit max-w-4xl",
  "3xl": "min-w-0 w-fit max-w-3xl",
  "2xl": "min-w-0 w-fit max-w-2xl",
};

export function sectionWidthModeToInnerMax(
  mode: SectionWidthMode,
): SectionInnerMaxWidth {
  switch (mode) {
    case "reading":
      return "3xl";
    case "wideReading":
      return "4xl";
    case "form":
      return "2xl";
    case "media":
    case "page":
    case "fullBleed":
      return "page";
    default:
      return "7xl";
  }
}

/**
 * Force Tailwind to emit align + width utilities even if a call site is dynamic.
 */
export const CONTENT_ALIGN_TW_SOURCE =
  "flex w-full justify-start justify-center justify-end min-w-0 w-fit w-full max-w-full max-w-3xl max-w-2xl max-w-4xl max-w-7xl max-w-[96rem] mx-auto ml-0 mr-auto ml-auto mr-0 px-4 px-5 sm:px-6 sm:px-8 lg:px-8 lg:px-10 xl:px-12 left-[50%] right-[50%] ml-[-50vw] mr-[-50vw] w-[100vw] max-w-none";

/** @deprecated Prefer rail + column. Kept for CityLanding and similar one-class call sites. */
export const SECTION_INNER_BASE =
  "w-full max-w-[96rem] px-5 sm:px-8 lg:px-10 xl:px-12";

export function contentAlignJustifyClass(align: ContentAlign = DEFAULT_CONTENT_ALIGN): string {
  if (align === "left") return "justify-start";
  if (align === "right") return "justify-end";
  return "justify-center";
}

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
 */
export function sectionInnerClass(
  align: ContentAlign = DEFAULT_CONTENT_ALIGN,
  maxWidth: SectionInnerMaxWidth = "7xl",
): string {
  const width =
    maxWidth === "3xl"
      ? "w-full max-w-3xl px-5 sm:px-8 lg:px-10 xl:px-12"
      : maxWidth === "2xl"
        ? "w-full max-w-2xl px-5 sm:px-8 lg:px-10 xl:px-12"
        : maxWidth === "4xl"
          ? "w-full max-w-4xl px-5 sm:px-8 lg:px-10 xl:px-12"
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

/** Shared gallery / mosaic responsive sizes for the wider page rail. */
export const SECTION_MEDIA_SIZES =
  "(min-width: 1536px) 1440px, (min-width: 1280px) calc(100vw - 96px), (min-width: 768px) calc(100vw - 64px), calc(100vw - 40px)";
