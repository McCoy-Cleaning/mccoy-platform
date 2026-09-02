import { test, expect } from "@playwright/test";
import {
  PAGES,
  editFrame,
  expectEditCanvasText,
  openPageEditor,
} from "./helpers/cms";

/**
 * E11 — focused undo/redo coverage on the real WYSIWYG editor.
 * Combinatorial history semantics live in unit/integration tests.
 */
test.describe("CMS WYSIWYG draft history (E11)", () => {
  test("inline text edit → toolbar undo → redo; dirty clears on undo to baseline", async ({
    page,
  }) => {
    await openPageEditor(page, PAGES.home);
    const frame = editFrame(page);

    const undoBtn = page.locator('[data-cms-toolbar="undo"]').first();
    const redoBtn = page.locator('[data-cms-toolbar="redo"]').first();
    await expect(undoBtn).toBeDisabled();
    await expect(redoBtn).toBeDisabled();

    const editable = frame.locator("[data-cms-inline-edit]").first();
    await expect(editable).toBeVisible({ timeout: 30_000 });
    const original = (await editable.innerText()).trim();
    const stamp = `E11 ${Date.now()}`;

    await editable.click();
    await editable.evaluate((el, text) => {
      el.focus();
      el.innerText = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      (el as HTMLElement).blur();
    }, stamp);

    await expectEditCanvasText(page, stamp);
    await expect(undoBtn).toBeEnabled({ timeout: 15_000 });

    await undoBtn.click();
    await expect(frame.getByText(stamp)).toHaveCount(0);
    if (original) {
      await expectEditCanvasText(page, original);
    }
    await expect(redoBtn).toBeEnabled();

    await redoBtn.click();
    await expectEditCanvasText(page, stamp);
  });

  test("Ctrl/Cmd+Z undoes after committed canvas edit (not while typing)", async ({ page }) => {
    await openPageEditor(page, PAGES.contact);
    const frame = editFrame(page);

    const editable = frame.locator("[data-cms-inline-edit]").first();
    await expect(editable).toBeVisible({ timeout: 30_000 });
    const stamp = `E11KB ${Date.now()}`;

    await editable.click();
    await editable.evaluate((el, text) => {
      el.focus();
      el.innerText = text;
      (el as HTMLElement).blur();
    }, stamp);
    await expectEditCanvasText(page, stamp);

    await page.locator('[data-cms-toolbar="undo"]').first().focus();
    const isMac = process.platform === "darwin";
    await page.keyboard.press(isMac ? "Meta+z" : "Control+z");
    await expect(frame.getByText(stamp)).toHaveCount(0);
  });

  test("section add undo/redo via canvas insert picker", async ({ page }) => {
    await openPageEditor(page, PAGES.home);
    const frame = editFrame(page);

    const beforeIds = await frame.locator("[data-cms-select-block]").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-cms-select-block")),
    );

    const gap = frame.locator('[aria-label^="Sectie toevoegen op positie"]').first();
    await expect(gap).toBeAttached({ timeout: 30_000 });
    await gap.evaluate((el) => (el as HTMLButtonElement).click());

    await expect(page.getByRole("heading", { name: "Kies een sectie" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Alle", exact: true }).click();
    await page.getByPlaceholder(/Zoek/).fill("Call-to-action banner");
    await page.locator('[data-cms-template="cta"]').first().click();
    await expect(page.getByRole("heading", { name: "Kies een sectie" })).toBeHidden({
      timeout: 15_000,
    });

    await expect
      .poll(async () => frame.locator("[data-cms-select-block]").count())
      .toBeGreaterThan(beforeIds.length);

    const afterAddIds = await frame.locator("[data-cms-select-block]").evaluateAll((els) =>
      els.map((el) => el.getAttribute("data-cms-select-block")),
    );

    await expect(page.locator('[data-cms-toolbar="undo"]').first()).toBeEnabled({
      timeout: 15_000,
    });
    await page.locator('[data-cms-toolbar="undo"]').first().click();
    await expect
      .poll(async () =>
        frame.locator("[data-cms-select-block]").evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-cms-select-block")),
        ),
      )
      .toEqual(beforeIds);

    await page.locator('[data-cms-toolbar="redo"]').first().click();
    await expect
      .poll(async () =>
        frame.locator("[data-cms-select-block]").evaluateAll((els) =>
          els.map((el) => el.getAttribute("data-cms-select-block")),
        ),
      )
      .toEqual(afterAddIds);
  });

  test("NL/EN: EN edit undo does not clear NL canvas text", async ({ page }) => {
    await openPageEditor(page, PAGES.home);
    const frame = editFrame(page);

    const editable = frame.locator("[data-cms-inline-edit]").first();
    await expect(editable).toBeVisible({ timeout: 30_000 });
    const nlText = (await editable.innerText()).trim();

    const localeGroup = page.locator('[data-cms-toolbar="preview-locale"]').first();
    const enToggle = localeGroup.getByRole("button", { name: "en", exact: true });
    await expect(enToggle).toBeVisible();
    await enToggle.click();

    const enEditable = frame.locator("[data-cms-inline-edit]").first();
    await expect(enEditable).toBeVisible({ timeout: 30_000 });
    const enStamp = `E11EN ${Date.now()}`;
    await enEditable.evaluate((el, text) => {
      el.focus();
      el.innerText = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      (el as HTMLElement).blur();
    }, enStamp);
    await expectEditCanvasText(page, enStamp);

    await expect(page.locator('[data-cms-toolbar="undo"]').first()).toBeEnabled({
      timeout: 15_000,
    });
    await page.locator('[data-cms-toolbar="undo"]').first().click();
    await expect(frame.getByText(enStamp)).toHaveCount(0);

    await localeGroup.getByRole("button", { name: "nl", exact: true }).click();
    if (nlText) {
      await expectEditCanvasText(page, nlText);
    }
  });
});
