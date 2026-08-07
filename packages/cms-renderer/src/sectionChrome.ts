import type { BlockType } from "@mccoy/cms-schema";
import type { SectionWidthMode } from "./sectionLayout";

/** Who renders the visible section heading. */
export type SectionHeaderMode = "shell" | "block" | "none";

/**
 * `none` — no shared surface
 * `section` — one section-level surface wrapping content (flat items inside)
 * `items` — section plain; item cards use SectionSurface
 */
export type SectionSurfaceMode = "none" | "section" | "items";

export type SectionSurfaceVariant =
  | "plain"
  | "outlined"
  | "elevated"
  | "media"
  | "form"
  | "featured";

export type SectionChromeConfig = {
  headerMode: SectionHeaderMode;
  surfaceMode: SectionSurfaceMode;
  widthMode: SectionWidthMode;
  /** Soft static ambient wash behind content (no animated blobs). */
  ambient?: boolean;
  /** Default item surface when surfaceMode is `items`. */
  itemVariant?: SectionSurfaceVariant;
  /** Section-level surface when surfaceMode is `section`. */
  sectionVariant?: SectionSurfaceVariant;
};

const PAGE_ITEMS: SectionChromeConfig = {
  headerMode: "block",
  surfaceMode: "items",
  widthMode: "page",
  ambient: true,
  itemVariant: "outlined",
};

const PAGE_BLOCK: SectionChromeConfig = {
  headerMode: "block",
  surfaceMode: "none",
  widthMode: "page",
  ambient: true,
};

const READING: SectionChromeConfig = {
  headerMode: "block",
  surfaceMode: "none",
  widthMode: "reading",
  ambient: false,
};

const FORM_SECTION: SectionChromeConfig = {
  headerMode: "block",
  surfaceMode: "section",
  widthMode: "form",
  ambient: true,
  sectionVariant: "form",
};

/**
 * Explicit chrome contract per CMS block type.
 * Never infer header ownership from the presence of a title field.
 */
export const BLOCK_CHROME_CONFIG: Record<BlockType, SectionChromeConfig> = {
  hero: { headerMode: "block", surfaceMode: "none", widthMode: "fullBleed", ambient: false },
  richText: READING,
  centered: { headerMode: "block", surfaceMode: "none", widthMode: "wideReading", ambient: false },
  textImage: PAGE_BLOCK,
  columns: PAGE_ITEMS,
  benefits: PAGE_ITEMS,
  quote: {
    headerMode: "block",
    surfaceMode: "items",
    widthMode: "wideReading",
    ambient: false,
    itemVariant: "elevated",
  },
  gallery: { headerMode: "block", surfaceMode: "none", widthMode: "media", ambient: false },
  video: { headerMode: "block", surfaceMode: "none", widthMode: "media", ambient: false },
  beforeAfter: { headerMode: "block", surfaceMode: "items", widthMode: "media", ambient: false, itemVariant: "media" },
  carousel: { headerMode: "block", surfaceMode: "none", widthMode: "media", ambient: false },
  steps: PAGE_ITEMS,
  comparisonTable: { headerMode: "block", surfaceMode: "section", widthMode: "page", ambient: false, sectionVariant: "outlined" },
  featureGrid: PAGE_ITEMS,
  spacer: { headerMode: "none", surfaceMode: "none", widthMode: "fullBleed", ambient: false },
  teamGrid: PAGE_ITEMS,
  teamProfile: PAGE_BLOCK,
  values: PAGE_ITEMS,
  timeline: PAGE_ITEMS,
  roadmap: PAGE_ITEMS,
  plans: PAGE_ITEMS,
  cta: { headerMode: "block", surfaceMode: "section", widthMode: "page", ambient: true, sectionVariant: "featured" },
  newsletter: FORM_SECTION,
  /** Page two-column; form panel owns its own surface (not shell form rail). */
  contactForm: {
    headerMode: "block",
    surfaceMode: "none",
    widthMode: "page",
    ambient: true,
  },
  announcement: { headerMode: "none", surfaceMode: "none", widthMode: "fullBleed", ambient: false },
  popup: { headerMode: "block", surfaceMode: "section", widthMode: "form", ambient: false, sectionVariant: "elevated" },
  portfolio: PAGE_ITEMS,
  jobs: PAGE_ITEMS,
  latestPosts: PAGE_ITEMS,
  partnersMarquee: { headerMode: "block", surfaceMode: "none", widthMode: "fullBleed", ambient: false },
  statsCounters: PAGE_BLOCK,
  contactInfoCards: PAGE_ITEMS,
  quoteRequestForm: FORM_SECTION,
  legalArticles: {
    headerMode: "block",
    surfaceMode: "items",
    widthMode: "wideReading",
    ambient: false,
    itemVariant: "outlined",
  },
  offers: {
    headerMode: "block",
    surfaceMode: "none",
    widthMode: "page",
    ambient: true,
  },
};

export function getBlockChromeConfig(type: BlockType): SectionChromeConfig {
  return BLOCK_CHROME_CONFIG[type];
}
