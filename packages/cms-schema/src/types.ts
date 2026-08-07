import type { BlockLayoutItem, LayoutItem } from "./layout";
import type { BuiltinPageKey } from "./sections";
import type { PageSectionContent } from "./content";
import type { SiteNavigationContent } from "./navigation";
import type { SiteFooterContent } from "./footer";
import type { Localized, LocaleState } from "./locale";
import type { CmsPageLocaleContent, PageTranslationMetaMap } from "./seo";
import type { CmsRedirect, LocalizedPagePath } from "./paths";
import type { Block } from "./block-model";
import type { BlockType } from "./block-types";
import type { BuiltinRouteKey, CmsLink } from "./cms-link-model";
import type { TranslationFieldMetadata } from "./translation-field";

export type { Block } from "./block-model";
export type { BlockType } from "./block-types";
export type { BuiltinRouteKey, CmsLink } from "./cms-link-model";

/** Schema v6: localized page meta + publication/freshness. Public SEO runtime is Phase C. */
export const CMS_SCHEMA_VERSION = 6 as const;

export type BlockCategory =
  | "Hero & intro"
  | "Content"
  | "Media"
  | "Structure"
  | "Team & about"
  | "Conversion"
  | "Showcase"
  | "Recruitment";

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
  /**
   * Per-field EN translation status (manual / machine / intentional_blank) + source hash.
   * Optional MVP metadata persisted with the CMS JSON page payload.
   */
  enFieldDraftMeta?: Record<string, TranslationFieldMetadata>;
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
  /**
   * Producten fixed→blocks pilot state. Never infer migration from empty layout.
   * Persisted by admin after resolveProductsBlocksLayout; storefront reads only.
   */
  productsBlocksMigration?: {
    version: 1;
    status: "not_started" | "migrated" | "verified";
    migratedAt?: string;
    /** Fixed keys converted on first migrate — used to avoid recreating intentionally deleted blocks. */
    sources?: Array<"products.main" | "products.info">;
  };
  /**
   * Home hero fixed→reusable `hero` block state.
   * Persisted by admin after resolveHomeHeroBlocksLayout; storefront reads only.
   */
  homeHeroBlocksMigration?: {
    version: 1;
    status: "not_started" | "migrated" | "verified";
    migratedAt?: string;
    sources?: Array<"home.hero">;
  };
  /**
   * Over ons fixed→reusable centered/textImage blocks state.
   * Persisted by admin after resolveAboutBlocksLayout; storefront reads only.
   */
  aboutBlocksMigration?: {
    version: 1;
    status: "not_started" | "migrated" | "verified";
    migratedAt?: string;
    sources?: Array<"about.main">;
  };
  /**
   * Offerte intro + form fixed→reusable blocks state.
   * Persisted by admin after resolveOfferteBlocksLayout; storefront reads only.
   */
  offerteBlocksMigration?: {
    version: 1;
    status: "not_started" | "migrated" | "verified";
    migratedAt?: string;
    sources?: Array<"offerte.main" | "offerte.form">;
  };
  /**
   * Privacy / Terms fixed→reusable `legalArticles` block state.
   * Persisted by admin after resolveLegalBlocksLayout; storefront reads only.
   */
  legalBlocksMigration?: {
    version: 1;
    status: "not_started" | "migrated" | "verified";
    migratedAt?: string;
    sources?: Array<"privacy.main" | "terms.main">;
  };
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
  /**
   * Editor-session metadata for restore / conflict detection.
   * Cleared on save/publish/discard. Never restore when dirty:false or hash===baseline.
   */
  editorMeta?: {
    schemaVersion: number;
    layoutVersion: number;
    baselineRevisionId: string;
    baselineContentHash: string;
    contentHash: string;
    dirty: boolean;
    savedAt: number;
    /** True when this envelope was rehydrated from localStorage on a later visit. */
    restoredFromStorage?: boolean;
  };
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
  /** Published site chrome — footer across all pages. */
  footer: SiteFooterContent;
  /** Draft site footer; null/undefined means no unsaved footer edits. */
  footerDraft?: SiteFooterContent | null;
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
