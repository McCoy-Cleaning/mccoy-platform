import { test, expect } from "@playwright/test";
import {
  PAGES,
  STOREFRONT_ORIGIN,
  editFrame,
  openPageEditor,
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
      expect(navigations.every((u) => u.includes("_cmsMode=edit") || u.includes("localhost:5174"))).toBe(
        true,
      );
    }

    // Home hero is a reusable block after MG5 (data-cms-select-block), not fixed home.hero.
    const heroBlock = frame.locator("[data-cms-select-block]").first();
    await expect(heroBlock).toBeVisible();
    await heroBlock.click();
    await expect(page.getByRole("dialog", { name: "Paginaindeling" })).toBeVisible();
    await expect(heroBlock).toHaveAttribute("aria-pressed", "true");
  });

  test("Public storefront remains free of edit guards", async ({ page }) => {
    await page.goto(STOREFRONT_ORIGIN);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("[data-cms-edit-guard='edit']")).toHaveCount(0);
  });
});
