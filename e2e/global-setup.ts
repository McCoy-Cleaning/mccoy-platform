import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  builtinCmsSeedPages,
  createFileCmsStore,
  DEFAULT_CMS_SITE_ID,
} from "@mccoy/database/server";
import {
  createDefaultBlock,
  normalizeCmsPage,
  syncCustomLayoutFromBlocks,
  type CmsPage,
} from "@mccoy/cms-schema";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";

ensureMonorepoEnvLoaded();

const dataDir = process.env.E2E_MCCOY_DATA_DIR ?? join(process.cwd(), ".data", "e2e-cms");

function emptyCustomPage(): CmsPage {
  const hero = createDefaultBlock("hero");
  hero.id = "b_e2e_custom_hero";
  const page = normalizeCmsPage({
    kind: "custom",
    isCustom: true,
    id: "page_e2e_custom",
    slug: "/e2e-custom",
    title: "E2E Custom",
    description: "Playwright fixture custom page",
    inNav: false,
    blocks: [hero],
    layout: [],
    layoutVersion: 0,
    updatedAt: Date.now(),
    version: 1,
    paths: { nl: "/e2e-custom", en: "/e2e-custom" },
    localeContent: {
      nl: {
        navigationLabel: "E2E Custom",
        pageTitle: "E2E Custom",
        seo: { title: "E2E Custom", description: "Playwright fixture custom page" },
      },
      en: {
        navigationLabel: "E2E Custom EN",
        pageTitle: "E2E Custom EN",
        seo: { title: "E2E Custom EN", description: "Playwright EN fixture custom page" },
      },
    },
    localeStates: {
      nl: { publicationState: "published", freshness: "current" },
      en: { publicationState: "published", freshness: "current" },
    },
  });
  if (page.kind !== "custom") throw new Error("expected custom page");
  return syncCustomLayoutFromBlocks(page);
}

/**
 * Reset isolated CMS file store and seed builtins + one published custom page.
 * Admin create is forbidden by product policy — custom pages are seeded here for E2E.
 */
export default async function globalSetup() {
  process.env.MCCOY_DATA_DIR = dataDir;
  process.env.ADMIN_LEGACY_AUTH = process.env.ADMIN_LEGACY_AUTH ?? "true";
  process.env.MCCOY_E2E = "1";

  rmSync(dataDir, { recursive: true, force: true });
  mkdirSync(dataDir, { recursive: true });

  writeFileSync(
    join(dataDir, "website-requests.json"),
    `${JSON.stringify({ version: 1, sequence: 0, requests: [] }, null, 2)}\n`,
    "utf8",
  );

  const store = createFileCmsStore();
  await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());

  const custom = emptyCustomPage();
  await store.upsertPage({
    siteId: DEFAULT_CMS_SITE_ID,
    page: custom,
    stableKey: custom.id,
  });

  // Seed/publish run in the test-runner process while the already-started
  // storefront/admin webServer processes hold their own file-store handle on
  // the same on-disk file. Confirm the upsert is actually readable before
  // publishing so a transient cross-process read miss self-heals via one
  // re-upsert instead of hard-failing global setup with "page not found".
  let persisted = await store.getPage(custom.id, DEFAULT_CMS_SITE_ID);
  if (!persisted) {
    await store.upsertPage({
      siteId: DEFAULT_CMS_SITE_ID,
      page: custom,
      stableKey: custom.id,
    });
    persisted = await store.getPage(custom.id, DEFAULT_CMS_SITE_ID);
  }
  if (!persisted) {
    throw new Error(`e2e global setup: custom page ${custom.id} was not persisted before publish`);
  }

  await store.publishPage({
    siteId: DEFAULT_CMS_SITE_ID,
    pageId: custom.id,
    payload: custom,
    publishedLocales: ["nl", "en"],
  });
}
