import { test, expect } from "@playwright/test";
import {
  PAGES,
  discardDraft,
  editFrame,
  expectEditCanvasText,
  expectStorefrontText,
  openPageEditor,
  openSections,
  savePage,
} from "./helpers/cms";

test.describe("Fixed built-in section editing", () => {
  test("home hero section edits update canvas, publish and discard", async ({ page }) => {
    const stamp = Date.now();
    const titleA = `Hero A ${stamp}`;
    const titleB = `Hero B ${stamp}`;

    await openPageEditor(page, PAGES.home);
    await openSections(page);

    const dialog = page.getByRole("dialog", { name: "Paginaindeling" });
    await dialog.getByRole("button", { name: /Hero/i }).first().click();

    // Fixed home.hero uses SelectedSectionInspector — Kop is the public heading.
    const title = dialog.getByLabel(/^Kop$/i);
    await expect(title).toBeVisible({ timeout: 15_000 });
    await title.fill(titleA);
    await expectEditCanvasText(page, titleA);

    await title.fill(titleB);
    await expectEditCanvasText(page, titleB);
    await savePage(page);
    await expectStorefrontText(page, "/", titleB);

    await openPageEditor(page, PAGES.home);
    await openSections(page);
    await dialog.getByRole("button", { name: /Hero/i }).first().click();
    await dialog.getByLabel(/^Kop$/i).fill("HERO_DISCARD");
    await discardDraft(page);
    await expect(editFrame(page).getByText("HERO_DISCARD")).toHaveCount(0);
    await expectEditCanvasText(page, titleB);
  });
});
