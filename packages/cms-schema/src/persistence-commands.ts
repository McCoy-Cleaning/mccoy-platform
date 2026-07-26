/**
 * Draft update command — optimistic concurrency for Phase B repositories.
 * Reject when expectedRevisionNumber !== cms_pages.draft_revision_number.
 */
export type CmsDraftChanges = {
  payload?: unknown;
  inNav?: boolean;
  localePatches?: unknown;
};

export type DraftUpdateCommand = {
  pageId: string;
  expectedRevisionNumber: number;
  changes: CmsDraftChanges;
};

export type CmsPagePublishedEvent = {
  eventId: string;
  siteId: string;
  pageId: string;
  revisionId: string;
  publishedLocales: Array<"nl" | "en">;
  changedPaths: string[];
  occurredAt: string;
};
