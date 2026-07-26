import { test, expect, STOREFRONT_ORIGIN } from "./fixtures/base";
import { expectAanvraagListed, submitContactForm, submitOfferteGlassForm } from "./fixtures/forms";

test.describe("Forms → Aanvragen (deterministic inbox)", () => {
  test("contact form submit appears in Admin Aanvragen", async ({ page, failureSink }) => {
    void failureSink;
    const { marker } = await submitContactForm(page);
    await expectAanvraagListed(page, marker, { kindLabel: /Algemeen/i });
  });

  test("offerte glass submit succeeds on storefront", async ({ page, failureSink }) => {
    void failureSink;
    const { marker } = await submitOfferteGlassForm(page);
    await expectAanvraagListed(page, marker, { kindLabel: /Glas/i });
  });

  test("vacatures page exposes application form", async ({ page, failureSink }) => {
    void failureSink;
    await page.goto(`${STOREFRONT_ORIGIN}/vacatures`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 30_000,
    });
    await page.locator("#apply").scrollIntoViewIfNeeded();
    await expect(page.getByRole("textbox", { name: /^Naam/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("textbox", { name: /^E-?mail/i })).toBeVisible();
  });
});
