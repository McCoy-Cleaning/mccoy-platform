import { test, expect, STOREFRONT_ORIGIN, ADMIN_ORIGIN } from "./fixtures/base";

test.describe("P0 smoke — admin + storefront shell", () => {
  test("admin website hub loads for authenticated staff", async ({ page, failureSink }) => {
    void failureSink;
    await page.goto(`${ADMIN_ORIGIN}/website`);
    await expect(page).not.toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: /Website/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("link", { name: /Home/i }).first()).toBeVisible();
  });

  test("admin Aanvragen shell loads without mailbox config error", async ({
    page,
    failureSink,
  }) => {
    void failureSink;
    await page.goto(`${ADMIN_ORIGIN}/inquiries`);
    await expect(page.getByRole("heading", { name: /Aanvragen/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Mailbox niet geconfigureerd/i)).toHaveCount(0);
  });

  test("storefront home, contact, privacy, terms load", async ({ page, failureSink }) => {
    void failureSink;
    for (const path of ["/", "/contact", "/privacy", "/terms"]) {
      await page.goto(`${STOREFRONT_ORIGIN}${path}`);
      await expect(page.locator("body")).toBeVisible();
      await expect(page.locator("body")).not.toContainText(/Application error|Internal Server Error/i);
    }
  });

  test("seeded custom page is publicly reachable", async ({ page, failureSink }) => {
    void failureSink;
    await page.goto(`${STOREFRONT_ORIGIN}/e2e-custom`);
    await expect(page.locator("body")).toBeVisible();
    await expect(page).not.toHaveURL(/404|not-found/i);
  });
});
