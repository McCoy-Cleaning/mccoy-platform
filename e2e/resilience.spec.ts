import { test, expect, STOREFRONT_ORIGIN } from "./fixtures/base";

test.describe("Resilience (browser-observable)", () => {
  test("contact double-submit does not crash the page", async ({ page, failureSink }) => {
    void failureSink;
    await page.goto(`${STOREFRONT_ORIGIN}/contact`);
    await expect(page.getByTestId("site-form-ready")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("textbox", { name: /^Naam/i })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("textbox", { name: /^Naam/i }).fill("E2E Double");
    await page.getByRole("textbox", { name: /^E-?mail/i }).fill("e2e.double@example.test");
    await page.getByRole("textbox", { name: /bericht|message/i }).fill("double submit probe");

    const submit = page.getByRole("button", { name: /verstuur/i });
    await expect(submit).toBeEnabled();
    await submit.click();
    await submit.click({ force: true }).catch(() => undefined);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toContainText(/Internal Server Error/i);
    expect(page.url()).not.toMatch(/[?&]name=/);
  });

  test("unauthenticated cms-preview does not expose edit shell", async ({ page, failureSink }) => {
    void failureSink;
    await page.goto(`${STOREFRONT_ORIGIN}/cms-preview`);
    await expect(page.locator("[data-cms-edit-guard='edit']")).toHaveCount(0);
  });
});
