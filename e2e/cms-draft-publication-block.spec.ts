import { test, expect } from "@playwright/test";
import { PAGES, openPageEditor, openSections, setBlockTitle } from "./helpers/cms";

test.describe("Draft-only publication blocking", () => {
  test("clearing hero title leaves Opslaan disabled or rejects publish", async ({ page }) => {
    await openPageEditor(page, PAGES.custom);
    await openSections(page);

    await setBlockTitle(page, "temp-title");
    await expect(page.locator('[data-cms-toolbar="save"]')).toBeEnabled({ timeout: 15_000 });
    await setBlockTitle(page, "");
    // Controlled field + draft commit: wait until the empty value is reflected.
    await expect(
      page.getByRole("dialog", { name: "Pagina beheren" }).getByLabel("Titel", { exact: true }),
    ).toHaveValue("");

    const save = page.locator('[data-cms-toolbar="save"]');
    // Local incomplete editing is allowed; publishing invalid visible content must be blocked
    // with an error that identifies the section and title field. The block is
    // surfaced via an in-app toast (not a native window.alert).
    if (await save.isEnabled().catch(() => false)) {
      await save.click();
      const errorToast = page
        .locator("[data-sonner-toast]")
        .filter({ hasText: /Opslaan mislukt|Sectie\s+"Hero"/i });
      await expect(errorToast.first()).toBeVisible({ timeout: 15_000 });
      const toastText = (await errorToast.first().textContent()) ?? "";
      expect(toastText).toMatch(/Opslaan mislukt/i);
      expect(toastText).toMatch(/Sectie\s+"Hero"/i);
      expect(toastText).toMatch(/titel/i);
      expect(toastText).not.toMatch(/^Opgeslagen/i);
    } else {
      await expect(save).toBeDisabled();
    }
    await expect(page.locator('iframe[title="edit"]')).toBeVisible();
  });

  test("seeded custom page opens in editor (create remains forbidden)", async ({ page }) => {
    await page.goto("/admin/website");
    await expect(page.getByRole("heading", { name: /Website/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Nieuwe pagina|Pagina toevoegen/i })).toHaveCount(
      0,
    );
    await openPageEditor(page, PAGES.custom);
    await expect(page.locator('iframe[title="edit"]')).toBeVisible({ timeout: 60_000 });
  });
});
