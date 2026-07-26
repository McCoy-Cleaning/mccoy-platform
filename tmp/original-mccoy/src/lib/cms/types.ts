export type BlockType =
  | "hero"
  | "richText"
  | "centered"
  | "textImage"
  | "columns"
  | "benefits"
  | "quote"
  | "gallery"
  | "fullImage"
  | "video"
  | "beforeAfter"
  | "carousel"
  | "steps"
  | "comparisonTable"
  | "featureGrid"
  | "spacer"
  | "teamGrid"
  | "teamProfile"
  | "values"
  | "timeline"
  | "cta"
  | "newsletter"
  | "contactForm"
  | "announcement"
  | "popup"
  | "portfolio"
  | "jobs"
  | "latestPosts";

export type BlockCategory =
  | "Hero & intro"
  | "Content"
  | "Media"
  | "Structure"
  | "Team & about"
  | "Conversion"
  | "Showcase";

export interface Block {
  id: string;
  type: BlockType;
  data: Record<string, any>;
}

export interface Page {
  id: string;
  slug: string;
  title: string;
  description: string;
  isCustom: boolean;
  inNav: boolean;
  blocks: Block[];
  updatedAt: number;
  /** True until first Save for a newly created custom page. */
  isDraftOnly?: boolean;
}

/** Content overrides for a page: flat key -> string (text or image URL). */
export type PageOverrides = Record<string, string>;

export interface CmsState {
  pages: Page[];
  /** Saved (live) overrides. Public site reads these. */
  saved: Record<string, PageOverrides>;
  /** Draft overrides being edited. Editor reads these. */
  draft: Record<string, PageOverrides>;
  version: number;
}