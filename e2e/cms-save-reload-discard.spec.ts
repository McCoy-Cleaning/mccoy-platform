import { test, expect } from "@playwright/test";
import {
  PAGES,
  STOREFRONT_ORIGIN,
  addCmsSection,
  discardDraft,
  editFrame,
  expectEditCanvasText,
  expectStorefrontText,
  openPageEditor,
  openSections,
  savePage,
  setBlockTitle,
} from "./helpers/cms";

test.describe("Save, reload and discard", () => {
  test("Opslaan publishes; reload preserves; Verwerpen restores published", async ({ page }) => {
    const stamp = Date.now();
    const published = `Saved ${stamp}`;

    await openPageEditor(page, PAGES.home);
    await addCmsSection(page, "Roadmap");
    await setBlockTitle(page, published);
    await savePage(page);
    await expectStorefrontText(page, "/", published);

    await page.goto(`${STOREFRONT_ORIGIN}/`);
    await page.reload();
    await expect(page.getByText(published).first()).toBeVisible();

    await openPageEditor(page, PAGES.home);
    await openSections(page);
    await page.getByRole("dialog", { name: "Paginaindeling" }).getByText("Roadmap").first().click();
    await setBlockTitle(page, "UNSAVED_DRAFT");
    await expectEditCanvasText(page, "UNSAVED_DRAFT");
    await discardDraft(page);
    await expect(editFrame(page).getByText("UNSAVED_DRAFT")).toHaveCount(0);
    await expectEditCanvasText(page, published);
  });
});
