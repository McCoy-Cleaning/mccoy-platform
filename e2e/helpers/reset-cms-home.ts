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
  process.env.MCCOY_DATA_DIR = DATA_DIR;
  const home = builtinCmsSeedPages().find((page) => page.id === "page_home");
  if (!home) throw new Error("builtin seed missing page_home");

  const store = createFileCmsStore();
  await store.upsertPage({
    siteId: DEFAULT_CMS_SITE_ID,
    page: home,
    stableKey: home.id,
  });
  await store.publishPage({
    siteId: DEFAULT_CMS_SITE_ID,
    pageId: home.id,
    payload: home,
    publishedLocales: ["nl"],
  });
}

/** Align admin localStorage draft for home with the durable seed payload. */
export async function syncHomeLocalStorageFromStore(page: Page) {
  process.env.MCCOY_DATA_DIR = DATA_DIR;
  const store = createFileCmsStore();
  const revision = await store.getActivePublishedRevision("page_home");
  if (!revision?.payload) {
    throw new Error("reset: page_home missing published revision");
  }
  await page.evaluate((homePage) => {
    const KEY = "mccoy_cms_v1";
    const raw = window.localStorage.getItem(KEY);
    const state = raw
      ? (JSON.parse(raw) as { pages?: Array<{ id: string }> })
      : { pages: [] };
    if (!Array.isArray(state.pages)) state.pages = [];
    const idx = state.pages.findIndex((p) => p.id === homePage.id);
    if (idx >= 0) state.pages[idx] = homePage as { id: string };
    else state.pages.push(homePage as { id: string });
    window.localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new Event("mccoy-cms-change"));
    window.dispatchEvent(new Event("storage"));
  }, revision.payload);
}
