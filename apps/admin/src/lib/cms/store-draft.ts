/**
 * Stage 6 — CMS store draft/layout helpers.
 * Shared draft commit path used by layout mutations, EN drafts, and publish.
 */
import {
  applyDraftToPage,
  createItemId,
  type CmsPage,
  type CmsPersistedState,
  type LayoutOperationResult,
  type PageDraft,
} from "@mccoy/cms-schema";
import {
  markPreviewStale,
  read,
  writeOrAlert,
} from "./store-persistence";

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Regenerate `id` fields on nested arrays when duplicating a section. */
export function regenerateNestedIds(data: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = { ...data };
  for (const [key, value] of Object.entries(next)) {
    if (!Array.isArray(value)) continue;
    next[key] = value.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const row = { ...(entry as Record<string, unknown>) };
      if (typeof row.id === "string") row.id = createItemId("item");
      return row;
    });
  }
  return next;
}

export function getOrInitDraft(s: CmsPersistedState, pageId: string): PageDraft {
  if (!s.draft[pageId]) s.draft[pageId] = { overrides: {} };
  if (!s.draft[pageId].overrides) s.draft[pageId].overrides = {};
  return s.draft[pageId];
}

export function publishedPage(s: CmsPersistedState, pageId: string): CmsPage | undefined {
  return s.pages.find((p) => p.id === pageId);
}

export function editablePage(s: CmsPersistedState, pageId: string): CmsPage | undefined {
  const page = publishedPage(s, pageId);
  if (!page) return undefined;
  return applyDraftToPage(page, s.draft[pageId]);
}

export function pagesForNavCap(s: CmsPersistedState): CmsPage[] {
  return s.pages.map((p) => editablePage(s, p.id) ?? p);
}

export function commitDraftPage(s: CmsPersistedState, pageId: string, nextPage: CmsPage) {
  const prev = s.draft[pageId] ?? { overrides: {} };
  // New draft object reference so React effects (edit-bridge bump) re-run.
  s.draft = {
    ...s.draft,
    [pageId]: {
      ...prev,
      overrides: { ...(prev.overrides ?? {}) },
      page: structuredClone(nextPage),
    },
  };
  markPreviewStale(pageId);
  writeOrAlert({ ...s, draft: s.draft });
}

export function applyLayoutResult(pageId: string, result: LayoutOperationResult): LayoutOperationResult {
  if (!result.ok) return result;
  const s = read();
  if (!publishedPage(s, pageId)) return { ok: false, code: "UNKNOWN_SECTION" };
  commitDraftPage(s, pageId, result.page);
  return result;
}
