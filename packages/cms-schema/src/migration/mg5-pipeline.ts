/**
 * MG5 pure fixed→blocks migration pipeline.
 * No Supabase, filesystem, localStorage, React, or random IDs.
 */

import { CMS_SCHEMA_VERSION, type BuiltinCmsPage } from "../types";
import { validateCmsPage, type ValidateIssue } from "../pipeline";
import { checksumOf } from "./checksum";
import { applyFixedToBlocksMigration } from "./apply";
import { resolveProductsBlocksLayout } from "./products-blocks";
import { resolveHomeHeroBlocksLayout } from "./home-hero-blocks";
import { resolveAboutBlocksLayout } from "./about-blocks";
import { resolveOfferteBlocksLayout } from "./offerte-blocks";
import { resolveLegalBlocksLayout } from "./legal-blocks";
import { MG5_MIGRATION_VERSION } from "./mg5-version";
import {
  classifyPageFixedBlockConflicts,
  conflictsBlockApply,
} from "./mg5-conflicts";
import type {
  FixedToBlockMigrationInput,
  FixedToBlockMigrationResult,
  MigrationOperation,
  MigrationWarning,
} from "./mg5-contract";
import { createMigrationBlockId } from "./block-id";
import { FIXED_SECTION_MIGRATION_ROLES } from "./roles";
import { isFixedSectionKey } from "../sections";

/** Unsupported future envelope versions fail closed. */
export const MG5_MAX_SUPPORTED_SCHEMA_VERSION = CMS_SCHEMA_VERSION;

/** Strip volatile timestamps so identical migrations hash equal across clocks. */
function migrationStateForHash(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw ?? null;
  const { migratedAt: _migratedAt, ...rest } = raw as Record<string, unknown>;
  return rest;
}

export function pageContentHash(page: BuiltinCmsPage): string {
  return checksumOf({
    id: page.id,
    pageKey: page.pageKey,
    layoutVersion: page.layoutVersion,
    layout: page.layout,
    blocks: page.blocks,
    sectionContent: page.sectionContent ?? {},
    enFieldDrafts: page.enFieldDrafts ?? {},
    enFieldDraftSources: page.enFieldDraftSources ?? {},
    productsBlocksMigration: migrationStateForHash(page.productsBlocksMigration),
    homeHeroBlocksMigration: migrationStateForHash(page.homeHeroBlocksMigration),
    aboutBlocksMigration: migrationStateForHash(page.aboutBlocksMigration),
    offerteBlocksMigration: migrationStateForHash(page.offerteBlocksMigration),
    legalBlocksMigration: migrationStateForHash(page.legalBlocksMigration),
  });
}

function collectFamilyOperations(
  before: BuiltinCmsPage,
  after: BuiltinCmsPage,
): MigrationOperation[] {
  const ops: MigrationOperation[] = [];
  const beforeIds = new Set(before.blocks.map((b) => b.id));
  for (const block of after.blocks) {
    if (!beforeIds.has(block.id)) {
      const roleMatch = findRoleForBlock(after.id, block.id);
      ops.push({
        op: "create_block",
        blockId: block.id,
        blockType: block.type,
        sourceFixedKey: roleMatch?.fixedKey ?? "unknown",
        role: roleMatch?.role ?? "primary",
      });
    }
  }
  for (const item of before.layout) {
    if (item.kind !== "fixed" || !isFixedSectionKey(item.key)) continue;
    const stillFixed = after.layout.some((i) => i.kind === "fixed" && i.key === item.key);
    if (!stillFixed) {
      const blockIds = FIXED_SECTION_MIGRATION_ROLES[item.key].map((spec) =>
        createMigrationBlockId({
          pageId: after.id,
          fixedKey: item.key,
          role: spec.role,
        }),
      );
      ops.push({
        op: "replace_layout_fixed",
        fixedKey: item.key,
        blockIds,
      });
    }
  }
  const beforeEn = before.enFieldDrafts ?? {};
  const afterEn = after.enFieldDrafts ?? {};
  for (const key of Object.keys(afterEn)) {
    if (!(key in beforeEn) || beforeEn[key] !== afterEn[key]) {
      const from = Object.keys(beforeEn).find((k) => !(k in afterEn));
      if (from) {
        ops.push({ op: "remap_en_path", from, to: key });
      }
    }
  }
  return ops;
}

function findRoleForBlock(
  pageId: string,
  blockId: string,
): { fixedKey: string; role: string } | null {
  for (const [fixedKey, roles] of Object.entries(FIXED_SECTION_MIGRATION_ROLES)) {
    for (const spec of roles) {
      const id = createMigrationBlockId({
        pageId,
        fixedKey,
        role: spec.role,
      });
      if (id === blockId) return { fixedKey, role: spec.role };
    }
  }
  return null;
}

function runFamilyResolvers(
  page: BuiltinCmsPage,
  strictAbsence: boolean,
): { page: BuiltinCmsPage; warnings: MigrationWarning[]; changed: boolean } {
  const warnings: MigrationWarning[] = [];
  let current = page;
  let changed = false;

  if (current.pageKey === "products") {
    // Strict MG5: skip Producten when already migrated/verified with empty layout —
    // resolveProductsBlocksLayout already preserves empty; we additionally refuse
    // to treat force-repair-only deltas as success when strictAbsence and no fixed keys.
    const beforeFixed = current.layout.filter((i) => i.kind === "fixed").length;
    const result = resolveProductsBlocksLayout(current);
    if (strictAbsence && beforeFixed === 0 && result.changed) {
      const injectedFixed = result.page.layout.some((i) => i.kind === "fixed");
      const injectedNewBlocks = result.page.blocks.length > current.blocks.length;
      if (injectedFixed || injectedNewBlocks) {
        warnings.push({
          code: "mg5.products.strict_absence_skip_reinjection",
          message:
            "Strict absence: refused Producten repair that would reinject missing optional sections.",
          pageId: current.id,
          severity: "warning",
        });
        // Keep original page (no reinjection).
      } else {
        current = result.page;
        changed = changed || result.changed;
      }
    } else {
      current = result.page;
      changed = changed || result.changed;
    }
    for (const w of result.report.warnings) {
      warnings.push({
        code: "mg5.products.warning",
        message: w,
        pageId: current.id,
        severity: "warning",
      });
    }
  }

  if (current.pageKey === "home") {
    const result = resolveHomeHeroBlocksLayout(current);
    current = result.page;
    changed = changed || result.changed;
    for (const w of result.report.warnings) {
      warnings.push({
        code: "mg5.home_hero.warning",
        message: w,
        pageId: current.id,
        severity: "warning",
      });
    }
  }

  if (current.pageKey === "about") {
    const result = resolveAboutBlocksLayout(current);
    current = result.page;
    changed = changed || result.changed;
    for (const w of result.report.warnings) {
      warnings.push({
        code: "mg5.about.warning",
        message: w,
        pageId: current.id,
        severity: "warning",
      });
    }
  }

  if (current.pageKey === "offerte") {
    const result = resolveOfferteBlocksLayout(current);
    current = result.page;
    changed = changed || result.changed;
    for (const w of result.report.warnings) {
      warnings.push({
        code: "mg5.offerte.warning",
        message: w,
        pageId: current.id,
        severity: "warning",
      });
    }
  }

  if (current.pageKey === "privacy" || current.pageKey === "terms") {
    const result = resolveLegalBlocksLayout(current);
    current = result.page;
    changed = changed || result.changed;
    for (const w of result.report.warnings) {
      warnings.push({
        code: "mg5.legal.warning",
        message: w,
        pageId: current.id,
        severity: "warning",
      });
    }
  }

  return { page: current, warnings, changed };
}

/**
 * Pure deterministic fixed→blocks migration for one builtin page.
 */
export function migrateFixedToBlocks(
  input: FixedToBlockMigrationInput,
): FixedToBlockMigrationResult {
  const mode = input.migrationContext.mode ?? "family";
  const strictAbsence = input.migrationContext.strictAbsence !== false;
  const page = structuredClone(input.page);
  const beforeHash = pageContentHash(page);
  const warnings: MigrationWarning[] = [];
  const operations: MigrationOperation[] = [];

  if (page.kind !== "builtin" || !page.pageKey) {
    return {
      changed: false,
      beforeHash,
      afterHash: beforeHash,
      migratedPage: page,
      operations: [],
      warnings: [
        {
          code: "mg5.not_builtin",
          message: "Page is not a layout-capable builtin.",
          severity: "warning",
        },
      ],
      validation: { ok: false, issues: [{ code: "mg5.not_builtin", message: "Not builtin" }] },
      conflicts: [],
      migrationVersion: MG5_MIGRATION_VERSION,
      pageId: page.id,
      pageKey: page.pageKey ?? "unknown",
      sourceSchemaVersion: input.migrationContext.schemaVersion,
      targetSchemaVersion: CMS_SCHEMA_VERSION,
      blocked: true,
    };
  }

  if (input.migrationContext.schemaVersion > MG5_MAX_SUPPORTED_SCHEMA_VERSION) {
    return {
      changed: false,
      beforeHash,
      afterHash: beforeHash,
      migratedPage: page,
      operations: [],
      warnings: [],
      validation: {
        ok: false,
        issues: [
          {
            code: "mg5.unsupported_schema_version",
            message: `Unsupported schemaVersion ${input.migrationContext.schemaVersion}`,
          },
        ],
      },
      conflicts: [],
      migrationVersion: MG5_MIGRATION_VERSION,
      pageId: page.id,
      pageKey: page.pageKey,
      sourceSchemaVersion: input.migrationContext.schemaVersion,
      targetSchemaVersion: CMS_SCHEMA_VERSION,
      blocked: true,
    };
  }

  const preConflicts = classifyPageFixedBlockConflicts(page);
  const blockingPre = preConflicts.filter(
    (c) => c.conflict === "content_conflict" || c.conflict === "ambiguous",
  );
  if (blockingPre.length) {
    return {
      changed: false,
      beforeHash,
      afterHash: beforeHash,
      migratedPage: page,
      operations: [],
      warnings: [
        {
          code: "mg5.pre_conflict",
          message: `${blockingPre.length} blocking dual-representation conflict(s).`,
          pageId: page.id,
          severity: "warning",
        },
      ],
      validation: { ok: true, issues: [] },
      conflicts: blockingPre,
      migrationVersion: MG5_MIGRATION_VERSION,
      pageId: page.id,
      pageKey: page.pageKey,
      sourceSchemaVersion: input.migrationContext.schemaVersion,
      targetSchemaVersion: CMS_SCHEMA_VERSION,
      blocked: true,
    };
  }

  let working = page;
  const family = runFamilyResolvers(working, strictAbsence);
  working = family.page;
  warnings.push(...family.warnings);
  operations.push(...collectFamilyOperations(page, working));

  if (mode === "full") {
    const remainingFixed = working.layout.some((i) => i.kind === "fixed");
    if (remainingFixed) {
      const applied = applyFixedToBlocksMigration(working);
      if (!applied.ok) {
        warnings.push({
          code: "mg5.full_apply_failed",
          message: applied.report.errors.join("; ") || "Wholesale apply failed.",
          pageId: working.id,
          severity: "warning",
        });
        return {
          changed: false,
          beforeHash,
          afterHash: beforeHash,
          migratedPage: page,
          operations,
          warnings,
          validation: {
            ok: false,
            issues: applied.report.errors.map((message) => ({
              code: "mg5.full_apply_failed",
              message,
            })),
          },
          conflicts: classifyPageFixedBlockConflicts(working),
          migrationVersion: MG5_MIGRATION_VERSION,
          pageId: page.id,
          pageKey: page.pageKey,
          sourceSchemaVersion: input.migrationContext.schemaVersion,
          targetSchemaVersion: CMS_SCHEMA_VERSION,
          blocked: true,
        };
      }
      operations.push(...collectFamilyOperations(working, applied.page));
      working = applied.page;
      for (const w of applied.report.warnings) {
        warnings.push({
          code: "mg5.full_apply.warning",
          message: w,
          pageId: working.id,
          severity: "warning",
        });
      }
    }
  }

  const afterHash = pageContentHash(working);
  const changed = beforeHash !== afterHash;
  const conflicts = classifyPageFixedBlockConflicts(working);
  const blocked = conflictsBlockApply(conflicts);

  let validationIssues: ValidateIssue[] = [];
  const validated = validateCmsPage(working);
  if (!validated.ok) {
    validationIssues = validated.issues;
  }

  return {
    changed,
    beforeHash,
    afterHash,
    migratedPage: working,
    operations: changed ? operations : [],
    warnings,
    validation: { ok: validationIssues.length === 0, issues: validationIssues },
    conflicts,
    migrationVersion: MG5_MIGRATION_VERSION,
    pageId: page.id,
    pageKey: page.pageKey,
    sourceSchemaVersion: input.migrationContext.schemaVersion,
    targetSchemaVersion: CMS_SCHEMA_VERSION,
    blocked,
  };
}

/** Idempotency helper: second migration must be a no-op when unblocked. */
export function assertMigrationIdempotent(page: BuiltinCmsPage, mode: "family" | "full" = "family") {
  const first = migrateFixedToBlocks({
    page,
    migrationContext: {
      schemaVersion: CMS_SCHEMA_VERSION,
      pageKey: page.pageKey ?? "",
      migrationVersion: MG5_MIGRATION_VERSION,
      mode,
      strictAbsence: true,
    },
  });
  if (first.blocked) return { ok: false as const, first, second: null };
  const second = migrateFixedToBlocks({
    page: first.migratedPage,
    migrationContext: {
      schemaVersion: CMS_SCHEMA_VERSION,
      pageKey: first.migratedPage.pageKey ?? "",
      migrationVersion: MG5_MIGRATION_VERSION,
      mode,
      strictAbsence: true,
    },
  });
  return {
    ok: second.changed === false && second.operations.length === 0 && !second.blocked,
    first,
    second,
  };
}
