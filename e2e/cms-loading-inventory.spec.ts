import { test, expect } from "./fixtures/base";
import { ADMIN_ORIGIN } from "./fixtures/base";
import {
  ALL_FIXED_SECTION_KEYS,
  INVENTORY_PUBLISHABLE_BLOCK_TYPES,
  PUBLISHABLE_BLOCK_TYPES,
} from "@mccoy/cms-schema";
import { PAGES } from "./helpers/cms";
import {
  BUILTIN_CMS_INVENTORY_PAGES,
  expectFixedSectionInventory,
  expectPublishableBlockPickerInventory,
} from "./helpers/cms-inventory";

/**
 * M5 / Phase 5 — exhaustive fixed-section + publishable-block inventory.
 * Sources: `@mccoy/cms-schema` e2e-inventory (not a hand list in this file).
 * Phase 6–7 deep field editing stays in cms-field-coverage / lifecycle specs.
 */
test.describe("CMS M5 fixed/block inventory", () => {
  test("schema inventory catalogs are non-empty and publishable-synced", () => {
    expect(ALL_FIXED_SECTION_KEYS.length).toBeGreaterThan(0);
    expect(INVENTORY_PUBLISHABLE_BLOCK_TYPES).toEqual([...PUBLISHABLE_BLOCK_TYPES].sort());
    expect(BUILTIN_CMS_INVENTORY_PAGES.length).toBeGreaterThanOrEqual(7);
  });

  test("website hub lists every builtin inventory page and E2E custom", async ({
    page,
    failureSink,
  }) => {
    void failureSink;
    await page.goto(`${ADMIN_ORIGIN}/website`);
    await expect(page).not.toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: /Website/i })).toBeVisible({
      timeout: 30_000,
    });
    for (const p of BUILTIN_CMS_INVENTORY_PAGES) {
      await expect(
        page.getByRole("link", { name: `${p.title} aanpassen` }),
        `Hub missing link for ${p.pageId}`,
      ).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /E2E Custom aanpassen/i })).toBeVisible();
  });

  for (const p of BUILTIN_CMS_INVENTORY_PAGES) {
    test(`fixed inventory covers every expected key on ${p.pageId}`, async ({
      page,
      failureSink,
    }) => {
      void failureSink;
      await expectFixedSectionInventory(page, p.pageId);
    });
  }

  test("custom page editor opens (blocks-only, no fixed keys)", async ({ page, failureSink }) => {
    void failureSink;
    await page.goto(`${ADMIN_ORIGIN}/website/${PAGES.custom}`);
    await expect(page).not.toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("button", { name: /^Pagina$/i }).or(page.locator("[data-cms-toolbar='custom-page']"))).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-cms-toolbar='custom-page']")).toBeVisible();
  });

  test("every publishable block type appears in add-section picker inventory", async ({
    page,
    failureSink,
  }) => {
    void failureSink;
    await expectPublishableBlockPickerInventory(page);
  });
});
