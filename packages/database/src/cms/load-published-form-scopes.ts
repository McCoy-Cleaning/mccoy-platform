/**
 * Load all active published CMS page payloads for Aanvragen scope tab discovery.
 */
import { normalizeCmsPage, type CmsPage } from "@mccoy/cms-schema";

import { builtinCmsSeedPages } from "./seeds";
import { getFileCmsStore } from "./file-store";
import { getCmsStore } from "./supabase-store";

export async function publishedPagesFromStore(store: {
  seedBuiltinsIfEmpty: (pages: CmsPage[]) => Promise<void>;
  listPages: () => Promise<Array<{ id: string }>>;
  getActivePublishedRevision: (
    pageId: string,
  ) => Promise<{ payload?: unknown } | null>;
}): Promise<CmsPage[]> {
  try {
    await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
  } catch {
    /* seed best-effort */
  }

  const pages: CmsPage[] = [];
  const rows = await store.listPages();
  for (const row of rows) {
    try {
      const rev = await store.getActivePublishedRevision(row.id);
      if (rev?.payload && typeof rev.payload === "object") {
        pages.push(normalizeCmsPage(rev.payload as CmsPage));
      }
    } catch {
      /* skip broken page */
    }
  }
  return pages;
}

export async function loadPublishedCmsPagesForFormScopes(): Promise<CmsPage[]> {
  try {
    const primary = getCmsStore();
    const fromPrimary = await publishedPagesFromStore(primary);
    if (fromPrimary.length > 0) return fromPrimary;
  } catch {
    /* try file store */
  }

  try {
    const fileStore = getFileCmsStore();
    return await publishedPagesFromStore(fileStore);
  } catch {
    return builtinCmsSeedPages().map((page) => normalizeCmsPage(page));
  }
}
