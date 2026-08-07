import {
  canDeleteItem,
  canHideItem,
  canMoveItem,
  layoutBlockIds,
  minInsertIndex,
  missingFixedSectionKeys,
  newBlockLayoutItem,
  newFixedLayoutItem,
  withContentAlign,
  type LayoutItem,
} from "./layout";
import {
  layoutItemSupportsContentAlign,
  normalizeContentAlign,
  type ContentAlign,
} from "./layout-presentation";
import { canAddBlockType, canRemoveBlockType, policyFixedEquivalentForBlock } from "./page-block-policies";
import { getBlockDataDefinition } from "./blocks/registry";
import type { ContactFormContent } from "./content";
import { FIXED_SECTION_DEFS, FIXED_SECTIONS_BY_PAGE, type BuiltinPageKey, type FixedSectionKey } from "./sections";
import type { Block, BuiltinCmsPage, CmsPage, CustomCmsPage } from "./types";

export type LayoutOperationCode =
  | "INVALID_INDEX"
  | "LOCKED_POSITION"
  | "DUPLICATE_BLOCK"
  | "DUPLICATE_SECTION"
  | "POLICY_BLOCKED"
  | "UNKNOWN_SECTION"
  | "NOT_MOVABLE"
  | "NOT_HIDEABLE"
  | "NOT_REMOVABLE"
  | "NOT_ALIGNABLE"
  | "MISSING_BLOCK"
  | "NO_OP";

export type LayoutOperationResult =
  | { ok: true; page: CmsPage }
  | { ok: false; code: LayoutOperationCode };

function clonePage<T extends CmsPage>(page: T): T {
  return structuredClone(page);
}

function findIndex(layout: LayoutItem[], itemId: string): number {
  return layout.findIndex((i) => i.id === itemId);
}

/**
 * When adding a policy form block on a page that still has the hybrid fixed
 * section, drop the fixed slot and seed block data from sectionContent so the
 * catalog item becomes the live form (max-1 preserved).
 */
function replacePolicyFixedWithBlock(page: CmsPage, block: Block): void {
  const fixedKey = policyFixedEquivalentForBlock(page.id, block.type);
  if (!fixedKey) return;
  if (!page.layout.some((item) => item.kind === "fixed" && item.key === fixedKey)) return;

  page.layout = page.layout.filter(
    (item) => !(item.kind === "fixed" && item.key === fixedKey),
  );

  if (page.kind !== "builtin" || fixedKey !== "contact.form" || block.type !== "contactForm") {
    return;
  }
  const builtin = page as BuiltinCmsPage;
  const content = builtin.sectionContent?.["contact.form"] as ContactFormContent | undefined;
  if (!content) return;

  const def = getBlockDataDefinition("contactForm");
  const seeded = def.normalize({
    ...block.data,
    title: content.heading ?? (typeof block.data.title === "string" ? block.data.title : "Contact"),
    eyebrow: content.eyebrow,
    body: content.body,
    highlights: content.highlights,
    textPlacement: content.textPlacement ?? "left",
    formColumnsDesktop: content.formColumnsDesktop ?? 2,
    submitLabel: content.submitLabel,
    successMessage: content.successMessage,
    successDetail: content.successDetail,
    consent: content.consent,
    labels: content.labels,
    placeholders: content.placeholders,
    scope: content.scope,
    fields: content.fields ?? block.data.fields,
  });
  block.data = seeded as Block["data"];
  block.dataVersion = def.dataVersion;
}

function wouldViolateFirstLock(
  layout: LayoutItem[],
  pageKey: BuiltinPageKey,
  from: number,
  to: number,
): boolean {
  const firstKey = FIXED_SECTIONS_BY_PAGE[pageKey][0];
  if (!firstKey) return false;
  const def = FIXED_SECTION_DEFS[firstKey];
  if (def.lockedPosition !== "first") return false;

  const lockedIdx = layout.findIndex((i) => i.kind === "fixed" && i.key === firstKey);
  if (lockedIdx < 0) return false;

  // Moving the locked item away from 0
  if (from === lockedIdx && to !== 0) return true;
  // Moving something into index 0 while locked item exists elsewhere
  if (to === 0 && from !== lockedIdx) return true;
  return false;
}

export function moveLayoutItem(
  page: CmsPage,
  itemId: string,
  direction: "up" | "down",
): LayoutOperationResult {
  const next = clonePage(page);
  const layout = next.layout;
  const idx = findIndex(layout, itemId);
  if (idx < 0) return { ok: false, code: "UNKNOWN_SECTION" };

  const item = layout[idx]!;
  if (!canMoveItem(item)) return { ok: false, code: "NOT_MOVABLE" };

  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= layout.length) return { ok: false, code: "NO_OP" };

  if (next.kind === "builtin" && next.pageKey) {
    if (wouldViolateFirstLock(layout, next.pageKey, idx, target)) {
      return { ok: false, code: "LOCKED_POSITION" };
    }
  }

  const arr = layout.slice();
  [arr[idx], arr[target]] = [arr[target]!, arr[idx]!];
  next.layout = arr;
  return { ok: true, page: next };
}

export function addLayoutBlock(
  page: CmsPage,
  block: Block,
  atIndex: number,
): LayoutOperationResult {
  const next = clonePage(page);

  if (layoutBlockIds(next.layout).includes(block.id)) {
    return { ok: false, code: "DUPLICATE_BLOCK" };
  }
  if (next.blocks.some((b) => b.id === block.id)) {
    return { ok: false, code: "DUPLICATE_BLOCK" };
  }

  if (!canAddBlockType(next, block.type)) {
    return { ok: false, code: "POLICY_BLOCKED" };
  }

  const fixedKey = policyFixedEquivalentForBlock(next.id, block.type);
  const fixedIdx =
    fixedKey == null
      ? -1
      : next.layout.findIndex((item) => item.kind === "fixed" && item.key === fixedKey);

  replacePolicyFixedWithBlock(next, block);

  // After dropping a policy-equivalent fixed slot, remap the insert index so
  // append (layout.length) and positions after the removed slot stay valid.
  let insertAt = atIndex;
  if (fixedIdx >= 0) {
    if (insertAt > fixedIdx) insertAt -= 1;
    // Prefer the vacated fixed slot when the caller asked to append.
    if (atIndex >= page.layout.length) insertAt = fixedIdx;
  }

  const min = next.kind === "builtin" && next.pageKey ? minInsertIndex(next.pageKey) : 0;
  if (insertAt < min) return { ok: false, code: "LOCKED_POSITION" };
  if (insertAt < 0 || insertAt > next.layout.length) {
    return { ok: false, code: "INVALID_INDEX" };
  }

  const layoutItem = newBlockLayoutItem(block.id);
  const layout = next.layout.slice();
  layout.splice(insertAt, 0, layoutItem);
  next.layout = layout;
  next.blocks = [...next.blocks, structuredClone(block)];
  return { ok: true, page: next };
}

export function toggleFixedSection(page: CmsPage, fixedKey: FixedSectionKey): LayoutOperationResult {
  if (page.kind !== "builtin") return { ok: false, code: "UNKNOWN_SECTION" };
  const next = clonePage(page) as BuiltinCmsPage;
  const def = FIXED_SECTION_DEFS[fixedKey];
  if (!def) return { ok: false, code: "UNKNOWN_SECTION" };
  if (!def.hideable) return { ok: false, code: "NOT_HIDEABLE" };

  const idx = next.layout.findIndex((i) => i.kind === "fixed" && i.key === fixedKey);
  if (idx < 0) return { ok: false, code: "UNKNOWN_SECTION" };
  const item = next.layout[idx]!;
  if (item.kind !== "fixed") return { ok: false, code: "UNKNOWN_SECTION" };
  if (!canHideItem(item)) return { ok: false, code: "NOT_HIDEABLE" };

  const layout = next.layout.slice();
  layout[idx] = { ...item, hidden: !item.hidden };
  next.layout = layout;
  return { ok: true, page: next };
}

/** Toggle visibility for a fixed section or a CMS block by layout item id. */
export function toggleLayoutItemHidden(page: CmsPage, layoutItemId: string): LayoutOperationResult {
  const next = clonePage(page);
  const idx = next.layout.findIndex((i) => i.id === layoutItemId);
  if (idx < 0) return { ok: false, code: "UNKNOWN_SECTION" };
  const item = next.layout[idx]!;
  if (!canHideItem(item)) return { ok: false, code: "NOT_HIDEABLE" };

  const layout = next.layout.slice();
  if (item.kind === "fixed") {
    layout[idx] = { ...item, hidden: !item.hidden };
  } else {
    layout[idx] = { ...item, hidden: !item.hidden };
  }
  next.layout = layout;
  return { ok: true, page: next };
}

export function removeLayoutBlock(page: CmsPage, blockId: string): LayoutOperationResult {
  const next = clonePage(page);
  const layoutIdx = next.layout.findIndex((i) => i.kind === "block" && i.blockId === blockId);
  if (layoutIdx < 0 && !next.blocks.some((b) => b.id === blockId)) {
    return { ok: false, code: "MISSING_BLOCK" };
  }

  const block = next.blocks.find((b) => b.id === blockId);
  if (block && !canRemoveBlockType(next, block.type)) {
    return { ok: false, code: "POLICY_BLOCKED" };
  }

  next.layout = next.layout.filter((i) => !(i.kind === "block" && i.blockId === blockId));
  next.blocks = next.blocks.filter((b) => b.id !== blockId);
  return { ok: true, page: next };
}

/**
 * Remove a fixed section from the layout. Section content is preserved in
 * `sectionContent` so the section can be restored later from the catalog.
 */
export function removeFixedLayoutItem(
  page: CmsPage,
  fixedKey: FixedSectionKey,
): LayoutOperationResult {
  if (page.kind !== "builtin") return { ok: false, code: "UNKNOWN_SECTION" };
  const next = clonePage(page) as BuiltinCmsPage;
  const def = FIXED_SECTION_DEFS[fixedKey];
  if (!def) return { ok: false, code: "UNKNOWN_SECTION" };
  if (def.required) return { ok: false, code: "NOT_REMOVABLE" };

  const idx = next.layout.findIndex((i) => i.kind === "fixed" && i.key === fixedKey);
  if (idx < 0) return { ok: false, code: "UNKNOWN_SECTION" };
  const item = next.layout[idx]!;
  if (!canDeleteItem(item)) return { ok: false, code: "NOT_REMOVABLE" };

  next.layout = next.layout.filter((i) => !(i.kind === "fixed" && i.key === fixedKey));
  return { ok: true, page: next };
}

/** Restore a page-catalog fixed section that was removed from the layout. */
export function addFixedLayoutItem(
  page: CmsPage,
  fixedKey: FixedSectionKey,
  atIndex?: number,
): LayoutOperationResult {
  if (page.kind !== "builtin" || !page.pageKey) return { ok: false, code: "UNKNOWN_SECTION" };
  const next = clonePage(page) as BuiltinCmsPage;
  const pageKey = next.pageKey;
  if (!pageKey) return { ok: false, code: "UNKNOWN_SECTION" };
  if (!FIXED_SECTIONS_BY_PAGE[pageKey].includes(fixedKey)) {
    return { ok: false, code: "UNKNOWN_SECTION" };
  }
  if (next.layout.some((i) => i.kind === "fixed" && i.key === fixedKey)) {
    return { ok: false, code: "DUPLICATE_SECTION" };
  }
  if (!missingFixedSectionKeys(pageKey, next.layout).includes(fixedKey)) {
    return { ok: false, code: "UNKNOWN_SECTION" };
  }

  const item = newFixedLayoutItem(fixedKey);
  const layout = next.layout.slice();
  const min = minInsertIndex(pageKey);
  const insertAt =
    typeof atIndex === "number" ? Math.min(Math.max(atIndex, min), layout.length) : layout.length;
  if (insertAt < min) return { ok: false, code: "LOCKED_POSITION" };
  layout.splice(insertAt, 0, item);
  next.layout = layout;
  return { ok: true, page: next };
}

export function setLayoutItemContentAlign(
  page: CmsPage,
  layoutItemId: string,
  align: ContentAlign,
): LayoutOperationResult {
  const next = clonePage(page);
  const idx = next.layout.findIndex((i) => i.id === layoutItemId);
  if (idx < 0) return { ok: false, code: "UNKNOWN_SECTION" };
  const item = next.layout[idx]!;

  let blockType: Block["type"] | null = null;
  if (item.kind === "block") {
    blockType = next.blocks.find((b) => b.id === item.blockId)?.type ?? null;
  }
  if (!layoutItemSupportsContentAlign(item, blockType)) {
    return { ok: false, code: "NOT_ALIGNABLE" };
  }

  const normalized = normalizeContentAlign(align);
  const layout = next.layout.slice();
  layout[idx] = withContentAlign(item, normalized);
  next.layout = layout;
  return { ok: true, page: next };
}

/**
 * Duplicate a layout block with a new block id and regenerated nested item ids.
 * Relies on each block definition's normalize + createDefault patterns; jobs
 * regenerates vacancy ids explicitly via cloneJobsDataWithNewIds when type is jobs.
 */
export function duplicateLayoutBlock(
  page: CmsPage,
  blockId: string,
  regenerateData: (block: Block) => Block,
): LayoutOperationResult {
  const next = clonePage(page);
  const layoutIdx = next.layout.findIndex((i) => i.kind === "block" && i.blockId === blockId);
  const blockIdx = next.blocks.findIndex((b) => b.id === blockId);
  if (layoutIdx < 0 || blockIdx < 0) return { ok: false, code: "MISSING_BLOCK" };

  const source = next.blocks[blockIdx]!;
  if (!canAddBlockType(next, source.type)) {
    return { ok: false, code: "POLICY_BLOCKED" };
  }
  const cloned = regenerateData(structuredClone(source));
  if (layoutBlockIds(next.layout).includes(cloned.id) || next.blocks.some((b) => b.id === cloned.id)) {
    return { ok: false, code: "DUPLICATE_BLOCK" };
  }

  const layoutItem = newBlockLayoutItem(cloned.id);
  const layout = next.layout.slice();
  layout.splice(layoutIdx + 1, 0, layoutItem);
  next.layout = layout;
  next.blocks = [...next.blocks, cloned];
  return { ok: true, page: next };
}

export function updateLayoutBlockData(
  page: CmsPage,
  blockId: string,
  patch: Record<string, unknown>,
): LayoutOperationResult {
  const next = clonePage(page);
  const idx = next.blocks.findIndex((b) => b.id === blockId);
  if (idx < 0) return { ok: false, code: "MISSING_BLOCK" };
  const block = next.blocks[idx]!;
  const { dataVersion, ...dataPatch } = patch;
  next.blocks = next.blocks.slice();
  next.blocks[idx] = {
    ...block,
    data: { ...block.data, ...dataPatch },
    ...(typeof dataVersion === "number" ? { dataVersion } : {}),
  };
  return { ok: true, page: next };
}

/** Custom-page helper: rebuild layout from ordered blocks after classic block reorder. */
export function syncCustomLayoutFromBlocks(page: CustomCmsPage): CustomCmsPage {
  const next = clonePage(page);
  next.layout = next.blocks.map((b) => newBlockLayoutItem(b.id));
  return next;
}
