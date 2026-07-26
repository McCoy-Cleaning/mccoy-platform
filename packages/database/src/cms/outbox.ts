/**
 * B4 outbox consumer stub — invalidate caches / enqueue recrawl on publish.
 * Safe no-op beyond marking processed when no external consumers are wired.
 */
import type { CmsPagePublishedEvent } from "@mccoy/cms-schema";

import { getCmsStore } from "./supabase-store";

export type CmsOutboxConsumerResult = {
  processed: number;
  failed: number;
  events: CmsPagePublishedEvent[];
};

export type CmsCacheInvalidationHook = (event: CmsPagePublishedEvent) => Promise<void> | void;

const hooks: CmsCacheInvalidationHook[] = [];

export function registerCmsPublishHook(hook: CmsCacheInvalidationHook): void {
  hooks.push(hook);
}

/**
 * Process unprocessed CmsPagePublishedEvent rows.
 * Consumers: page cache, route metadata, nav, sitemap, redirects, JSON-LD, search, recrawl.
 */
export async function processCmsOutbox(limit = 50): Promise<CmsOutboxConsumerResult> {
  const store = getCmsStore();
  const rows = await store.listUnprocessedOutbox(limit);
  let processed = 0;
  let failed = 0;
  const events: CmsPagePublishedEvent[] = [];

  for (const row of rows) {
    try {
      for (const hook of hooks) {
        await hook(row.payload);
      }
      // Structured monitoring hook (F5)
      console.info(
        JSON.stringify({
          type: "cms.page.published.processed",
          eventId: row.payload.eventId,
          pageId: row.payload.pageId,
          revisionId: row.payload.revisionId,
          publishedLocales: row.payload.publishedLocales,
          changedPaths: row.payload.changedPaths,
        }),
      );
      await store.markOutboxProcessed(row.id);
      processed += 1;
      events.push(row.payload);
    } catch (error) {
      failed += 1;
      console.error("[cms-outbox] consumer failed", row.id, error);
    }
  }

  return { processed, failed, events };
}
