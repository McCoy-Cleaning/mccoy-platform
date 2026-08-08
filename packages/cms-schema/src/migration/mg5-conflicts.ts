import type { BuiltinCmsPage, Block } from "../types";
import {
  FIXED_SECTIONS_BY_PAGE,
  isFixedSectionKey,
  type BuiltinPageKey,
  type FixedSectionKey,
} from "../sections";
import { createMigrationBlockId } from "./block-id";
import { FIXED_SECTION_MIGRATION_ROLES } from "./roles";
import { checksumOf } from "./checksum";
import { mapFixedSectionToBlockData } from "./apply";
import type { FixedBlockConflict } from "./mg5-contract";

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function contentFingerprint(data: unknown): string {
  return checksumOf(data ?? {});
}

/**
 * Classify dual representation between a fixed section and its deterministic target block.
 * Never silently discard either side on conflict/ambiguous.
 */
export function classifyFixedBlockConflict(
  page: BuiltinCmsPage,
  fixedKey: FixedSectionKey,
  role: string,
): {
  conflict: FixedBlockConflict;
  blockId: string;
  detail: string;
  existingBlock?: Block;
} {
  const blockId = createMigrationBlockId({
    pageId: page.id,
    fixedKey,
    role,
  });
  const existing = page.blocks.find((b) => b.id === blockId);
  const hasFixed = page.layout.some((i) => i.kind === "fixed" && i.key === fixedKey);
  const sectionContent = isRecord(page.sectionContent)
    ? (page.sectionContent as Record<string, unknown>)[fixedKey]
    : undefined;

  if (!existing && !hasFixed) {
    return {
      conflict: "none",
      blockId,
      detail: "Neither fixed layout item nor deterministic block present.",
    };
  }
  if (!existing && hasFixed) {
    return {
      conflict: "none",
      blockId,
      detail: "Fixed source present; target block absent — eligible to create.",
    };
  }
  if (existing && !hasFixed) {
    return {
      conflict: "target_already_exists",
      blockId,
      detail: "Deterministic target block exists; fixed layout item absent.",
      existingBlock: existing,
    };
  }

  const expectedType = FIXED_SECTION_MIGRATION_ROLES[fixedKey].find((r) => r.role === role)
    ?.blockType;
  if (expectedType && existing!.type !== expectedType) {
    return {
      conflict: "content_conflict",
      blockId,
      detail: `Block ${blockId} type ${existing!.type} != expected ${expectedType}.`,
      existingBlock: existing,
    };
  }

  const mapped = mapFixedSectionToBlockData(fixedKey, role, sectionContent);
  const mappedFp = contentFingerprint(mapped);
  const existingFp = contentFingerprint(existing!.data);
  if (mappedFp === existingFp) {
    return {
      conflict: "equivalent",
      blockId,
      detail: "Fixed source and target block content fingerprints match.",
      existingBlock: existing,
    };
  }

  return {
    conflict: "ambiguous",
    blockId,
    detail:
      "Fixed source and deterministic block both present with divergent content fingerprints.",
    existingBlock: existing,
  };
}

function pageFixedKeys(pageKey: BuiltinPageKey | null | undefined): FixedSectionKey[] {
  if (!pageKey) return [];
  return [...FIXED_SECTIONS_BY_PAGE[pageKey]];
}

export function classifyPageFixedBlockConflicts(page: BuiltinCmsPage): Array<{
  fixedKey: string;
  blockId: string;
  conflict: FixedBlockConflict;
  detail: string;
}> {
  const out: Array<{
    fixedKey: string;
    blockId: string;
    conflict: FixedBlockConflict;
    detail: string;
  }> = [];

  for (const key of pageFixedKeys(page.pageKey)) {
    for (const spec of FIXED_SECTION_MIGRATION_ROLES[key]) {
      const hasFixed = page.layout.some((i) => i.kind === "fixed" && i.key === key);
      const blockId = createMigrationBlockId({
        pageId: page.id,
        fixedKey: key,
        role: spec.role,
      });
      const hasBlock = page.blocks.some((b) => b.id === blockId);
      if (!hasFixed && !hasBlock) continue;

      const result = classifyFixedBlockConflict(page, key, spec.role);
      if (result.conflict !== "none") {
        out.push({
          fixedKey: key,
          blockId: result.blockId,
          conflict: result.conflict,
          detail: result.detail,
        });
      }
    }
  }
  return out;
}

export function conflictsBlockApply(
  conflicts: Array<{ conflict: FixedBlockConflict }>,
): boolean {
  return conflicts.some(
    (c) => c.conflict === "content_conflict" || c.conflict === "ambiguous",
  );
}

export function isFixedSectionKeySafe(value: string): value is FixedSectionKey {
  return isFixedSectionKey(value);
}
