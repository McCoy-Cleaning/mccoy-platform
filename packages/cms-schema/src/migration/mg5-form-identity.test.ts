import { describe, expect, it } from "vitest";
import {
  CANONICAL_FORM_SOURCE_KEYS,
  LEGACY_FORM_SOURCE_ALIASES,
  resolveCanonicalFormSourceKey,
} from "../form-source";
import { FIXED_FORM_SOURCE_IDS } from "@mccoy/domain";
import { MG5_MIGRATION_MATRIX } from "./mg5-matrix";
import { createMigrationBlockId } from "./block-id";

describe("MG5 form identity preservation", () => {
  it("Contact / Offerte / Vacatures matrix rows keep canonical source keys", () => {
    const contact = MG5_MIGRATION_MATRIX.find((e) => e.legacySectionKey === "contact.form");
    const offerte = MG5_MIGRATION_MATRIX.find((e) => e.legacySectionKey === "offerte.form");
    const vacatures = MG5_MIGRATION_MATRIX.find(
      (e) => e.legacySectionKey === "vacatures.application",
    );

    expect(contact?.formSourceBefore).toBe(FIXED_FORM_SOURCE_IDS.contactForm);
    expect(contact?.formSourceAfter).toBe(CANONICAL_FORM_SOURCE_KEYS.contact);
    expect(offerte?.formSourceBefore).toBe(FIXED_FORM_SOURCE_IDS.offerteForm);
    expect(offerte?.formSourceAfter).toBe(CANONICAL_FORM_SOURCE_KEYS.offerte);
    expect(vacatures?.formSourceBefore).toBe(FIXED_FORM_SOURCE_IDS.vacaturesApplication);
    expect(vacatures?.formSourceAfter).toBe(CANONICAL_FORM_SOURCE_KEYS.vacatures);
  });

  it("legacy aliases still resolve after migration block IDs exist", () => {
    expect(resolveCanonicalFormSourceKey(FIXED_FORM_SOURCE_IDS.contactForm)).toBe(
      "builtin:contact:primary",
    );
    expect(resolveCanonicalFormSourceKey(FIXED_FORM_SOURCE_IDS.offerteForm)).toBe(
      "builtin:offerte:primary",
    );
    expect(resolveCanonicalFormSourceKey(FIXED_FORM_SOURCE_IDS.vacaturesApplication)).toBe(
      "builtin:vacatures:application",
    );

    // Migrated block UUID must never be the sole identity.
    const migratedContactBlockId = createMigrationBlockId({
      pageId: "page_contact",
      fixedKey: "contact.form",
      role: "primary",
    });
    expect(resolveCanonicalFormSourceKey(migratedContactBlockId)).toBeNull();
    expect(LEGACY_FORM_SOURCE_ALIASES[migratedContactBlockId]).toBeUndefined();
  });
});
