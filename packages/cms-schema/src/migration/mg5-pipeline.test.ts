import { describe, expect, it } from "vitest";
import { CMS_SCHEMA_VERSION } from "../types";
import {
  assertMigrationIdempotent,
  migrateFixedToBlocks,
  pageContentHash,
} from "./mg5-pipeline";
import { MG5_MIGRATION_VERSION } from "./mg5-version";
import {
  fixtureAlreadyMigratedHome,
  fixturePartiallyMigratedHome,
  fixtureUntouchedHome,
  fixtureWithExtraCustomBlocks,
} from "./fixtures";
import { resolveProductsBlocksLayout, productsMigrationBlockId } from "./products-blocks";
import { createMigrationBlockId } from "./block-id";
import type { BuiltinCmsPage } from "../types";
import { CURRENT_LAYOUT_VERSION } from "../sections";

function productsLegacyPage(): BuiltinCmsPage {
  return {
    kind: "builtin",
    isCustom: false,
    id: "page_products",
    pageKey: "products",
    slug: "/producten",
    title: "Producten",
    description: "fixture",
    inNav: true,
    blocks: [],
    layout: [
      { id: "fixed:products.main", kind: "fixed", key: "products.main", hidden: false },
      { id: "fixed:products.info", kind: "fixed", key: "products.info", hidden: false },
    ],
    layoutVersion: CURRENT_LAYOUT_VERSION,
    sectionContent: {
      "products.main": {
        heading: "Ons assortiment",
        intro: "Intro NL",
        body: "Notice NL",
        image: { kind: "url", url: "/images/products.jpg", alt: "Producten" },
      },
      "products.info": {
        heading: "Productinfo",
        items: [{ id: "feat_1", title: "Glas", body: "Body", icon: "sparkles" }],
      },
    } as unknown as BuiltinCmsPage["sectionContent"],
    enFieldDrafts: {
      "section:products.main:heading": "Our range",
    },
    updatedAt: 1,
    version: 1,
  };
}

function emptyProductsAfterMigrationStamp(): BuiltinCmsPage {
  const migrated = resolveProductsBlocksLayout(productsLegacyPage()).page;
  return {
    ...migrated,
    layout: [],
    blocks: [],
    productsBlocksMigration: {
      version: 1,
      status: "verified",
      migratedAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

describe("MG5 pure migration pipeline", () => {
  it("dry-run style migrate does not mutate the input page object", () => {
    const page = fixtureUntouchedHome();
    const before = structuredClone(page);
    migrateFixedToBlocks({
      page,
      migrationContext: {
        schemaVersion: CMS_SCHEMA_VERSION,
        pageKey: "home",
        migrationVersion: MG5_MIGRATION_VERSION,
        mode: "family",
      },
    });
    expect(page).toEqual(before);
  });

  it("home family migrate is deterministic and idempotent", () => {
    const page = fixtureUntouchedHome();
    const a = migrateFixedToBlocks({
      page,
      migrationContext: {
        schemaVersion: CMS_SCHEMA_VERSION,
        pageKey: "home",
        migrationVersion: MG5_MIGRATION_VERSION,
        mode: "family",
      },
    });
    const b = migrateFixedToBlocks({
      page,
      migrationContext: {
        schemaVersion: CMS_SCHEMA_VERSION,
        pageKey: "home",
        migrationVersion: MG5_MIGRATION_VERSION,
        mode: "family",
      },
    });
    expect(a.blocked).toBe(false);
    expect(a.afterHash).toBe(b.afterHash);
    const heroId = createMigrationBlockId({
      pageId: "page_home",
      fixedKey: "home.hero",
      role: "primary",
    });
    expect(a.migratedPage.blocks.some((blk) => blk.id === heroId)).toBe(true);

    const idem = assertMigrationIdempotent(page, "family");
    expect(idem.ok).toBe(true);
    expect(idem.second?.changed).toBe(false);
    expect(idem.second?.operations).toEqual([]);
  });

  it("preserves Producten NL content and deterministic IDs", () => {
    const page = productsLegacyPage();
    const result = migrateFixedToBlocks({
      page,
      migrationContext: {
        schemaVersion: CMS_SCHEMA_VERSION,
        pageKey: "products",
        migrationVersion: MG5_MIGRATION_VERSION,
        mode: "family",
        strictAbsence: true,
      },
    });
    expect(result.blocked).toBe(false);
    expect(result.changed).toBe(true);
    const mainId = productsMigrationBlockId(page.id, "products.main");
    const infoId = productsMigrationBlockId(page.id, "products.info");
    const main = result.migratedPage.blocks.find((b) => b.id === mainId);
    expect(main?.type).toBe("textImage");
    expect((main?.data as { title?: string }).title).toBe("Ons assortiment");
    expect(result.migratedPage.blocks.some((b) => b.id === infoId)).toBe(true);
    expect(result.migratedPage.enFieldDrafts?.[`block:${mainId}:title`]).toBe("Our range");
  });

  it("strict absence: verified empty Producten layout is not reinjected", () => {
    const page = emptyProductsAfterMigrationStamp();
    const result = migrateFixedToBlocks({
      page,
      migrationContext: {
        schemaVersion: CMS_SCHEMA_VERSION,
        pageKey: "products",
        migrationVersion: MG5_MIGRATION_VERSION,
        mode: "family",
        strictAbsence: true,
      },
    });
    expect(result.migratedPage.layout).toEqual([]);
    expect(result.migratedPage.blocks).toEqual([]);
  });

  it("already migrated / extra custom blocks stay stable under family mode", () => {
    for (const factory of [fixtureAlreadyMigratedHome, fixtureWithExtraCustomBlocks]) {
      const page = factory();
      const before = pageContentHash(page);
      const result = migrateFixedToBlocks({
        page,
        migrationContext: {
          schemaVersion: CMS_SCHEMA_VERSION,
          pageKey: "home",
          migrationVersion: MG5_MIGRATION_VERSION,
          mode: "family",
        },
      });
      // Family mode only touches home.hero — already migrated hero ⇒ unchanged or non-blocking.
      expect(result.blocked).toBe(false);
      if (!result.changed) {
        expect(result.afterHash).toBe(before);
      }
    }
  });

  it("partial home dual representation with divergent content fails closed", () => {
    const page = fixturePartiallyMigratedHome();
    // Divergent: fixed sectionContent still has original; block data may match mapped —
    // ensure conflict path exists by mutating block data away from mapped fingerprint.
    const heroId = createMigrationBlockId({
      pageId: page.id,
      fixedKey: "home.hero",
      role: "primary",
    });
    const idx = page.blocks.findIndex((b) => b.id === heroId);
    page.blocks[idx] = {
      ...page.blocks[idx]!,
      data: { title: "DIFFERENT", subtitle: "x" },
    };
    // Put fixed hero back so both exist.
    page.layout = [
      { id: "fixed:home.hero", kind: "fixed", key: "home.hero", hidden: false },
      ...page.layout.filter((i) => !(i.kind === "block" && i.blockId === heroId)),
    ];
    const result = migrateFixedToBlocks({
      page,
      migrationContext: {
        schemaVersion: CMS_SCHEMA_VERSION,
        pageKey: "home",
        migrationVersion: MG5_MIGRATION_VERSION,
        mode: "family",
      },
    });
    expect(result.blocked).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.conflicts.some((c) => c.conflict === "ambiguous" || c.conflict === "content_conflict")).toBe(
      true,
    );
  });

  it("unsupported newer schema version fails safely", () => {
    const page = fixtureUntouchedHome();
    const result = migrateFixedToBlocks({
      page,
      migrationContext: {
        schemaVersion: CMS_SCHEMA_VERSION + 10,
        pageKey: "home",
        migrationVersion: MG5_MIGRATION_VERSION,
        mode: "family",
      },
    });
    expect(result.blocked).toBe(true);
    expect(result.changed).toBe(false);
    expect(result.validation.issues.some((i) => i.code === "mg5.unsupported_schema_version")).toBe(
      true,
    );
  });

  it("full mode migrates remaining home fixed keys via wholesale apply", () => {
    const page = fixtureUntouchedHome();
    const result = migrateFixedToBlocks({
      page,
      migrationContext: {
        schemaVersion: CMS_SCHEMA_VERSION,
        pageKey: "home",
        migrationVersion: MG5_MIGRATION_VERSION,
        mode: "full",
      },
    });
    expect(result.blocked).toBe(false);
    expect(result.migratedPage.layout.every((i) => i.kind === "block")).toBe(true);
    const idem = assertMigrationIdempotent(page, "full");
    expect(idem.ok).toBe(true);
  });
});
