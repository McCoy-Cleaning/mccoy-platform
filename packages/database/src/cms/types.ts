import type {
  CmsPage,
  CmsPagePublishedEvent,
  DraftUpdateCommand,
  Locale,
  LocalePublicationState,
  TranslationFreshness,
} from "@mccoy/cms-schema";

export const DEFAULT_CMS_SITE_ID = "a0000000-0000-4000-8000-000000000001";
export const DEFAULT_CMS_SITE_SLUG = "mccoy";

export type CmsSiteRecord = {
  id: string;
  slug: string;
  origin: string;
  configVersion: number;
  createdAt: string;
  updatedAt: string;
};

export type CmsPageRecord = {
  id: string;
  siteId: string;
  stableKey: string | null;
  kind: "builtin" | "custom";
  pageKey: string | null;
  inNav: boolean;
  isDraftOnly: boolean;
  draftRevisionNumber: number;
  activePublishedRevisionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CmsRevisionRecord = {
  id: string;
  siteId: string;
  pageId: string;
  revisionNumber: number;
  status: "draft" | "review" | "published" | "superseded" | "archived";
  payload: CmsPage;
  createdAt: string;
  createdBy: string | null;
  publishedAt: string | null;
};

export type CmsLocaleStateRecord = {
  pageId: string;
  siteId: string;
  locale: Locale;
  publicationState: LocalePublicationState;
  freshness: TranslationFreshness;
  path: string;
  publicPath: string;
};

export type CmsRedirectRecord = {
  id: string;
  siteId: string;
  pageId: string | null;
  locale: Locale;
  fromPath: string;
  toPath: string;
  statusCode: 301 | 308;
  createdAt: string;
  retiredAt: string | null;
};

export type CmsOutboxRecord = {
  id: string;
  siteId: string;
  eventType: string;
  payload: CmsPagePublishedEvent;
  createdAt: string;
  processedAt: string | null;
  attempts: number;
};

export type PublishPageInput = {
  siteId: string;
  pageId: string;
  payload: CmsPage;
  publishedLocales: Locale[];
  createdBy?: string | null;
  expectedDraftRevision?: number | null;
};

export type PublishPageResult = {
  revisionId: string;
  revisionNumber: number;
  eventId: string;
  draftRevisionNumber: number;
  event: CmsPagePublishedEvent;
};

export type RollbackPageInput = {
  siteId: string;
  pageId: string;
  targetRevisionId: string;
  createdBy?: string | null;
};

export type UpsertPageInput = {
  siteId: string;
  page: CmsPage;
  stableKey?: string | null;
};

export type DeletePageInput = {
  siteId: string;
  pageId: string;
};

export type DeletePageResult = {
  /** False when the page was already absent (idempotent). */
  deleted: boolean;
};

export type DraftConflictError = {
  code: "conflict";
  message: string;
  currentRevisionNumber: number;
};

export type CmsPublishedLookup = {
  page: CmsPage;
  revisionId: string;
  publishedAt: string;
  localeState: CmsLocaleStateRecord;
  site: CmsSiteRecord;
};

/**
 * CMS persistence port — file store (local) or Supabase (production).
 */
export interface CmsStore {
  getSite(siteId?: string): Promise<CmsSiteRecord>;
  listPages(siteId?: string): Promise<CmsPageRecord[]>;
  getPage(pageId: string, siteId?: string): Promise<CmsPageRecord | null>;
  upsertPage(input: UpsertPageInput): Promise<CmsPageRecord>;
  getDraftPayload(pageId: string, siteId?: string): Promise<CmsPage | null>;
  saveDraft(command: DraftUpdateCommand & { siteId?: string; payload: CmsPage }): Promise<{
    draftRevisionNumber: number;
  }>;
  getActivePublishedRevision(
    pageId: string,
    siteId?: string,
  ): Promise<CmsRevisionRecord | null>;
  listRevisions(pageId: string, siteId?: string): Promise<CmsRevisionRecord[]>;
  publishPage(input: PublishPageInput): Promise<PublishPageResult>;
  rollbackPage(input: RollbackPageInput): Promise<PublishPageResult>;
  findPublishedByPublicPath(
    locale: Locale,
    publicPath: string,
    siteId?: string,
  ): Promise<CmsPublishedLookup | null>;
  listPublishedLocaleStates(siteId?: string): Promise<CmsLocaleStateRecord[]>;
  listActiveRedirects(siteId?: string): Promise<CmsRedirectRecord[]>;
  upsertRedirect(
    redirect: Omit<CmsRedirectRecord, "createdAt" | "retiredAt"> & {
      createdAt?: string;
      retiredAt?: string | null;
    },
  ): Promise<CmsRedirectRecord>;
  listUnprocessedOutbox(limit?: number): Promise<CmsOutboxRecord[]>;
  markOutboxProcessed(eventId: string): Promise<void>;
  /**
   * Permanently remove a custom page and all related i18n/SEO/publish artifacts.
   * Built-in pages cannot be deleted. Idempotent when the page is already gone.
   */
  deletePage(input: DeletePageInput): Promise<DeletePageResult>;
  seedBuiltinsIfEmpty(pages: CmsPage[], siteId?: string): Promise<void>;
}
