import { describe, expect, it } from "vitest";
import { PUBLISHABLE_BLOCK_TYPES } from "../blocks/registry";
import { ALL_FIXED_SECTION_KEYS } from "../e2e-inventory";
import { FIXED_SECTION_MIGRATION_ROLES } from "./roles";
import {
  assertMg5MatrixCoversM5Inventory,
  buildMg5MigrationMatrix,
  MG5_MIGRATION_MATRIX,
  mg5MatrixSummary,
} from "./mg5-matrix";
import { MG5_MIGRATION_VERSION } from "./mg5-version";

describe("MG5 migration matrix (M5-backed)", () => {
  it("covers every M5 fixed section key with no unexplained gaps", () => {
    const coverage = assertMg5MatrixCoversM5Inventory();
    expect(coverage.ok).toBe(true);
    expect(coverage.missingKeys).toEqual([]);
    expect(coverage.m5KeyCount).toBe(ALL_FIXED_SECTION_KEYS.length);
    expect(coverage.matrixKeyCount).toBe(ALL_FIXED_SECTION_KEYS.length);
  });

  it("has a role row for every FIXED_SECTION_MIGRATION_ROLES entry on inventory pages", () => {
    const matrix = buildMg5MigrationMatrix();
    for (const key of ALL_FIXED_SECTION_KEYS) {
      const roles = FIXED_SECTION_MIGRATION_ROLES[key];
      const rows = matrix.filter((e) => e.legacySectionKey === key);
      expect(rows.length).toBe(roles.length);
      for (const spec of roles) {
        expect(rows.some((r) => r.role === spec.role && r.targetBlockType === spec.blockType)).toBe(
          true,
        );
      }
    }
  });

  it("maps only to publishable BlockTypes", () => {
    const publishable = new Set<string>(PUBLISHABLE_BLOCK_TYPES);
    for (const entry of MG5_MIGRATION_MATRIX) {
      expect(publishable.has(entry.targetBlockType)).toBe(true);
    }
  });

  it("classifies dual-read families as fixture-qualified and others explicitly", () => {
    const summary = mg5MatrixSummary();
    expect(summary.migrationVersion).toBe(MG5_MIGRATION_VERSION);
    expect(summary.migrationEligibleRows).toBe(summary.matrixRows);
    expect(summary.intentionallyFixedRows).toBe(0);
    expect(summary.fixtureQualifiedRows).toBeGreaterThan(0);
    expect(summary.unqualifiedRows).toBeGreaterThan(0);

    const products = MG5_MIGRATION_MATRIX.filter((e) => e.pageKey === "products");
    expect(products.every((e) => e.qualification === "fixture-qualified")).toBe(true);
    expect(products.every((e) => e.dualReadModule)).toBe(true);

    const contactForm = MG5_MIGRATION_MATRIX.find((e) => e.legacySectionKey === "contact.form");
    expect(contactForm?.formSourceAfter).toBe("builtin:contact:primary");
    expect(contactForm?.qualification).toBe("unqualified");
  });

  it("documents deterministic block id rule for every row", () => {
    for (const entry of MG5_MIGRATION_MATRIX) {
      expect(entry.deterministicBlockIdRule).toContain("uuidV5");
      expect(entry.deterministicBlockIdRule).toContain(MG5_MIGRATION_VERSION);
      expect(entry.rollbackStrategy.length).toBeGreaterThan(10);
    }
  });
});
