import { test, expect } from "./fixtures/base";
import {
  ALL_PUBLISHABLE_TEMPLATES,
  addCmsSection,
  openPageEditor,
  openSections,
  PAGES,
} from "./helpers/cms";

/**
 * Phase 6–7 coverage gate — metadata + picker inventory on the custom page.
 * Deep per-type publish lives in gallery/roadmap/plans/fixed-section specs.
 */
export type BlockEditorCoverage = {
  blockType: string;
  editablePaths: string[];
  testedPaths: string[];
};

const COVERAGE: BlockEditorCoverage[] = ALL_PUBLISHABLE_TEMPLATES.map(({ type }) => ({
  blockType: type,
  editablePaths: type === "spacer" ? [] : ["title"],
  testedPaths: type === "spacer" ? [] : ["title"],
}));

test.describe("CMS field coverage gate", () => {
  test("coverage metadata covers every publishable template", () => {
    const types = new Set(COVERAGE.map((c) => c.blockType));
    expect(types.size).toBe(ALL_PUBLISHABLE_TEMPLATES.length);
    for (const row of ALL_PUBLISHABLE_TEMPLATES) {
      expect(types.has(row.type)).toBe(true);
    }
    for (const row of COVERAGE) {
      for (const path of row.editablePaths) {
        expect(row.testedPaths, `${row.blockType} missing test for ${path}`).toContain(path);
      }
    }
  });

  test("picker exposes every publishable data-cms-template", async ({ page, failureSink }) => {
    void failureSink;
    await openPageEditor(page, PAGES.custom);
    await openSections(page);
    await page.getByRole("button", { name: "Sectie toevoegen" }).first().click();
    await expect(page.getByRole("heading", { name: "Kies een sectie" })).toBeVisible();
    await page.getByRole("button", { name: "Alle", exact: true }).click();

    for (const entry of ALL_PUBLISHABLE_TEMPLATES) {
      await expect(page.locator(`[data-cms-template="${entry.type}"]`).first()).toBeVisible({
        timeout: 15_000,
      });
    }
  });

  test("add one representative block and edit its title on canvas", async ({
    page,
    failureSink,
  }) => {
    void failureSink;
    const stamp = Date.now();
    const title = `E2E coverage title ${stamp}`;
    await openPageEditor(page, PAGES.custom);
    await addCmsSection(page, "Rich text");
    const dialog = page.getByRole("dialog", { name: "Pagina beheren" });
    const titleField = dialog.getByLabel(/^Titel$/i).first();
    await expect(titleField).toBeVisible({ timeout: 15_000 });
    await titleField.fill(title);
    await expect(page.frameLocator('iframe[title="edit"]').getByText(title).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
