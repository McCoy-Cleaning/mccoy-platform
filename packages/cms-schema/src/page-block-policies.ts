import type { FixedSectionKey } from "./sections";
import type { BlockType, CmsPage } from "./types";

/**
 * Page-level layout policy for block instance limits.
 * Keep separate from global block capabilities (duplicable/removable/publishable).
 *
 * Editor may temporarily create an invalid local composition;
 * publication must fail with an exact block-policy error.
 */
export type PageBlockTypePolicy = {
  minInstances: number;
  maxInstances: number;
  removable: boolean;
  /** When false, block type cannot be added via picker on this page. */
  duplicable?: boolean;
};

export const pageBlockPolicies: Record<
  string,
  Partial<Record<BlockType, PageBlockTypePolicy>>
> = {
  // home.workGallery remains a required *fixed* section until verified migration (Gate 5+).
  // After migration, re-enable gallery minInstances: 1 here.
  page_contact: {
    contactForm: {
      minInstances: 1,
      maxInstances: 1,
      removable: false,
      duplicable: false,
    },
  },
  page_offerte: {
    quoteRequestForm: {
      minInstances: 1,
      maxInstances: 1,
      removable: false,
      duplicable: false,
    },
  },
  page_vacatures: {
    jobs: {
      minInstances: 1,
      maxInstances: 1,
      removable: false,
      duplicable: false,
    },
  },
};

/**
 * Hybrid layouts still ship required forms as fixed sections while page policies
 * name the post-migration block types. Credit the fixed key toward instance limits
 * so normalize/publish does not false-fail before Gate 5 blocks-only migration.
 *
 * Catalog add of the block type replaces the fixed equivalent (see layout-ops);
 * fixed alone must not block the picker.
 */
const POLICY_FIXED_EQUIVALENTS: Record<
  string,
  Partial<Record<BlockType, FixedSectionKey>>
> = {
  page_home: { hero: "home.hero" },
  page_contact: { contactForm: "contact.form" },
  page_offerte: { quoteRequestForm: "offerte.form" },
};

/** Privileged form blocks disallowed outside their builtin page. */
const PRIVILEGED_FORM_BLOCKS: Partial<
  Record<BlockType, { allowedPageIds: readonly string[] }>
> = {
  quoteRequestForm: { allowedPageIds: ["page_offerte"] },
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

export function policyFixedEquivalentForBlock(
  pageId: string,
  blockType: BlockType,
): FixedSectionKey | null {
  return POLICY_FIXED_EQUIVALENTS[pageId]?.[blockType] ?? null;
}

export function blockTypeSatisfyingFixedKey(
  pageId: string,
  fixedKey: FixedSectionKey,
): BlockType | null {
  const map = POLICY_FIXED_EQUIVALENTS[pageId];
  if (!map) return null;
  for (const [bt, key] of Object.entries(map)) {
    if (key === fixedKey) return bt as BlockType;
  }
  return null;
}

/** True when a policy-equivalent CMS block already covers a required fixed form slot. */
export function isRequiredFixedSatisfiedByBlock(
  page: CmsPage,
  fixedKey: FixedSectionKey,
): boolean {
  const blockType = blockTypeSatisfyingFixedKey(page.id, fixedKey);
  if (!blockType) return false;
  return countBlocksOfType(page, blockType) > 0;
}

function hasPolicyFixedEquivalent(page: CmsPage, blockType: BlockType): boolean {
  const fixedKey = POLICY_FIXED_EQUIVALENTS[page.id]?.[blockType];
  if (!fixedKey) return false;
  return page.layout.some((item) => item.kind === "fixed" && item.key === fixedKey);
}

/**
 * Block instances plus at most one matching required fixed section (hybrid era).
 * Used for page policy min/max publish checks.
 */
export function countPolicyInstances(page: CmsPage, blockType: BlockType): number {
  return countBlocksOfType(page, blockType) + (hasPolicyFixedEquivalent(page, blockType) ? 1 : 0);
}

/**
 * Whether the page may add another instance of this block type.
 * Counts real blocks only — a fixed equivalent does not block catalog add
 * (adding replaces the fixed slot via layout-ops).
 */
export function canAddBlockType(page: CmsPage, blockType: BlockType): boolean {
  const privileged = PRIVILEGED_FORM_BLOCKS[blockType];
  if (privileged && !privileged.allowedPageIds.includes(page.id)) {
    return false;
  }
  const policy = getPageBlockPolicy(page.id, blockType);
  if (!policy) return true;
  const blockCount = countBlocksOfType(page, blockType);
  if (policy.duplicable === false && blockCount >= 1) {
    return false;
  }
  return blockCount < policy.maxInstances;
}

/** Whether a specific block instance may be removed under page policy. */
export function canRemoveBlockType(page: CmsPage, blockType: BlockType): boolean {
  const policy = getPageBlockPolicy(page.id, blockType);
  if (!policy) return true;
  if (!policy.removable) return false;
  return countPolicyInstances(page, blockType) > policy.minInstances;
}

/** Block types that have hit their max instance count on this page. */
export function blockedBlockTypesForPage(page: CmsPage): BlockType[] {
  const policies = pageBlockPolicies[page.id];
  const blocked: BlockType[] = [];
  if (policies) {
    for (const [type, policy] of Object.entries(policies)) {
      if (!policy) continue;
      if (!canAddBlockType(page, type as BlockType)) {
        blocked.push(type as BlockType);
      }
    }
  }
  for (const [type, rule] of Object.entries(PRIVILEGED_FORM_BLOCKS)) {
    if (!rule) continue;
    if (!rule.allowedPageIds.includes(page.id)) {
      blocked.push(type as BlockType);
    }
  }
  return [...new Set(blocked)];
}

export type PageBlockPolicyIssue = {
  code: "BLOCK_POLICY_MIN" | "BLOCK_POLICY_MAX" | "BLOCK_POLICY_PAGE";
  message: string;
  blockType: BlockType;
};

/** Fail-closed publish checks for page block policies. */
export function validatePageBlockPolicies(page: CmsPage): PageBlockPolicyIssue[] {
  const issues: PageBlockPolicyIssue[] = [];
  const policies = pageBlockPolicies[page.id];

  if (policies) {
    for (const [type, policy] of Object.entries(policies)) {
      if (!policy) continue;
      const blockType = type as BlockType;
      const count = countPolicyInstances(page, blockType);
      if (count < policy.minInstances) {
        issues.push({
          code: "BLOCK_POLICY_MIN",
          blockType,
          message: `Pagina vereist minstens ${policy.minInstances}× ${blockType} (nu ${count}).`,
        });
      }
      if (count > policy.maxInstances) {
        issues.push({
          code: "BLOCK_POLICY_MAX",
          blockType,
          message: `Pagina staat maximaal ${policy.maxInstances}× ${blockType} toe (nu ${count}).`,
        });
      }
    }
  }
  for (const [type, rule] of Object.entries(PRIVILEGED_FORM_BLOCKS)) {
    if (!rule) continue;
    const blockType = type as BlockType;
    const count = countBlocksOfType(page, blockType);
    if (count > 0 && !rule.allowedPageIds.includes(page.id)) {
      issues.push({
        code: "BLOCK_POLICY_PAGE",
        blockType,
        message: `${blockType} is niet toegestaan op deze pagina.`,
      });
    }
  }
  return issues;
}
