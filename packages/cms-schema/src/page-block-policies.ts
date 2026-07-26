import type { BlockType, CmsPage } from "./types";

/**
 * Page-level layout policy for block instance limits.
 * Keep separate from global block capabilities (duplicable/removable/publishable).
 *
 * Vacatures ownership: exactly one jobs block after migration.
 * During migration, ensureVacaturesJobsBlock seeds the block (public listing
 * hidden by default); picker/add is blocked when one already exists.
 * Removable is false so admins cannot permanently remove it — vacancy data
 * still drives the application form and /vacatures/$slug.
 *
 * FALLBACK REMOVAL (legacy t.jobs.roles): default path no longer uses static roles.
 * Keep `allowLegacyVacancyFallback` / `warnLegacyVacancyFallback` only while older
 * environments may lack a published jobs block; remove when checklist in
 * docs/architecture/page-section-builder-gaps.md is complete.
 */
export type PageBlockTypePolicy = {
  minInstances: number;
  maxInstances: number;
  removable: boolean;
};

export const pageBlockPolicies: Record<
  string,
  Partial<Record<BlockType, PageBlockTypePolicy>>
> = {
  page_vacatures: {
    jobs: {
      minInstances: 1,
      maxInstances: 1,
      removable: false,
    },
  },
};

export function getPageBlockPolicy(
  pageId: string,
  blockType: BlockType,
): PageBlockTypePolicy | null {
  return pageBlockPolicies[pageId]?.[blockType] ?? null;
}

export function countBlocksOfType(page: CmsPage, blockType: BlockType): number {
  return page.blocks.filter((b) => b.type === blockType).length;
}

/** Whether the page may add another instance of this block type. */
export function canAddBlockType(page: CmsPage, blockType: BlockType): boolean {
  const policy = getPageBlockPolicy(page.id, blockType);
  if (!policy) return true;
  return countBlocksOfType(page, blockType) < policy.maxInstances;
}

/** Whether a specific block instance may be removed under page policy. */
export function canRemoveBlockType(page: CmsPage, blockType: BlockType): boolean {
  const policy = getPageBlockPolicy(page.id, blockType);
  if (!policy) return true;
  if (!policy.removable) return false;
  return countBlocksOfType(page, blockType) > policy.minInstances;
}

/** Block types that have hit their max instance count on this page. */
export function blockedBlockTypesForPage(page: CmsPage): BlockType[] {
  const policies = pageBlockPolicies[page.id];
  if (!policies) return [];
  const blocked: BlockType[] = [];
  for (const [type, policy] of Object.entries(policies)) {
    if (!policy) continue;
    if (countBlocksOfType(page, type as BlockType) >= policy.maxInstances) {
      blocked.push(type as BlockType);
    }
  }
  return blocked;
}
