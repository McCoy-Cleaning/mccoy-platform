/**
 * Composite fixed sections (about/services/products) are one layout item on the
 * page but multiple visual/editor parts. The editor expands them into per-part
 * rows so admins can edit text/images without treating the whole page as one blob.
 */

import type { FixedSectionKey } from "./sections";
import { FIXED_SECTION_DEFS } from "./sections";
import type { LayoutItem } from "./layout";
import { canDeleteItem, canHideItem, canMoveItem, isLayoutItemHidden } from "./layout";

export type CompositeSectionPartId = string;

export type CompositeSectionPartDef = {
  id: CompositeSectionPartId;
  label: string;
  /** Fields within the parent sectionContent document this part edits. */
  fields: readonly string[];
};

/** Fixed sections that render as multiple visual blocks on the live site. */
export const COMPOSITE_SECTION_PARTS: Partial<
  Record<FixedSectionKey, readonly CompositeSectionPartDef[]>
> = {
  "about.main": [
    { id: "header", label: "Kop", fields: ["eyebrow", "heading"] },
    {
      id: "mission",
      label: "Missie",
      fields: ["missionTitle", "missionBody", "missionImage", "image"],
    },
    {
      id: "vision",
      label: "Visie",
      fields: ["visionTitle", "visionBody", "visionImage"],
    },
    {
      id: "history",
      label: "Historie",
      fields: ["historyTitle", "historyBody", "historyImage"],
    },
  ],
  "services.main": [
    { id: "header", label: "Intro", fields: ["eyebrow", "heading", "intro"] },
    { id: "cards", label: "Dienstkaarten", fields: ["cards"] },
  ],
  // products.main + products.info are separate movable fixed sections (not composite).
};

export function isCompositeSectionKey(key: FixedSectionKey): boolean {
  return Boolean(COMPOSITE_SECTION_PARTS[key]?.length);
}

export function compositePartsFor(key: FixedSectionKey): readonly CompositeSectionPartDef[] {
  return COMPOSITE_SECTION_PARTS[key] ?? [];
}

export function compositePartDef(
  key: FixedSectionKey,
  partId: string,
): CompositeSectionPartDef | null {
  return compositePartsFor(key).find((p) => p.id === partId) ?? null;
}

/** Stable editor row id for a composite part (not a layout id). */
export function compositeEditorRowId(layoutItemId: string, partId: string): string {
  return `${layoutItemId}#${partId}`;
}

export function parseCompositeEditorRowId(
  rowId: string,
): { layoutItemId: string; partId: string } | null {
  const idx = rowId.lastIndexOf("#");
  if (idx <= 0) return null;
  return {
    layoutItemId: rowId.slice(0, idx),
    partId: rowId.slice(idx + 1),
  };
}

export type EditorLayoutRow = {
  id: string;
  label: string;
  kindLabel: string;
  hidden?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canHide: boolean;
  canDelete: boolean;
  canEdit?: boolean;
  /** Present when this row is a composite part of a fixed section. */
  composite?: {
    sectionKey: FixedSectionKey;
    partId: string;
    layoutItemId: string;
  };
  /** Layout item this row maps to (for move/hide/delete). */
  layoutItemId: string;
};

/**
 * Expand page.layout into editor rows — composite fixed sections become
 * one row per visual part; CMS blocks stay one row each.
 */
export function buildEditorLayoutRows(
  layout: LayoutItem[],
  opts: {
    blockLabel: (blockId: string) => string;
    minMovableIndex?: number;
  },
): EditorLayoutRow[] {
  const minMovableIndex = opts.minMovableIndex ?? 0;
  const rows: EditorLayoutRow[] = [];

  layout.forEach((item, index) => {
    if (item.kind === "fixed") {
      const parts = compositePartsFor(item.key);
      if (parts.length > 0) {
        for (const part of parts) {
          rows.push({
            id: compositeEditorRowId(item.id, part.id),
            label: part.label,
            kindLabel: "Vast",
            hidden: isLayoutItemHidden(item),
            // Move/hide operate on the parent layout item — only first part exposes controls.
            canMoveUp: false,
            canMoveDown: false,
            canHide: false,
            canDelete: false,
            canEdit: true,
            composite: {
              sectionKey: item.key,
              partId: part.id,
              layoutItemId: item.id,
            },
            layoutItemId: item.id,
          });
        }
        // Attach move/hide/delete to the first part row so the parent section remains controllable.
        const first = rows[rows.length - parts.length];
        if (first) {
          const movable = canMoveItem(item);
          first.canMoveUp = movable && index > minMovableIndex;
          first.canMoveDown = movable && index < layout.length - 1;
          first.canHide = canHideItem(item);
          first.canDelete = canDeleteItem(item);
          first.label = `${FIXED_SECTION_DEFS[item.key]?.label ?? item.key} · ${parts[0]!.label}`;
        }
        return;
      }

      const def = FIXED_SECTION_DEFS[item.key];
      const movable = canMoveItem(item);
      rows.push({
        id: item.id,
        label: def?.label ?? item.key,
        kindLabel: "Vast",
        hidden: isLayoutItemHidden(item),
        canMoveUp: movable && index > minMovableIndex,
        canMoveDown: movable && index < layout.length - 1,
        canHide: canHideItem(item),
        canDelete: canDeleteItem(item),
        canEdit: true,
        layoutItemId: item.id,
      });
      return;
    }

    rows.push({
      id: item.id,
      label: opts.blockLabel(item.blockId),
      kindLabel: "Sectie",
      hidden: isLayoutItemHidden(item),
      canMoveUp: index > minMovableIndex,
      canMoveDown: index < layout.length - 1,
      canHide: true,
      canDelete: true,
      canEdit: true,
      layoutItemId: item.id,
    });
  });

  return rows;
}

/** Count of editor-visible sections (composite parts counted individually). */
export function countEditorSections(layout: LayoutItem[]): number {
  let n = 0;
  for (const item of layout) {
    if (item.kind === "fixed") {
      const parts = compositePartsFor(item.key);
      n += parts.length > 0 ? parts.length : 1;
    } else {
      n += 1;
    }
  }
  return n;
}
