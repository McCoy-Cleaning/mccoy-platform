import type { BlockLayoutItem, LayoutItem } from "./layout";
import type { BuiltinPageKey } from "./sections";
import type { PageSectionContent } from "./content";
import type { SiteNavigationContent } from "./navigation";
import type { Localized, LocaleState } from "./locale";
import type { CmsPageLocaleContent, PageTranslationMetaMap } from "./seo";
import type { CmsRedirect, LocalizedPagePath } from "./paths";

/** Schema v6: localized page meta + publication/freshness. Public SEO runtime is Phase C. */
export const CMS_SCHEMA_VERSION = 6 as const;

export type BlockType =
  | "hero"
  | "richText"
  | "centered"
  | "textImage"
  | "columns"
  | "benefits"
  | "quote"
  | "gallery"
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
  | "roadmap"
  | "plans"
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
  | "Showcase"
  | "Recruitment";

export type BuiltinRouteKey =
  | "home"
  | "services"
  | "products"
  | "about"
  | "contact"
  | "vacatures"
  | "offerte";

export type CmsLink =
  | { type: "none" }
  | { type: "internal"; pageId: string; openInNewTab?: boolean }
  | { type: "internal_route"; route: BuiltinRouteKey; openInNewTab?: boolean }
  | { type: "external"; url: string; openInNewTab?: boolean }
  | { type: "email"; email: string; subject?: string }
  | { type: "phone"; phone: string };

export interface Block {
  id: string;
  type: BlockType;
  data: Record<string, unknown>;
  /** Canonical data shape version for this block type after edit/republish. */
  dataVersion?: number;
}

type PageBase = {
  id: string;
  /**
   * @deprecated Prefer `paths.nl`. Kept in sync as NL path for legacy readers.
   */
  slug: string;
  /**
   * @deprecated Prefer `localeContent.nl.pageTitle` / `navigationLabel`.
   */
  title: string;
  /**
   * @deprecated Prefer `localeContent.nl.seo.description`.
   */
  description: string;
  /** Locale-aware paths — NL required; EN optional until approved. Filled by ensurePageLocaleFields. */
  paths?: LocalizedPagePath;
  /** Nav label, H1, and SEO per locale. Filled by ensurePageLocaleFields. */
  localeContent?: Localized<CmsPageLocaleContent>;
  /** Publication + freshness per locale (separate dimensions). */
  localeStates?: Localized<LocaleState>;
  /** EN translation provenance at page / section / block grain. */
  translationMeta?: PageTranslationMetaMap;
  /** Historical redirects for this page (locale-scoped). */
  redirects?: CmsRedirect[];
  /**
   * Phase E MVP — English draft strings keyed by {@link enFieldDraftPath}.
   * Not public SEO until Phase C/D promote drafts into Localized content + publication.
   * On Opslaan, drafts are auto-synced from NL (translate + prune).
   */
  enFieldDrafts?: Record<string, string>;
  /**
   * NL source text that each {@link enFieldDrafts} entry was translated from.
   * Used to skip re-translation when Dutch is unchanged, and to detect stale EN.
   */
  enFieldDraftSources?: Record<string, string>;
  inNav: boolean;
  /** CMS block payloads referenced by layout (and seed content for custom pages). */
  blocks: Block[];
  updatedAt: number;
  /** Optimistic concurrency — prepared for Supabase multi-admin later. */
  version: number;
  updatedBy?: string;
  /** True until first Save for a newly created custom page. */
  isDraftOnly?: boolean;
  /**
   * @deprecated Migrated into `layout` + `blocks` in schema v3.
   * Retained optional only for raw parse / recovery; normalize clears it.
   */
  extraBlocks?: Block[];
};

export type BuiltinCmsPage = PageBase & {
  kind: "builtin";
  isCustom: false;
  /** Present for layout-capable builtins. */
  pageKey: BuiltinPageKey | null;
  layout: LayoutItem[];
  layoutVersion: number;
  /** Typed fixed-section content keyed by FixedSectionKey. */
  sectionContent: PageSectionContent;
};

export type CustomCmsPage = PageBase & {
  kind: "custom";
  isCustom: true;
  pageKey?: undefined;
  layout: BlockLayoutItem[];
  layoutVersion: number;
  sectionContent?: undefined;
};

export type CmsPage = BuiltinCmsPage | CustomCmsPage;

/** @deprecated Prefer CmsPage; kept as alias for gradual migration of app imports. */
export type Page = CmsPage;

/** Content overrides for fixed builtin sections: flat key -> string. */
export type PageOverrides = Record<string, string>;

export interface PageDraft {
  overrides: PageOverrides;
  /**
   * Draft page patch for layout-capable edits.
   * When present, replaces published layout/blocks/meta/sectionContent on apply.
   */
  page?: CmsPage;
  /** Draft typed section content (merged onto page.sectionContent on apply when page absent). */
  sectionContent?: PageSectionContent;
  /** @deprecated Prefer page.layout + page.blocks */
  blocks?: Block[];
  /** @deprecated Prefer page.layout */
  extraBlocks?: Block[];
  title?: string;
  slug?: string;
  description?: string;
  inNav?: boolean;
}

/** Explicit snapshot sent to the preview iframe — not the live draft. */
export interface PreviewSnapshot {
  pageId: string;
  version: number;
  capturedAt: number;
  page: CmsPage;
  overrides: PageOverrides;
}

export interface CmsPersistedState {
  schemaVersion: number;
  pages: CmsPage[];
  saved: Record<string, PageOverrides>;
  draft: Record<string, PageDraft>;
  /** Published site chrome — navigation across all pages. */
  navigation: SiteNavigationContent;
  /** Draft site navigation; null/undefined means no unsaved nav edits. */
  navigationDraft?: SiteNavigationContent | null;
  /** Cleared on discard / after new edits invalidate preview. */
  previewSnapshots: Record<string, PreviewSnapshot>;
  version: number;
  corruptPayload?: string;
  /** One-shot recovery copy of pre-migration payload (not re-written after first migrate). */
  migrationRecovery?: string;
}

export type PreviewStatus =
  | "locked"
  | "outdated"
  | "up_to_date"
  | "loading";

export type EditorStatus =
  | "saved"
  | "unsaved"
  | "saving"
  | "save_failed";
