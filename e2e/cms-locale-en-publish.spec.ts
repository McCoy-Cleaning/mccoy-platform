import { test, expect, STOREFRONT_ORIGIN } from "./fixtures/base";
import {
  PAGES,
  expectEditCanvasText,
  expectStorefrontText,
  fillManualEnDraft,
  openPageEditor,
  savePage,
} from "./helpers/cms";

/**
 * Phase 11 — NL and EN must stay separate after publish.
 * Opslaan with EN drafts publishes EN (first go-live or republish); NL/EN stay distinct.
 */
test.describe("CMS NL/EN publish", () => {
  test("custom page: distinct NL + EN hero titles publish to / and /en/", async ({
    page,
    failureSink,
  }) => {
    void failureSink;
    const stamp = Date.now();
    const nlTitle = `Nederlandse testkop ${stamp}`;
    const enTitle = `English test heading ${stamp}`;

    await openPageEditor(page, PAGES.custom);

    const btn = page.locator('[data-cms-toolbar="custom-page"]');
    if ((await btn.getAttribute("aria-expanded")) !== "true") {
      await btn.click();
    }
    const dialog = page.getByRole("dialog", { name: "Pagina beheren" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /Secties/i }).click();

    // Hero "Titel" may be a textbox without a perfect accessible name in all builds.
    const titleField = dialog
      .getByLabel(/^Titel$/i)
      .or(dialog.getByRole("textbox", { name: /^Titel$/i }))
      .or(dialog.locator('input[type="text"]').first())
      .first();
    await expect(titleField).toBeVisible({ timeout: 15_000 });
    await titleField.fill(nlTitle);

    // Bind EN to the hero Titel control — not the first "Engelse vertaling" on the form
    // (eyebrow comes first and would steal a broad /Engelse vertaling/ match).
    const enTitleField = dialog.getByLabel(/^Titel: Engelse vertaling/i);
    if (await enTitleField.isVisible().catch(() => false)) {
      await enTitleField.fill(enTitle);
    } else {
      await fillManualEnDraft(page, "Titel", enTitle);
    }
    await expectEditCanvasText(page, nlTitle);

    await savePage(page);
    await expectStorefrontText(page, "/e2e-custom", nlTitle);

    await page.goto(`${STOREFRONT_ORIGIN}/en/e2e-custom`);
    await expect(page).toHaveURL(/\/en\/e2e-custom\/?$/);
    // Hero may append headingAccent (e.g. "visible.") — match title, not exact full text.
    const enHero = page.getByRole("heading", { level: 1, name: enTitle });
    await expect(enHero).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: nlTitle })).toHaveCount(0);

    await page.goto(`${STOREFRONT_ORIGIN}/e2e-custom`);
    const nlHero = page.getByRole("heading", { level: 1, name: nlTitle });
    await expect(nlHero).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { level: 1, name: enTitle })).toHaveCount(0);
  });
});
