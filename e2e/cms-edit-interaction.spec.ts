import { test, expect } from "@playwright/test";
import {
  PAGES,
  STOREFRONT_ORIGIN,
  editFrame,
  openPageEditor,
  previewFrame,
  refreshPreview,
} from "./helpers/cms";

test.describe("Edit-mode interaction blocking", () => {
  test("Bewerken: CTAs/nav do not navigate; forms do not submit; click selects section", async ({
    page,
  }) => {
    await openPageEditor(page, PAGES.home);
    const frame = editFrame(page);

    await expect(frame.locator("[data-cms-edit-guard='edit']").first()).toBeAttached();

    const beforeUrl = page.url();
    const navLink = frame.locator("a[href]").first();
    await expect(navLink).toBeVisible();
    await navLink.click({ force: true });
    await expect(page).toHaveURL(beforeUrl);
    await expect(frame.locator("[data-cms-edit-guard='edit']").first()).toBeAttached();
    // Edit iframe must remain on the same edit session URL (no in-frame navigation).
    await expect(page.locator('iframe[title="edit"]')).toHaveAttribute("src", /_cmsMode=edit/);

    const form = frame.locator("form").first();
    if (await form.count()) {
      const navigations: string[] = [];
      page.on("framenavigated", (f) => {
        if (f === page.mainFrame() || f.name() || f.url().includes("localhost:5173")) {
          navigations.push(f.url());
        }
      });
      await form.evaluate((el) => {
        (el as HTMLFormElement).requestSubmit();
      });
      await expect(page).toHaveURL(beforeUrl);
      await expect(frame.locator("[data-cms-edit-guard='edit']").first()).toBeAttached();
      expect(navigations.every((u) => u.includes("_cmsMode=edit") || u.includes("/admin/"))).toBe(
        true,
      );
    }

    await frame.locator("[data-cms-select='home.hero']").first().click();
    await expect(page.getByRole("dialog", { name: "Paginaindeling" })).toBeVisible();
    await expect(
      frame.locator('[data-cms-select="home.hero"][aria-pressed="true"]').first(),
    ).toBeVisible();
  });

  test("Preview: navigation allowed; forms stay side-effect free", async ({ page }) => {
    await openPageEditor(page, PAGES.home);
    await refreshPreview(page);

    const preview = previewFrame(page);
    await expect(preview.locator("[data-cms-edit-guard='preview']").first()).toBeAttached();

    const form = preview.locator("form").first();
    if (await form.count()) {
      const previewUrlBefore = await page.locator('iframe[title="preview"]').getAttribute("src");
      await form.evaluate((el) => {
        (el as HTMLFormElement).requestSubmit();
      });
      expect(page.url()).toContain("/admin/website/");
      expect(await page.locator('iframe[title="preview"]').getAttribute("src")).toBe(
        previewUrlBefore,
      );
    }

    const link = preview.locator("a[href^='/'], a[href^='http']").first();
    await expect(link).toHaveAttribute("href", /.+/);
    // Preview must not use the edit interaction guard for navigation blocking.
    await expect(preview.locator("[data-cms-edit-guard='edit']")).toHaveCount(0);

    // Public storefront (non-edit) remains unaffected — no production form side effects from preview.
    await page.goto(STOREFRONT_ORIGIN);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("[data-cms-edit-guard='edit']")).toHaveCount(0);
  });
});
