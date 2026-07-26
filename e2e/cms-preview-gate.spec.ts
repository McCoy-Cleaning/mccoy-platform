import { test, expect } from "@playwright/test";
import {
  PAGES,
  expectPreviewNotText,
  expectPreviewStatus,
  expectPreviewText,
  openPageEditor,
  refreshPreview,
  setBlockTitle,
  addCmsSection,
  expectEditCanvasText,
} from "./helpers/cms";

test.describe("Preview gate", () => {
  test("locked until refresh; outdated after draft edit; frozen until refresh", async ({ page }) => {
    const stamp = Date.now();
    const titleA = `Gate ${stamp}`;
    const titleB = `Gate outdated ${stamp}`;

    await openPageEditor(page, PAGES.home);
    await expectPreviewStatus(page, "locked");

    await addCmsSection(page, "Roadmap");
    await setBlockTitle(page, titleA);
    await expectEditCanvasText(page, titleA);
    await expectPreviewStatus(page, "locked");

    await refreshPreview(page);
    await expectPreviewStatus(page, "up_to_date");
    await expectPreviewText(page, titleA);

    await setBlockTitle(page, titleB);
    await expectEditCanvasText(page, titleB);
    await expectPreviewStatus(page, "outdated");
    await expect(page.getByText("Preview verouderd")).toBeVisible();
    // Frozen snapshot: preview still shows titleA until the pane is re-opened
    // (Toon preview captures a fresh snapshot).
    await expectPreviewText(page, titleA);
    await expectPreviewNotText(page, titleB);

    await refreshPreview(page);
    await expectPreviewStatus(page, "up_to_date");
    await expectPreviewText(page, titleB);
  });
});
