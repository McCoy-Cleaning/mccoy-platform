import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

describe("ServicesCardsInspector CTA wiring", () => {
  it("uses CardListEditor with contact CmsButton and fixed Lees meer note", () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const inspector = readFileSync(join(dir, "ServicesCardsInspector.tsx"), "utf8");
    expect(inspector).toContain('enPathPrefix="section:services.cards:cards"');

    const editor = readFileSync(join(dir, "../CardListEditor.tsx"), "utf8");
    expect(editor).toContain("CmsButtonEditor");
    expect(editor).toContain("DEFAULT_SERVICE_CARD_CTA_LABEL");
    expect(editor).toContain("Contactknop (naast Lees meer)");
    expect(editor).toContain("Lees meer");
    expect(editor).toContain("Geen link");
    expect(editor).toContain("${enPathPrefix}.${cardId}.${field}");
    expect(editor).toContain("cta.label");
    expect(editor).not.toContain("TypedLinkField");
    // Stable ids — not array indexes for EN draft paths
    expect(editor).not.toMatch(/\$\{enPathPrefix\}\.\$\{index\}\./);
  });
});
