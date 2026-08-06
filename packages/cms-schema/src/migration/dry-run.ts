import type { BuiltinCmsPage, Block } from "../types";
import { isFixedSectionKey, type FixedSectionKey } from "../sections";
import { BLOCKS_ONLY_LAYOUT_VERSION, createMigrationBlockId } from "./block-id";
import { checksumOf } from "./checksum";
import { FIXED_SECTION_MIGRATION_ROLES } from "./roles";
import { emptyMigrationReport, type PageMigrationReport } from "./report";
import { createRollbackSnapshot } from "./rollback";

export type DryRunMigrationOptions = {
  /** When true (default), never mutates the input page. */
  dryRun?: boolean;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Collect unknown top-level keys on a section content object vs an allowlist of known keys.
 * Gate 1: report only — do not put unknowns into publishable block data.
 */
export function collectUnknownSectionFields(
  fixedKey: FixedSectionKey,
  content: unknown,
  knownKeys: readonly string[],
): Array<{ fixedKey: string; path: string }> {
  if (!isRecord(content)) return [{ fixedKey, path: "(non-object)" }];
  const known = new Set(knownKeys);
  const out: Array<{ fixedKey: string; path: string }> = [];
  for (const key of Object.keys(content)) {
    if (!known.has(key)) {
      out.push({ fixedKey, path: key });
    }
  }
  return out;
}

/** Known keys used for dry-run unknown-field detection (strict publish schemas land in Gate 2). */
const KNOWN_SECTION_KEYS: Partial<Record<FixedSectionKey, readonly string[]>> = {
  "home.hero": ["heading", "headingAccent", "body", "primaryCta", "secondaryCta", "image", "eyebrow"],
  "home.partners": ["eyebrow", "heading", "items", "logoBackdrop"],
  "home.stats": ["eyebrow", "heading", "body", "items"],
  "home.workGallery": ["eyebrow", "heading", "body", "items"],
  "about.main": [
    "eyebrow",
    "heading",
    "intro",
    "mission",
    "vision",
    "history",
    "missionTitle",
    "missionBody",
    "visionTitle",
    "visionBody",
    "historyTitle",
    "historyBody",
  ],
  "services.main": ["eyebrow", "heading", "intro", "body"],
  "services.cards": ["cards", "items"],
  "products.main": ["eyebrow", "heading", "body", "image", "cta"],
  "products.info": ["eyebrow", "heading", "items", "cards"],
  "contact.main": ["eyebrow", "heading", "body", "image"],
  "contact.info": ["items", "eyebrow", "heading"],
  "contact.form": ["heading", "body", "submitLabel", "successMessage", "formScope"],
  "vacatures.main": ["eyebrow", "heading", "body", "image", "applicationScope"],
  "vacatures.application": [
    "formEyebrow",
    "formIntro",
    "fields",
    "mediaEyebrow",
    "mediaHeading",
    "mediaBadge",
    "mediaLinkLabel",
    "media",
    "applicationScope",
  ],
  "offerte.main": ["eyebrow", "heading", "body", "image"],
  "offerte.info": ["items", "eyebrow", "heading"],
  "offerte.form": [
    "heading",
    "body",
    "description",
    "glassScope",
    "furnitureScope",
    "submitLabel",
    "successMessage",
  ],
  "privacy.main": ["eyebrow", "heading", "updatedLabel", "updatedAt", "articles"],
  "terms.main": ["eyebrow", "heading", "updatedLabel", "updatedAt", "articles"],
};

/**
 * Dry-run (or plan) fixed→blocks migration for one builtin page.
 * Gate 1: does not persist and does not mutate the caller's page object.
 * Idempotent planning: existing deterministic block IDs are listed as already present.
 */
export function dryRunFixedToBlocksMigration(
  page: BuiltinCmsPage,
  options: DryRunMigrationOptions = {},
): PageMigrationReport {
  const dryRun = options.dryRun !== false;
  const report = emptyMigrationReport({
    pageId: page.id,
    pageKey: page.pageKey ?? "unknown",
    fromVersion: page.layoutVersion ?? 0,
    toVersion: BLOCKS_ONLY_LAYOUT_VERSION,
    dryRun,
  });

  if (page.kind !== "builtin" || !page.pageKey) {
    report.errors.push("Page is not a layout-capable builtin.");
    return report;
  }

  const legacyPayload = {
    layout: page.layout,
    blocks: page.blocks,
    sectionContent: page.sectionContent ?? {},
    layoutVersion: page.layoutVersion,
    enFieldDrafts: page.enFieldDrafts ?? {},
  };
  report.legacyChecksum = checksumOf(legacyPayload);

  // Rollback snapshot structure is always buildable in memory (Gate 1 — not persisted).
  const snapshot = createRollbackSnapshot(page, `rollback_${page.id}_${report.legacyChecksum.slice(0, 12)}`);
  if (snapshot.checksum !== report.legacyChecksum) {
    // layout/blocks-only checksum vs full snapshot — keep both informative
    report.warnings.push("Rollback snapshot checksum uses full page clone; legacyChecksum is layout/content bag.");
  }

  const existingBlockIds = new Set(page.blocks.map((b) => b.id));
  report.preservedExistingBlocks = page.blocks.length;

  const fixedItems = page.layout.filter((i) => i.kind === "fixed");
  for (const item of fixedItems) {
    if (!isFixedSectionKey(item.key)) {
      report.errors.push(`Unknown fixed key in layout: ${String(item.key)}`);
      continue;
    }
    report.legacySectionsFound.push(item.key);
    const roles = FIXED_SECTION_MIGRATION_ROLES[item.key];
    const content = (page.sectionContent as Record<string, unknown> | undefined)?.[item.key];
    const known = KNOWN_SECTION_KEYS[item.key] ?? [];
    report.unknownLegacyFields.push(...collectUnknownSectionFields(item.key, content ?? {}, known));

    if (content === undefined) {
      report.warnings.push(`Missing sectionContent for ${item.key}`);
    }

    for (const spec of roles) {
      const blockId = createMigrationBlockId({
        pageId: page.id,
        fixedKey: item.key,
        role: spec.role,
      });
      if (existingBlockIds.has(blockId)) {
        report.warnings.push(
          `Block ${blockId} already present for ${item.key}/${spec.role} — rerun would not duplicate.`,
        );
      }
      report.blocksCreated.push({
        blockId,
        type: spec.blockType,
        sourceFixedKey: item.key,
        role: spec.role,
      });
    }
  }

  // Planned migrated bag for checksum (IDs + types only in Gate 1 — no content mapping yet).
  const plannedBlocks: Array<{ id: string; type: string; data: Record<string, unknown> }> = [
    ...page.blocks,
    ...report.blocksCreated
      .filter((b) => !existingBlockIds.has(b.blockId))
      .map((b) => ({
        id: b.blockId,
        type: b.type,
        data: {},
      })),
  ];
  report.migratedChecksum = checksumOf({
    plannedBlockIds: plannedBlocks.map((b) => b.id).sort(),
    roles: report.blocksCreated,
    toVersion: BLOCKS_ONLY_LAYOUT_VERSION,
  });

  if (report.unknownLegacyFields.length) {
    report.warnings.push(
      `${report.unknownLegacyFields.length} unknown legacy field(s) would be retained in rollback only.`,
    );
  }

  // Gate 1: dry-run never claims publishable — block types may not exist yet.
  report.publishableAfterMigration = false;
  if (report.errors.length === 0 && report.blocksCreated.length === 0 && fixedItems.length === 0) {
    report.warnings.push("No fixed sections found — page may already be blocks-only or empty layout.");
  }

  return report;
}

/**
 * Idempotency helper: given two dry-runs, block IDs must match.
 */
export function migrationBlockIdsEqual(a: PageMigrationReport, b: PageMigrationReport): boolean {
  const idsA = a.blocksCreated.map((x) => x.blockId).sort();
  const idsB = b.blocksCreated.map((x) => x.blockId).sort();
  return idsA.length === idsB.length && idsA.every((id, i) => id === idsB[i]);
}
