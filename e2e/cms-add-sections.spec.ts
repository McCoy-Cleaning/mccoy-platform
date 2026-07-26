import { test, expect } from "./fixtures/base";
import {
  addCmsSection,
  expectEditCanvasText,
  openPageEditor,
  PAGES,
} from "./helpers/cms";

/**
 * Representative add-section smoke (picker + primary field + canvas).
 * Publish lifecycle is covered by fixed-section / plans / gallery specs.
 */
const ADD_CASES: Array<{ template: string; title: string }> = [
  { template: "Tekst + afbeelding", title: "E2E TextImage Title" },
  { template: "Nieuwsbrief", title: "E2E Newsletter Title" },
  { template: "Contactformulier", title: "E2E ContactForm Title" },
  { template: "Popup CTA", title: "E2E Popup Title" },
];

test.describe("CMS add sections (representative)", () => {
  for (const c of ADD_CASES) {
    test(`add ${c.template} on custom page`, async ({ page, failureSink }) => {
      void failureSink;
      await openPageEditor(page, PAGES.custom);
      await addCmsSection(page, c.template);
      const dialog = page.getByRole("dialog", { name: "Pagina beheren" });
      const titleField = dialog.getByLabel("Titel", { exact: true }).first();
      if (await titleField.isVisible().catch(() => false)) {
        await titleField.fill(c.title);
        await expectEditCanvasText(page, c.title);
      } else {
        await expect(dialog.getByText(new RegExp(c.template.split(" ")[0]!, "i")).first()).toBeVisible();
      }
    });
  }
});
