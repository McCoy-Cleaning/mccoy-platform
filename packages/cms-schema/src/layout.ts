import type { Block } from "./types";
import {
  CURRENT_LAYOUT_VERSION,
  FIXED_SECTION_DEFS,
  FIXED_SECTIONS_BY_PAGE,
  fixedLayoutId,
  type BuiltinPageKey,
  type FixedSectionKey,
} from "./sections";
import {
  DEFAULT_CONTENT_ALIGN,
  type ContentAlign,
  parseContentAlign,
} from "./layout-presentation";

export type FixedLayoutItem = {
  id: `fixed:${string}`;
  kind: "fixed";
  key: FixedSectionKey;
  hidden: boolean;
  /** Horizontal placement of constrained content; omitted = center (legacy default). */
  contentAlign?: ContentAlign;
};

export type BlockLayoutItem = {
  id: string;
  kind: "block";
  blockId: string;
  /** When true, section is not shown on the public page (same as fixed.hidden). */
  hidden?: boolean;
  /** Horizontal placement of constrained content; omitted = center (legacy default). */
  contentAlign?: ContentAlign;
};

export type LayoutItem = FixedLayoutItem | BlockLayoutItem;

export function defaultFixedLayout(pageKey: BuiltinPageKey): FixedLayoutItem[] {
  return FIXED_SECTIONS_BY_PAGE[pageKey].map((key) => ({
    id: fixedLayoutId(key),
    kind: "fixed" as const,
    key,
    hidden: false,
  }));
}

/**
 * Keep a locked-first section at index 0 when its definition still requests it
 * and the section is present in the layout. No-op when unlocked or removed.
 */
export function ensureFirstLocked(layout: LayoutItem[], pageKey: BuiltinPageKey): LayoutItem[] {
  const firstKey = FIXED_SECTIONS_BY_PAGE[pageKey][0];
  if (!firstKey) return layout;
  const def = FIXED_SECTION_DEFS[firstKey];
  if (def.lockedPosition !== "first") return layout;

  const idx = layout.findIndex((i) => i.kind === "fixed" && i.key === firstKey);
  if (idx === 0) return layout;
  if (idx === -1) {
    // Intentionally absent from layout — do not re-insert.
    return layout;
  }
  const copy = layout.slice();
  const [item] = copy.splice(idx, 1);
  if (!item) return layout;
  return [item, ...copy];
}

/**
 * Keep locked-last fixed sections at the end (e.g. vacatures.application after jobs).
 */
export function ensureLastLocked(layout: LayoutItem[], pageKey: BuiltinPageKey): LayoutItem[] {
  const lastKeys = FIXED_SECTIONS_BY_PAGE[pageKey].filter(
    (key) => FIXED_SECTION_DEFS[key].lockedPosition === "last",
  );
  if (lastKeys.length === 0) return layout;

  const copy = layout.slice();
  const moved: LayoutItem[] = [];
  for (const key of lastKeys) {
    const idx = copy.findIndex((i) => i.kind === "fixed" && i.key === key);
    if (idx === -1) continue;
    const [item] = copy.splice(idx, 1);
    if (item) moved.push(item);
  }
  if (moved.length === 0) return layout;
  return [...copy, ...moved];
}

export function buildDefaultLayout(
  pageKey: BuiltinPageKey,
  blockItems: BlockLayoutItem[] = [],
): LayoutItem[] {
  return [...defaultFixedLayout(pageKey), ...blockItems];
}

export function newBlockLayoutItem(blockId: string, id?: string): BlockLayoutItem {
  return {
    id: id ?? `lay_${Math.random().toString(36).slice(2, 10)}`,
    kind: "block",
    blockId,
  };
}

export function newFixedLayoutItem(key: FixedSectionKey, hidden = false): FixedLayoutItem {
  return {
    id: fixedLayoutId(key),
    kind: "fixed",
    key,
    hidden,
  };
}

export function layoutFromBlocks(blocks: Block[]): BlockLayoutItem[] {
  return blocks.map((b) => newBlockLayoutItem(b.id));
}

export function layoutBlockIds(layout: LayoutItem[]): string[] {
  return layout.filter((i): i is BlockLayoutItem => i.kind === "block").map((i) => i.blockId);
}

export function orphanBlocks(blocks: Block[], layout: LayoutItem[]): Block[] {
  const used = new Set(layoutBlockIds(layout));
  return blocks.filter((b) => !used.has(b.id));
}

export function requiredFirstKey(pageKey: BuiltinPageKey): FixedSectionKey {
  return FIXED_SECTIONS_BY_PAGE[pageKey][0]!;
}

/** Index before which inserts are forbidden when a locked-first section is present. */
export function minInsertIndex(pageKey: BuiltinPageKey): number {
  const firstKey = FIXED_SECTIONS_BY_PAGE[pageKey][0];
  if (!firstKey) return 0;
  if (FIXED_SECTION_DEFS[firstKey].lockedPosition !== "first") return 0;
  return 1;
}

export function canMoveItem(item: LayoutItem): boolean {
  if (item.kind === "block") return true;
  return FIXED_SECTION_DEFS[item.key].movable;
}

export function canHideItem(item: LayoutItem): boolean {
  if (item.kind === "block") return true;
  return FIXED_SECTION_DEFS[item.key].hideable;
}

/** Fixed sections may be removed from layout when not marked required. */
export function canDeleteItem(item: LayoutItem): boolean {
  if (item.kind === "block") return true;
  return !FIXED_SECTION_DEFS[item.key].required;
}

export function isLayoutItemHidden(item: LayoutItem): boolean {
  if (item.kind === "fixed") return item.hidden;
  return Boolean(item.hidden);
}

export function withContentAlign(item: LayoutItem, align: ContentAlign | undefined): LayoutItem {
  if (align === undefined || align === DEFAULT_CONTENT_ALIGN) {
    const { contentAlign: _drop, ...rest } = item;
    void _drop;
    return rest as LayoutItem;
  }
  return { ...item, contentAlign: align };
}

export function readContentAlign(item: LayoutItem): ContentAlign | undefined {
  return parseContentAlign(item.contentAlign);
}

/** Fixed keys defined for a page but currently absent from the layout (can be restored). */
export function missingFixedSectionKeys(
  pageKey: BuiltinPageKey,
  layout: LayoutItem[],
): FixedSectionKey[] {
  const present = new Set(
    layout.filter((i): i is Extract<LayoutItem, { kind: "fixed" }> => i.kind === "fixed").map((i) => i.key),
  );
  return FIXED_SECTIONS_BY_PAGE[pageKey].filter((key) => !present.has(key));
}

export { CURRENT_LAYOUT_VERSION };
export type { ContentAlign };
