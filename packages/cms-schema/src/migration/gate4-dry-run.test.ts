import { describe, expect, it } from "vitest";
import {
  dryRunFixedToBlocksMigration,
  fixtureAboutNlEn,
  fixtureAlreadyMigratedHome,
  fixtureMalformedLegacyContent,
  fixtureMissingSectionContent,
  fixturePartiallyMigratedHome,
  fixtureUntouchedHome,
  fixtureWithExtraCustomBlocks,
  applyFixedToBlocksMigration,
  type PageMigrationReport,
} from "./index";

function assertDryRunCleanEnough(report: PageMigrationReport) {
  expect(report.dryRun).toBe(true);
  expect(report.errors).toEqual([]);
  // Unknown-field warnings are expected for malformed fixtures only.
}

describe("Gate 4 — dry-run migration matrix", () => {
  const fixtures = [
    ["untouched home", fixtureUntouchedHome],
    ["partial home", fixturePartiallyMigratedHome],
    ["already migrated", fixtureAlreadyMigratedHome],
    ["extra custom blocks", fixtureWithExtraCustomBlocks],
    ["missing sectionContent", fixtureMissingSectionContent],
    ["about NL/EN", fixtureAboutNlEn],
  ] as const;

  for (const [name, factory] of fixtures) {
    it(`dry-runs ${name} without errors`, () => {
      const report = dryRunFixedToBlocksMigration(factory());
      assertDryRunCleanEnough(report);
      expect(report.legacyChecksum).toBeTruthy();
      expect(report.migratedChecksum).toBeTruthy();
    });
  }

  it("malformed fixture reports unknowns but no hard errors", () => {
    const report = dryRunFixedToBlocksMigration(fixtureMalformedLegacyContent());
    expect(report.errors).toEqual([]);
    expect(report.unknownLegacyFields.length).toBeGreaterThan(0);
  });

  it("selected-page apply (in-memory) for home then idempotent rerun", () => {
    const page = fixtureUntouchedHome();
    const applied = applyFixedToBlocksMigration(page);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.page.layout.every((i) => i.kind === "block")).toBe(true);
    const again = applyFixedToBlocksMigration(applied.page);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.page.blocks.map((b) => b.id).sort()).toEqual(
      applied.page.blocks.map((b) => b.id).sort(),
    );
  });
});
