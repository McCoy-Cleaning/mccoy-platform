import { test, expect } from "@playwright/test";
import {
  PAGES,
  addCmsSection,
  editFrame,
  enableMobileDeviceCanvas,
  openPageEditor,
  openSections,
  prepareCanvasScreenshot,
  setBlockTitle,
} from "./helpers/cms";
import {
  resetHomeToBuiltinSeed,
  syncHomeLocalStorageFromStore,
} from "./helpers/reset-cms-home";

async function awaitCmsToastGone(page: import("@playwright/test").Page) {
  // Scope to the visible Sonner toast — an aria-live echo can keep the plain
  // text node "visible" to Playwright after the toast UI has dismissed.
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Sectie toegevoegd" });
  if (await toast.count().then((n) => n > 0).catch(() => false)) {
    await expect(toast.first()).toBeHidden({ timeout: 15_000 });
  }
}

/**
 * Canvas pixel shots use the admin DeviceFrame toggle for mobile, while the
 * Playwright viewport stays at 1440×900. That matches the product's mobile
 * preview (fixed 390px phone frame) without collapsing admin chrome via
 * setViewportSize — the previous double-resize raced iframe reflow and caused
 * intermittent ~3% plans-mobile diffs.
 *
 * Subject is the first child inside [data-cms-select-block] so selection ring /
 * "Sectie" badge chrome is excluded (those are covered by selected-canvas-section).
 */
test.describe("CMS pixel screenshots (targeted)", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Full-suite runs may have published extra CMS blocks onto home; baselines
    // assume the four fixed seed sections only.
    await resetHomeToBuiltinSeed();
    await page.goto("/admin/website");
    await syncHomeLocalStorageFromStore(page);
  });

  test("Roadmap desktop and mobile", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPageEditor(page, PAGES.home);
    await addCmsSection(page, "Roadmap");
    await setBlockTitle(page, "Screenshot Roadmap");

    const block = editFrame(page).locator("[data-cms-select-block]").last();
    const subject = block.locator(":scope > *").first();
    await prepareCanvasScreenshot(page, subject);
    await expect(subject).toHaveScreenshot("roadmap-desktop.png");

    await enableMobileDeviceCanvas(page, subject);
    await prepareCanvasScreenshot(page, subject);
    await expect(subject).toHaveScreenshot("roadmap-mobile.png");
  });

  test("Plans desktop and mobile", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPageEditor(page, PAGES.home);
    await addCmsSection(page, "Pakketten");
    await setBlockTitle(page, "Screenshot Plans");

    const block = editFrame(page).locator("[data-cms-select-block]").last();
    const subject = block.locator(":scope > *").first();
    await prepareCanvasScreenshot(page, subject);
    await expect(subject).toHaveScreenshot("plans-desktop.png");

    await enableMobileDeviceCanvas(page, subject);
    await prepareCanvasScreenshot(page, subject);
    await expect(subject).toHaveScreenshot("plans-mobile.png");
  });

  test("Hero editor, Text+Image editor, Gallery, selected section, validation error", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openPageEditor(page, PAGES.home);
    await openSections(page);
    const dialog = page.getByRole("dialog", { name: "Paginaindeling" });
    await dialog.getByRole("button", { name: /Hero/i }).first().click();
    await awaitCmsToastGone(page);
    await expect(dialog).toHaveScreenshot("hero-editor.png");

    await addCmsSection(page, "Tekst met afbeelding");
    await awaitCmsToastGone(page);
    await expect(dialog).toHaveScreenshot("text-image-editor.png");

    await addCmsSection(page, "Werkgalerij");
    await awaitCmsToastGone(page);
    await expect(dialog).toHaveScreenshot("gallery-editor.png");

    // Close sections overlay so the edit canvas is clickable.
    await page.getByRole("button", { name: "Secties sluiten" }).click();
    await expect(dialog).toBeHidden();

    const selected = editFrame(page).locator("[data-cms-select-block]").first();
    await selected.click();
    await expect(selected).toHaveAttribute("aria-pressed", "true");
    // Selection re-opens Secties; close again so the canvas shot is not racing the drawer.
    await prepareCanvasScreenshot(page, selected);
    await expect(selected).toHaveScreenshot("selected-canvas-section.png");

    await openSections(page);
    await addCmsSection(page, "Nieuwsbrief signup");
    page.once("dialog", async (d) => {
      await d.accept();
    });
    await page.getByRole("button", { name: /Opslaan/ }).click();
    await expect(page.locator("[data-cms-toolbar='save']").locator("..")).toHaveScreenshot(
      "publication-validation-error.png",
    );
  });
});
