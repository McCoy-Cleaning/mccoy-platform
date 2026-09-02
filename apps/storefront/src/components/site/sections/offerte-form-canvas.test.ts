import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Offerte fixed form: presentation from nested CMS `quote`, not i18n `t.contact`.
 */
describe("OfferteFormSection CMS canvas", () => {
  it("drives presentation from quote chrome and keeps E12 submit kinds", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(join(dir, "OfferteSections.tsx"), "utf8");

    expect(src).toContain("normalizeQuoteRequestForm");
    expect(src).toContain('sectionKey: "offerte.form"');
    expect(src).toContain("WysiwygInlineText");
    expect(src).toContain("WysiwygQuoteFormFieldChrome");
    expect(src).toContain("createDefaultQuoteRequestForm");
    expect(src).toContain("resolveContactFormFields");

    // Must not hard-code i18n tab / field presentation for canvas surfaces.
    expect(src).not.toContain("t.contact.sections");
    expect(src).not.toContain("t.contact.submit");
    expect(src).not.toContain("t.contact.success");
    expect(src).not.toContain("t.contact.name");
    expect(src).not.toContain("useI18n");

    // E12: form kinds stay glass_washing / furniture_cleaning via tab.kind.
    expect(src).toContain("kind: tab.kind");
    expect(src).toContain("FIXED_FORM_SOURCE_IDS.offerteForm");
  });
});
