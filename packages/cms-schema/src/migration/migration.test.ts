import { describe, expect, it } from "vitest";
import {
  BLOCKS_ONLY_LAYOUT_VERSION,
  createMigrationBlockId,
  createUuidV5,
  CMS_MIGRATION_NAMESPACE,
  dryRunFixedToBlocksMigration,
  fixtureAboutNlEn,
  fixtureAlreadyMigratedHome,
  fixtureMalformedLegacyContent,
  fixtureMissingSectionContent,
  fixturePartiallyMigratedHome,
  fixtureUntouchedHome,
  fixtureWithExtraCustomBlocks,
  isMigrationVerifiedForRender,
  layoutMigrationMetadataSchema,
  migrationBlockIdsEqual,
  checksumOf,
  createRollbackSnapshot,
} from "./index";

describe("createUuidV5 / createMigrationBlockId", () => {
  it("same inputs → same ID", () => {
    const a = createMigrationBlockId({
      pageId: "page_home",
      fixedKey: "home.hero",
      role: "primary",
    });
    const b = createMigrationBlockId({
      pageId: "page_home",
      fixedKey: "home.hero",
      role: "primary",
    });
    expect(a).toBe(b);
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it("different roles → different IDs", () => {
    const mission = createMigrationBlockId({
      pageId: "page_about",
      fixedKey: "about.main",
      role: "mission",
    });
    const vision = createMigrationBlockId({
      pageId: "page_about",
      fixedKey: "about.main",
      role: "vision",
    });
    expect(mission).not.toBe(vision);
  });

  it("different pages → different IDs", () => {
    const a = createMigrationBlockId({
      pageId: "page_home",
      fixedKey: "home.hero",
      role: "primary",
    });
    const b = createMigrationBlockId({
      pageId: "page_contact",
      fixedKey: "home.hero",
      role: "primary",
    });
    expect(a).not.toBe(b);
  });

  it("NL and EN overlays share the same underlying block ID", () => {
    const id = createMigrationBlockId({
      pageId: "page_home",
      fixedKey: "home.hero",
      role: "primary",
    });
    // Locale must not affect identity — name string has no locale.
    expect(
      createUuidV5(`page_home:home.hero:primary`, CMS_MIGRATION_NAMESPACE),
    ).toBe(id);
  });

  it("does not include title/content in identity", () => {
    const a = createMigrationBlockId({
      pageId: "page_home",
      fixedKey: "home.hero",
      role: "primary",
    });
    // Changing content cannot change ID by construction of the API.
    expect(a).toBe(
      createMigrationBlockId({
        pageId: "page_home",
        fixedKey: "home.hero",
        role: "primary",
      }),
    );
  });
});

describe("LayoutMigrationMetadata", () => {
  it("parses status machine and verified gate", () => {
    const meta = layoutMigrationMetadataSchema.parse({
      status: "verified",
      fromVersion: 6,
      toVersion: BLOCKS_ONLY_LAYOUT_VERSION,
      migratedAt: "2026-07-29T12:00:00.000Z",
      legacyChecksum: "abc",
      migratedChecksum: "def",
      migrationId: "mig_1",
      rollbackSnapshotId: "rb_1",
    });
    expect(isMigrationVerifiedForRender(meta)).toBe(true);
    expect(
      isMigrationVerifiedForRender({ ...meta, status: "migrated" }),
    ).toBe(false);
    expect(isMigrationVerifiedForRender(null)).toBe(false);
  });
});

describe("dryRunFixedToBlocksMigration fixtures", () => {
  it("untouched home plans deterministic blocks without mutating", () => {
    const page = fixtureUntouchedHome();
    const before = structuredClone(page);
    const report = dryRunFixedToBlocksMigration(page);
    expect(report.dryRun).toBe(true);
    expect(report.toVersion).toBe(BLOCKS_ONLY_LAYOUT_VERSION);
    expect(report.legacySectionsFound).toEqual([
      "home.hero",
      "home.partners",
      "home.stats",
      "home.workGallery",
    ]);
    expect(report.blocksCreated).toHaveLength(4);
    expect(report.publishableAfterMigration).toBe(false);
    expect(page).toEqual(before);
    expect(report.legacyChecksum).toBeTruthy();
    expect(report.migratedChecksum).toBeTruthy();
  });

  it("migration rerun → same IDs", () => {
    const page = fixtureUntouchedHome();
    const a = dryRunFixedToBlocksMigration(page);
    const b = dryRunFixedToBlocksMigration(page);
    expect(migrationBlockIdsEqual(a, b)).toBe(true);
  });

  it("partially migrated resumes without planning the already-converted slot as fixed", () => {
    const page = fixturePartiallyMigratedHome();
    const report = dryRunFixedToBlocksMigration(page);
    const heroId = createMigrationBlockId({
      pageId: "page_home",
      fixedKey: "home.hero",
      role: "primary",
    });
    expect(report.preservedExistingBlocks).toBe(1);
    expect(page.blocks.some((b) => b.id === heroId)).toBe(true);
    expect(report.legacySectionsFound).toEqual([
      "home.partners",
      "home.stats",
      "home.workGallery",
    ]);
    expect(report.blocksCreated.every((b) => b.blockId !== heroId)).toBe(true);
    expect(report.blocksCreated).toHaveLength(3);
  });

  it("already migrated layout has no fixed sections", () => {
    const page = fixtureAlreadyMigratedHome();
    const report = dryRunFixedToBlocksMigration(page);
    expect(report.legacySectionsFound).toEqual([]);
    expect(report.blocksCreated).toEqual([]);
  });

  it("preserves count of existing custom blocks", () => {
    const page = fixtureWithExtraCustomBlocks();
    const report = dryRunFixedToBlocksMigration(page);
    expect(report.preservedExistingBlocks).toBe(1);
    expect(page.blocks[0]?.id).toBe("user_block_cta_1");
    expect(report.blocksCreated).toHaveLength(4);
  });

  it("missing sectionContent warns", () => {
    const report = dryRunFixedToBlocksMigration(fixtureMissingSectionContent());
    expect(report.warnings.some((w) => w.includes("Missing sectionContent"))).toBe(true);
  });

  it("malformed legacy content reports unknown / non-object fields", () => {
    const report = dryRunFixedToBlocksMigration(fixtureMalformedLegacyContent());
    expect(report.unknownLegacyFields.some((u) => u.path === "(non-object)")).toBe(true);
    expect(report.unknownLegacyFields.some((u) => u.path === "secretField")).toBe(true);
  });

  it("about NL/EN fixture plans four roles with stable IDs", () => {
    const page = fixtureAboutNlEn();
    const report = dryRunFixedToBlocksMigration(page);
    expect(report.blocksCreated.map((b) => b.role).sort()).toEqual([
      "history",
      "intro",
      "mission",
      "vision",
    ]);
    const mission = createMigrationBlockId({
      pageId: "page_about",
      fixedKey: "about.main",
      role: "mission",
    });
    expect(report.blocksCreated.find((b) => b.role === "mission")?.blockId).toBe(mission);
    expect(page.enFieldDrafts?.["section:about.main:heading"]).toBe("About EN");
  });

  it("checksum + rollback snapshot are stable for identical pages", () => {
    const page = fixtureUntouchedHome();
    const a = checksumOf(page.sectionContent);
    const b = checksumOf(structuredClone(page.sectionContent));
    expect(a).toBe(b);
    const snap = createRollbackSnapshot(page, "rb_test");
    expect(snap.pageId).toBe("page_home");
    expect(snap.legacySectionContent).toBeTruthy();
  });
});
