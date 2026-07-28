import { test, expect } from "./fixtures/base";
import { openPageEditor, openSections, PAGES } from "./helpers/cms";

const BUILTIN_PAGES = [
  { id: "page_home", label: /Home/i },
  { id: "page_about", label: /Over ons/i },
  { id: "page_services", label: /Diensten/i },
  { id: "page_products", label: /Producten/i },
  { id: "page_contact", label: /Contact/i },
  { id: "page_vacatures", label: /Vacatures/i },
  { id: "page_offerte", label: /Offerte/i },
  { id: "page_privacy", label: /Privacyverklaring/i },
  { id: "page_terms", label: /Algemene voorwaarden/i },
] as const;

test.describe("CMS loading + section inventory", () => {
  test("website hub lists builtin pages and E2E custom", async ({ page, failureSink }) => {
    void failureSink;
    await page.goto("/admin/website");
    await expect(page.getByRole("heading", { name: /Website/i })).toBeVisible();
    for (const p of BUILTIN_PAGES) {
      await expect(page.getByRole("link", { name: p.label }).first()).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /E2E Custom/i }).first()).toBeVisible();
  });

  for (const p of BUILTIN_PAGES) {
    test(`editor loads for ${p.id}`, async ({ page, failureSink }) => {
      void failureSink;
      await openPageEditor(page, p.id);
      await expect(page.locator('iframe[title="edit"]')).toBeVisible();
      await openSections(page);
      await expect(page.getByRole("dialog", { name: "Paginaindeling" })).toBeVisible();
      await expect(page.locator("[data-cms-layout-row]").first()).toBeVisible();
    });
  }

  test("custom page editor opens", async ({ page, failureSink }) => {
    void failureSink;
    await openPageEditor(page, PAGES.custom);
    await expect(page.locator('iframe[title="edit"]')).toBeVisible();
    // Custom pages use CustomPageSplitEditor (not BuiltinLayoutEditor "Secties" FAB).
    await expect(page.getByRole("button", { name: /^Pagina$/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("[data-cms-toolbar='custom-page']")).toBeVisible();
  });
});
