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

  test("storefront sends baseline security headers", async ({ request }) => {
    const res = await request.get(`${STOREFRONT_ORIGIN}/`);
    expect(res.headers()["x-content-type-options"]?.toLowerCase()).toBe("nosniff");
    expect(res.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    const csp = res.headers()["content-security-policy"] ?? "";
    expect(csp).toMatch(/object-src\s+'none'/);
    expect(csp).toMatch(/frame-ancestors/);
    // Storefront must remain embeddable by admin CMS preview (not DENY).
    expect(res.headers()["x-frame-options"]).toBeFalsy();
  });

  test("admin sends clickjacking denial headers", async ({ request }) => {
    const res = await request.get(`${ADMIN_ORIGIN}/admin/login`);
    expect(res.headers()["x-content-type-options"]?.toLowerCase()).toBe("nosniff");
    expect(res.headers()["x-frame-options"]?.toUpperCase()).toBe("DENY");
    const csp = res.headers()["content-security-policy"] ?? "";
    expect(csp).toMatch(/frame-ancestors\s+'none'/);
  });
});
