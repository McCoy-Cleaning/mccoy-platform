import type { LayoutMigrationMetadata } from "./metadata";
import { isMigrationVerifiedForRender } from "./metadata";
import { BLOCKS_ONLY_LAYOUT_VERSION } from "./block-id";

/**
 * Gate 7 retirement criteria — fixed renderers must remain until ALL are true
 * against persisted data (not fixtures alone).
 */
export type FixedRendererRetirementChecklist = {
  allBuiltinFixturesMigrated: boolean;
  productionLikeSnapshotsMigrated: boolean;
  nlAndEnRenderOk: boolean;
  formAliasesResolve: boolean;
  noFixedLayoutEntriesAtCurrentVersion: boolean;
  noPublishableOldLayoutVersion: boolean;
  previewStorefrontAgree: boolean;
  rollbackFixtureSucceeds: boolean;
};

export function canRetireFixedRenderers(
  checklist: FixedRendererRetirementChecklist,
): boolean {
  return Object.values(checklist).every(Boolean);
}

/**
 * Dual-read: serve migrated blocks only when verified at blocks-only version.
 * Otherwise keep fixed sectionContent renderers.
 */
export function shouldServeMigratedBlocks(input: {
  layoutVersion: number;
  migration?: LayoutMigrationMetadata | null;
}): boolean {
  if (input.layoutVersion < BLOCKS_ONLY_LAYOUT_VERSION) return false;
  return isMigrationVerifiedForRender(input.migration);
}
