import { join } from "node:path";
import {
  builtinCmsSeedPages,
  createFileCmsStore,
  DEFAULT_CMS_SITE_ID,
} from "@mccoy/database/server";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";
import type { Page } from "@playwright/test";

ensureMonorepoEnvLoaded();

const DATA_DIR = process.env.E2E_MCCOY_DATA_DIR ?? join(process.cwd(), ".data", "e2e-cms");

/**
 * Force home back to the builtin seed (draft + published).
 * Screenshot baselines assume exactly the four fixed home sections before adds.
 */
export async function resetHomeToBuiltinSeed() {
  await resetBuiltinPagesToSeed(["page_home"]);
}

/** Publish builtin seed for one or more pages (deterministic E10 fixtures). */
export async function resetBuiltinPagesToSeed(pageIds: readonly string[]) {
  process.env.MCCOY_DATA_DIR = DATA_DIR;
  const seeds = builtinCmsSeedPages();
  const store = createFileCmsStore();
  for (const pageId of pageIds) {
    const page = seeds.find((p) => p.id === pageId);
    if (!page) throw new Error(`builtin seed missing ${pageId}`);
    await store.upsertPage({
      siteId: DEFAULT_CMS_SITE_ID,
      page,
      stableKey: page.id,
    });
    await store.publishPage({
      siteId: DEFAULT_CMS_SITE_ID,
      pageId: page.id,
      payload: page,
      publishedLocales: ["nl"],
    });
  }
}

/** Align admin localStorage draft for home with the durable seed payload. */
export async function syncHomeLocalStorageFromStore(page: Page) {
  await syncBuiltinPagesLocalStorageFromStore(page, ["page_home"]);
}

/** Align admin localStorage drafts with published seed payloads for the given pages. */
export async function syncBuiltinPagesLocalStorageFromStore(
  page: Page,
  pageIds: readonly string[],
) {
  process.env.MCCOY_DATA_DIR = DATA_DIR;
  const store = createFileCmsStore();
  const payloads: unknown[] = [];
  for (const pageId of pageIds) {
    const revision = await store.getActivePublishedRevision(pageId);
    if (!revision?.payload) {
      throw new Error(`reset: ${pageId} missing published revision`);
    }
    payloads.push(revision.payload);
  }
  await page.evaluate((pages) => {
    const KEY = "mccoy_cms_v1";
    const raw = window.localStorage.getItem(KEY);
    const state = raw
      ? (JSON.parse(raw) as { pages?: Array<{ id: string }> })
      : { pages: [] };
    if (!Array.isArray(state.pages)) state.pages = [];
    for (const homePage of pages as Array<{ id: string }>) {
      const idx = state.pages.findIndex((p) => p.id === homePage.id);
      if (idx >= 0) state.pages[idx] = homePage;
      else state.pages.push(homePage);
    }
    window.localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new Event("mccoy-cms-change"));
    window.dispatchEvent(new Event("storage"));
  }, payloads);
}
