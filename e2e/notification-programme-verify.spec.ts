import { test, expect } from "./fixtures/base";
import { addCmsSection, openPageEditor, PAGES, setBlockTitle } from "./helpers/cms";

/**
 * Stage E verification for the platform interaction/notification programme.
 *
 * Destructive CMS actions must route through the custom ConfirmationDialog
 * (Radix AlertDialog driven by `appConfirm` / `AppDialogProvider`), never a
 * native `window.confirm` / `alert`. A native dialog fires synchronously and
 * blocks the event loop, so we assert none appears for the whole flow rather
 * than only around a single action.
 */
test.describe("Platform interaction — destructive confirm without native dialog", () => {
  test("discarding a CMS draft shows the custom confirmation dialog, not window.confirm", async ({
    page,
    failureSink,
  }) => {
    void failureSink;

    let nativeDialog: string | null = null;
    page.on("dialog", (dialog) => {
      nativeDialog = `${dialog.type()}: ${dialog.message()}`;
      // Dismiss so a regression here fails the assertion below instead of hanging the test.
      void dialog.dismiss();
    });

    await openPageEditor(page, PAGES.custom);
    await addCmsSection(page, "Rich text");
    await setBlockTitle(page, `E2E discard guard ${Date.now()}`);

    const discardButton = page.locator('[data-cms-toolbar="discard"]');
    await expect(discardButton).toBeEnabled({ timeout: 15_000 });
    await discardButton.click();

    // Radix AlertDialog renders role="alertdialog", not the native dialog element.
    const confirmDialog = page.getByRole("alertdialog", { name: /verwerpen|verwijderen/i });
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 });
    await expect(
      confirmDialog.getByText(/niet-opgeslagen wijzigingen|nog niet gepubliceerd/i),
    ).toBeVisible();

    await confirmDialog.getByRole("button", { name: /^(Verwerpen|Verwijderen)$/ }).click();
    await expect(confirmDialog).toBeHidden({ timeout: 15_000 });
    await expect(discardButton).toBeDisabled({ timeout: 15_000 });

    expect(nativeDialog).toBeNull();
  });
});
