import { test, expect, STOREFRONT_ORIGIN } from "./fixtures/base";

test.describe("Public CMS + localization smoke", () => {
  test("NL home loads; EN home stays on /en or redirects when unpublished", async ({
    page,
    failureSink,
  }) => {
    void failureSink;
    await page.goto(`${STOREFRONT_ORIGIN}/`);
    await expect(page.locator("body")).toBeVisible();

    await page.goto(`${STOREFRONT_ORIGIN}/en/`);
    await expect(page.locator("body")).toBeVisible();
    // Unpublished EN locale may 302 to NL `/` (product policy). Either is acceptable for smoke.
    await expect(page).toHaveURL(/\/(en\/?)?$/);
  });

  test("language toggle is keyboard reachable when present", async ({ page, failureSink }) => {
    void failureSink;
    await page.goto(`${STOREFRONT_ORIGIN}/`);
    const toggle = page.getByRole("button", { name: /EN|NL|English|Nederlands/i }).or(
      page.getByRole("link", { name: /^EN$|^NL$/i }),
    );
    if (await toggle.first().isVisible().catch(() => false)) {
      await toggle.first().focus();
      await expect(toggle.first()).toBeFocused();
    }
  });

  test("about / services / products CMS pages render", async ({ page, failureSink }) => {
    void failureSink;
    for (const path of ["/about", "/services", "/products"]) {
      await page.goto(`${STOREFRONT_ORIGIN}${path}`);
      await expect(page.locator("main, body").first()).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/Internal Server Error/i);
    }
  });
});
