import { test as setup, expect } from "@playwright/test";
import { join } from "node:path";
import {
  ADMIN_LEGACY_COOKIE_NAME,
  mintLegacyAdminSessionToken,
} from "@mccoy/security";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";
import { createFileCmsStore } from "@mccoy/database/server";

ensureMonorepoEnvLoaded();

const AUTH_FILE = join(process.cwd(), "e2e", ".auth", "admin.json");
const ADMIN_ORIGIN = process.env.E2E_ADMIN_ORIGIN ?? "http://localhost:5174";
const DATA_DIR = process.env.E2E_MCCOY_DATA_DIR ?? join(process.cwd(), ".data", "e2e-cms");

setup("authenticate admin (legacy)", async ({ page }) => {
  // Match playwright.config.ts e2eServerEnv secrets/credentials.
  process.env.ADMIN_SESSION_SECRET =
    process.env.E2E_ADMIN_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET ||
    "mccoy-e2e-admin-session-secret-32b";
  process.env.MCCOY_E2E = "1";
  process.env.MCCOY_DATA_DIR = DATA_DIR;

  const username = process.env.E2E_ADMIN_USERNAME || "admin";
  const token = mintLegacyAdminSessionToken(username);
  const url = new URL(ADMIN_ORIGIN);

  await page.context().addCookies([
    {
      name: ADMIN_LEGACY_COOKIE_NAME,
      value: token,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);

  await page.goto("/website");
  await expect(page).not.toHaveURL(/\/admin\/login/);
  await expect(page.getByRole("link", { name: "Website" }).first()).toBeVisible({
    timeout: 30_000,
  });

  // Seeded custom pages live in the durable file store. Ensure the admin editor
  // localStorage also lists them so /website/$id is reachable.
  const store = createFileCmsStore();
  const revision = await store.getActivePublishedRevision("page_e2e_custom");
  if (!revision?.payload) {
    throw new Error("E2E setup: page_e2e_custom missing from durable CMS store");
  }
  await page.evaluate((customPage) => {
    const KEY = "mccoy_cms_v1";
    const raw = window.localStorage.getItem(KEY);
    const state = raw
      ? (JSON.parse(raw) as { pages?: Array<{ id: string }> })
      : { pages: [] };
    if (!Array.isArray(state.pages)) state.pages = [];
    const idx = state.pages.findIndex((p) => p.id === customPage.id);
    if (idx >= 0) state.pages[idx] = customPage as { id: string };
    else state.pages.push(customPage as { id: string });
    window.localStorage.setItem(KEY, JSON.stringify(state));
    window.dispatchEvent(new Event("mccoy-cms-change"));
    window.dispatchEvent(new Event("storage"));
  }, revision.payload);
  await page.reload();
  // Reconcile may briefly purge before hydrating remote customs — wait for the seed.
  await expect(page.getByRole("link", { name: /E2E Custom/i }).first()).toBeVisible({
    timeout: 60_000,
  });

  await page.context().storageState({ path: AUTH_FILE });
});
