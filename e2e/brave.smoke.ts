import { test, expect } from "@playwright/test";

/**
 * Optional local Brave smoke — skipped unless BRAVE_PATH / PLAYWRIGHT_BRAVE_PATH is set
 * and the brave-smoke project is enabled in playwright.config.ts.
 */
test("Brave smoke: admin website loads", async ({ page }) => {
  await page.goto("/admin/website");
  await expect(page.getByRole("heading", { name: /Website/i })).toBeVisible();
});
