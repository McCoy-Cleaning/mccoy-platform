import { test, expect } from "@playwright/test";
import {
  PAGES,
  discardDraft,
  editFrame,
  expectEditCanvasText,
  expectStorefrontText,
  openPageEditor,
  savePage,
  STOREFRONT_ORIGIN,
} from "./helpers/cms";

test.describe("Custom page editing", () => {
  test("seeded custom page edits, publishes, and discards", async ({ page }) => {
    const stamp = Date.now();
    const titleA = `Custom Hero ${stamp}`;
    const titleB = `Custom Hero B ${stamp}`;

    await openPageEditor(page, PAGES.custom);

    const openDrawer = async () => {
      const btn = page.locator('[data-cms-toolbar="custom-page"]');
      if ((await btn.getAttribute("aria-expanded")) !== "true") {
        await btn.click();
      }
      await expect(page.getByRole("dialog", { name: "Pagina beheren" })).toBeVisible();
      await page.getByRole("button", { name: /Secties/i }).click();
    };

    await openDrawer();
    const dialog = page.getByRole("dialog", { name: "Pagina beheren" });
    const titleField = dialog.getByLabel(/^Titel$/i).first();
    await expect(titleField).toBeVisible({ timeout: 15_000 });
    await titleField.fill(titleA);
    await expectEditCanvasText(page, titleA);

    await openDrawer();
    await titleField.fill(titleB);
    await expectEditCanvasText(page, titleB);

    await savePage(page);
    await expectStorefrontText(page, "/e2e-custom", titleB);

    await page.goto(`${STOREFRONT_ORIGIN}/e2e-custom`);
    await page.reload();
    await expect(page.getByText(titleB).first()).toBeVisible();

    await openPageEditor(page, PAGES.custom);
    await openDrawer();
    await dialog.getByLabel(/^Titel$/i).first().fill("CUSTOM_DISCARD");
    await discardDraft(page);
    await expect(editFrame(page).getByText("CUSTOM_DISCARD")).toHaveCount(0);
    await expectEditCanvasText(page, titleB);
  });
});
