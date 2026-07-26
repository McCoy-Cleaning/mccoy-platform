import { test, expect, ADMIN_ORIGIN, STOREFRONT_ORIGIN } from "./fixtures/base";

test.describe("Security (browser-observable)", () => {
  test("admin login page does not leak stack traces", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    await page.goto(`${ADMIN_ORIGIN}/admin/login`);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/at Object\.|node_modules|SUPABASE_SECRET/i);
    await ctx.close();
  });

  test("storefront form page does not expose service keys in HTML", async ({ page, failureSink }) => {
    void failureSink;
    await page.goto(`${STOREFRONT_ORIGIN}/contact`);
    const html = await page.content();
    expect(html).not.toMatch(/service_role|SUPABASE_SECRET|CLIENT_SECRET/i);
  });
});
