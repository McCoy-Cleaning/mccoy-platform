import { test, expect } from "./fixtures/base";
import {
  ALL_PUBLISHABLE_TEMPLATES,
  BLOCK_TYPE_TEMPLATE_NAME,
  addCmsSection,
  openPageEditor,
  PAGES,
} from "./helpers/cms";
import { INVENTORY_PUBLISHABLE_BLOCK_TYPES } from "@mccoy/cms-schema";

/**
 * Phase 6–7 coverage gate — metadata + representative field edit.
 * Exhaustive picker inventory (every publishable type) is M5 / cms-loading-inventory.
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
  test("coverage metadata covers every publishable template from schema", () => {
    expect(ALL_PUBLISHABLE_TEMPLATES.map((t) => t.type).sort()).toEqual(
      [...INVENTORY_PUBLISHABLE_BLOCK_TYPES].sort(),
    );
    for (const type of INVENTORY_PUBLISHABLE_BLOCK_TYPES) {
      expect(BLOCK_TYPE_TEMPLATE_NAME[type], `missing Dutch template name for ${type}`).toBeTruthy();
    }
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
