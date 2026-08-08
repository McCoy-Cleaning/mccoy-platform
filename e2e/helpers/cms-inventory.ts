import { expect, type Page } from "@playwright/test";
import {
  BUILTIN_CMS_INVENTORY_PAGES,
  INVENTORY_PUBLISHABLE_BLOCK_TYPES,
  expectedFixedInventoryForPageId,
  publishableTypesByPickerPage,
  type FixedInventoryExpectation,
} from "@mccoy/cms-schema";
import { openSections, PAGES } from "./cms";

export {
  BUILTIN_CMS_INVENTORY_PAGES,
  INVENTORY_PUBLISHABLE_BLOCK_TYPES,
  expectedFixedInventoryForPageId,
  publishableTypesByPickerPage,
};

export function missingFixedInventoryKeys(
  presentRowIds: ReadonlySet<string>,
  expectations: readonly FixedInventoryExpectation[],
): string[] {
  const missing: string[] = [];
  for (const entry of expectations) {
    const fixedPresent = entry.layoutRowIds.some((id) => presentRowIds.has(id));
    if (entry.kind === "fixed") {
      if (!fixedPresent) missing.push(entry.fixedKey);
      continue;
    }
    if (entry.kind === "fixed-or-migrated-blocks") {
      const migratedPresent = entry.migratedLayoutRowIds.every((id) => presentRowIds.has(id));
      if (!fixedPresent && !migratedPresent) {
        missing.push(
          `${entry.fixedKey} (need rows ${entry.layoutRowIds.join("|")} or ${entry.migratedLayoutRowIds.join("|")})`,
        );
      }
      continue;
    }
    const migratedPresent = presentRowIds.has(entry.migratedLayoutRowId);
    if (!fixedPresent && !migratedPresent) {
      missing.push(
        `${entry.fixedKey} (need row ${entry.layoutRowIds.join("|")} or ${entry.migratedLayoutRowId})`,
      );
    }
  }
  return missing;
}

/**
 * Open builtin editor chrome for inventory — Secties lives in admin UI.
 * Does not require the storefront edit iframe (preview may be unreachable in some envs).
 */
export async function openBuiltinEditorForInventory(page: Page, pageId: string) {
  await page.goto(`/admin/website/${pageId}`);
  await expect(page).not.toHaveURL(/\/admin\/website\/?$/);
  await expect(page).not.toHaveURL(/\/admin\/login/);
  const secties = page
    .getByRole("button", { name: "Secties", exact: true })
    .or(page.getByRole("button", { name: /^Secties$/i }));
  await expect(secties.first()).toBeVisible({ timeout: 60_000 });
}

/** Collect `data-cms-layout-row` values from the open Paginaindeling dialog. */
export async function collectLayoutRowIds(page: Page): Promise<Set<string>> {
  const dialog = page.getByRole("dialog", { name: "Paginaindeling" });
  await expect(dialog).toBeVisible();
  const rows = dialog.locator("[data-cms-layout-row]");
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  const ids = await rows.evaluateAll((els) =>
    els
      .map((el) => el.getAttribute("data-cms-layout-row"))
      .filter((v): v is string => typeof v === "string" && v.length > 0),
  );
  return new Set(ids);
}

/**
 * Assert every expected fixed key for a builtin page appears in Secties inventory.
 * Producten pilot may show fixed rows or deterministic migrated block layout rows.
 */
export async function expectFixedSectionInventory(page: Page, pageId: string) {
  await openBuiltinEditorForInventory(page, pageId);
  await openSections(page);
  const expectations = expectedFixedInventoryForPageId(pageId);
  const present = await collectLayoutRowIds(page);
  const missing = missingFixedInventoryKeys(present, expectations);
  expect(
    missing,
    `Missing fixed inventory on ${pageId}: ${missing.join(", ")} (have=[${[...present].sort().join(", ")}])`,
  ).toEqual([]);

  for (const entry of expectations) {
    if (entry.kind === "fixed-or-products-pilot") {
      const fixed = page.locator(`[data-cms-fixed-key="${entry.fixedKey}"]`);
      const migrated = page.locator(`[data-cms-layout-row="${entry.migratedLayoutRowId}"]`);
      await expect(
        fixed.or(migrated).first(),
        `Neither fixed nor products-pilot row for ${entry.fixedKey}`,
      ).toBeVisible();
      continue;
    }
    if (entry.kind === "fixed-or-migrated-blocks") {
      const fixed = page.locator(`[data-cms-fixed-key="${entry.fixedKey}"]`);
      let migrated = page.locator(`[data-cms-layout-row="${entry.migratedLayoutRowIds[0]}"]`);
      for (const id of entry.migratedLayoutRowIds.slice(1)) {
        migrated = migrated.or(page.locator(`[data-cms-layout-row="${id}"]`));
      }
      await expect(
        fixed.or(migrated).first(),
        `Neither fixed nor migrated rows for ${entry.fixedKey}`,
      ).toBeVisible();
      continue;
    }
    await expect(
      page.locator(`[data-cms-fixed-key="${entry.fixedKey}"]`).first(),
      `Missing data-cms-fixed-key=${entry.fixedKey}`,
    ).toBeVisible();
  }
}

/** Open the add-section picker (Alle) on the current page editor. */
export async function openAddSectionPickerAlle(page: Page) {
  await openSections(page);
  await page.getByRole("button", { name: "Sectie toevoegen" }).first().click();
  await expect(page.getByRole("heading", { name: "Kies een sectie" })).toBeVisible();
  await page.getByRole("button", { name: "Alle", exact: true }).click();
}

/**
 * Custom (or offerte) editor chrome for picker inventory — no storefront iframe required.
 */
export async function openEditorChromeForPickerInventory(page: Page, pageId: string) {
  await page.goto(`/admin/website/${pageId}`);
  await expect(page).not.toHaveURL(/\/admin\/login/);
  if (pageId === PAGES.custom) {
    await expect(page.locator('[data-cms-toolbar="custom-page"]')).toBeVisible({
      timeout: 60_000,
    });
    return;
  }
  const secties = page
    .getByRole("button", { name: "Secties", exact: true })
    .or(page.getByRole("button", { name: /^Secties$/i }));
  await expect(secties.first()).toBeVisible({ timeout: 60_000 });
}

/**
 * Assert every publishable block type appears as `data-cms-template` at least once,
 * or — when page policy already has a maxed instance (e.g. migrated quoteRequestForm) —
 * as an existing layout row of that block type on the probe page.
 */
export async function expectPublishableBlockPickerInventory(page: Page) {
  const byPage = publishableTypesByPickerPage();
  const missing: string[] = [];

  for (const [pageId, types] of byPage) {
    const editorPageId = pageId === "page_e2e_custom" ? PAGES.custom : pageId;
    await openEditorChromeForPickerInventory(page, editorPageId);
    await openAddSectionPickerAlle(page);

    const present = await page.locator("[data-cms-template]").evaluateAll((els) =>
      els
        .map((el) => el.getAttribute("data-cms-template"))
        .filter((v): v is string => typeof v === "string" && v.length > 0),
    );
    const presentSet = new Set(present);

    for (const type of types) {
      if (presentSet.has(type)) {
        await expect(
          page.locator(`[data-cms-template="${type}"]`).first(),
          `data-cms-template=${type} not visible on ${pageId}`,
        ).toBeVisible();
        continue;
      }

      // Close picker to inspect layout rows for already-placed privileged forms.
      await page.keyboard.press("Escape");
      await expect(page.getByRole("heading", { name: "Kies een sectie" })).toBeHidden({
        timeout: 15_000,
      });
      await openSections(page);
      const layoutHit = page.locator(
        `[data-cms-layout-row^="block:"][data-cms-block-type="${type}"], [data-cms-block-type="${type}"]`,
      );
      const inLayout = (await layoutHit.count()) > 0;
      if (!inLayout) {
        missing.push(`${type} (picker on ${pageId})`);
      }
      // Re-open picker for remaining types on this page.
      await openAddSectionPickerAlle(page);
    }

    await page.keyboard.press("Escape");
    await expect(page.getByRole("heading", { name: "Kies een sectie" })).toBeHidden({
      timeout: 15_000,
    });
  }

  expect(
    missing,
    `Missing publishable block types in picker inventory: ${missing.join(", ")}`,
  ).toEqual([]);
}
