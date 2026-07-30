import { describe, expect, it } from "vitest";
import { FIXED_FORM_SOURCE_IDS } from "@mccoy/domain";
import {
  applyFixedToBlocksMigration,
  createMigrationBlockId,
  dryRunFixedToBlocksMigration,
  fixtureUntouchedHome,
  markMigrationVerified,
  resolveCanonicalFormSourceKey,
  CANONICAL_FORM_SOURCE_KEYS,
  normalizeGalleryShape,
  getBlockDataDefinition,
} from "../index";

describe("form source aliases", () => {
  it("maps legacy fixed aliases to canonical keys", () => {
    expect(resolveCanonicalFormSourceKey(FIXED_FORM_SOURCE_IDS.contactForm)).toBe(
      CANONICAL_FORM_SOURCE_KEYS.contact,
    );
    expect(resolveCanonicalFormSourceKey(FIXED_FORM_SOURCE_IDS.offerteForm)).toBe(
      CANONICAL_FORM_SOURCE_KEYS.offerte,
    );
    expect(resolveCanonicalFormSourceKey(CANONICAL_FORM_SOURCE_KEYS.contact)).toBe(
      CANONICAL_FORM_SOURCE_KEYS.contact,
    );
  });
});

describe("gallery shape", () => {
  it("defaults unknown to square", () => {
    expect(normalizeGalleryShape(undefined)).toBe("square");
    expect(normalizeGalleryShape("wide")).toBe("wide");
    expect(normalizeGalleryShape("tall")).toBe("tall");
  });
});

describe("applyFixedToBlocksMigration", () => {
  it("is idempotent on block IDs and leaves sectionContent as backup", () => {
    const page = fixtureUntouchedHome();
    const once = applyFixedToBlocksMigration(page);
    expect(once.ok).toBe(true);
    if (!once.ok) return;
    expect(once.metadata.status).toBe("migrated");
    expect(once.page.layout.every((i) => i.kind === "block")).toBe(true);
    expect(once.page.sectionContent).toBeTruthy();
    const heroId = createMigrationBlockId({
      pageId: "page_home",
      fixedKey: "home.hero",
      role: "primary",
    });
    expect(once.page.blocks.some((b) => b.id === heroId)).toBe(true);

    const twice = applyFixedToBlocksMigration(once.page);
    expect(twice.ok).toBe(true);
    if (!twice.ok) return;
    const ids1 = once.page.blocks.map((b) => b.id).sort();
    const ids2 = twice.page.blocks.map((b) => b.id).sort();
    expect(ids2).toEqual(ids1);
    expect(markMigrationVerified(once.metadata).status).toBe("verified");
  });

  it("dry-run does not mutate", () => {
    const page = fixtureUntouchedHome();
    const before = structuredClone(page);
    dryRunFixedToBlocksMigration(page);
    expect(page).toEqual(before);
  });
});

describe("new block registry", () => {
  it("registers all new types", () => {
    for (const type of [
      "partnersMarquee",
      "statsCounters",
      "contactInfoCards",
      "quoteRequestForm",
      "legalArticles",
    ] as const) {
      expect(getBlockDataDefinition(type).type).toBe(type);
      expect(getBlockDataDefinition(type).capabilities.publishable).toBe(true);
    }
  });
});
