import { test, expect } from "@playwright/test";
import {
  PAGES,
  addCmsSection,
  discardDraft,
  editFrame,
  expectEditCanvasText,
  openPageEditor,
  savePage,
  selectLayoutSection,
  setBlockTitle,
} from "./helpers/cms";
import path from "node:path";

test.describe("Gallery lifecycle", () => {
  test("add → edit title → publish → discard", async ({ page }) => {
    const stamp = Date.now();
    const titleA = `Gallery A ${stamp}`;
    const titleB = `Gallery B ${stamp}`;

    await openPageEditor(page, PAGES.home);
    await addCmsSection(page, "Werkgalerij");
    await setBlockTitle(page, titleA);

    const fixture = path.join(process.cwd(), "e2e", "fixtures", "gallery-fixture.png");
    const fileInput = page
      .getByRole("dialog", { name: "Paginaindeling" })
      .locator('input[type="file"]')
      .first();
    let hasImage = false;
    if (await fileInput.count()) {
      await fileInput.setInputFiles(fixture);
      // Media library needs Supabase; without it the image may not stick.
      hasImage = await page
        .getByRole("dialog", { name: "Paginaindeling" })
        .locator("img")
        .first()
        .isVisible()
        .catch(() => false);
    }

    await expectEditCanvasText(page, titleA);

    await setBlockTitle(page, titleB);
    await expectEditCanvasText(page, titleB);

    if (!hasImage) {
      test.info().annotations.push({
        type: "note",
        description: "Gallery publish skipped — media upload requires Supabase (cleared in E2E).",
      });
      return;
    }

    await savePage(page);
    await openPageEditor(page, PAGES.home);
    await selectLayoutSection(page, /Galerij|Werkgalerij|Foto galerij/i);
    await setBlockTitle(page, "GALLERY_DISCARD");
    await discardDraft(page);
    await expect(editFrame(page).getByText("GALLERY_DISCARD")).toHaveCount(0);
    await expectEditCanvasText(page, titleB);
  });
});
