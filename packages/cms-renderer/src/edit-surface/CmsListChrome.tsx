/**
 * Shared on-canvas add/remove chrome for block repeater lists
 * (Content / Media / Structure category sections).
 */
import * as React from "react";
import { useCmsBlockEditScope, useCmsEditSurface } from "./CmsEditSurface";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type CmsListEditorApi<T> = {
  editing: boolean;
  patchList: (next: T[]) => void;
  removeById: (items: T[], id: string) => void;
  removeAt: (items: T[], index: number) => void;
  append: (items: T[], item: T) => void;
};

/**
 * Hook for list mutations when the edit surface is active.
 * Without surface / sendBlockPatch → editing stays false and patches no-op.
 */
export function useCmsListEditor(field: string): CmsListEditorApi<Record<string, unknown>> {
  const surface = useCmsEditSurface();
  const scope = useCmsBlockEditScope();
  const editing = Boolean(surface?.enabled && scope && surface.sendBlockPatch);

  const patchList = React.useCallback(
    (next: unknown[]) => {
      if (!scope || !surface?.sendBlockPatch) return;
      surface.sendBlockPatch(scope.blockId, { [field]: next });
    },
    [field, scope, surface],
  );

  return React.useMemo(
    () => ({
      editing,
      patchList: patchList as (next: Record<string, unknown>[]) => void,
      removeById: (items, id) => {
        patchList(items.filter((entry) => (entry as { id?: string }).id !== id));
      },
      removeAt: (items, index) => {
        if (index < 0 || index >= items.length) return;
        patchList(items.filter((_, i) => i !== index));
      },
      append: (items, item) => {
        patchList([...items, item]);
      },
    }),
    [editing, patchList],
  );
}

/** Typed wrapper — same behavior, clearer call sites. */
export function useCmsTypedListEditor<T extends { id: string }>(field: string): {
  editing: boolean;
  patchList: (next: T[]) => void;
  removeById: (items: T[], id: string) => void;
  removeAt: (items: T[], index: number) => void;
  append: (items: T[], item: T) => void;
} {
  const api = useCmsListEditor(field);
  return api as unknown as {
    editing: boolean;
    patchList: (next: T[]) => void;
    removeById: (items: T[], id: string) => void;
    removeAt: (items: T[], index: number) => void;
    append: (items: T[], item: T) => void;
  };
}

export function CmsListRemoveButton({
  label,
  onRemove,
  className,
}: {
  label: string;
  onRemove: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      data-cms-editor-chrome
      data-cms-inline-edit=""
      data-cms-list-remove=""
      aria-label={label}
      className={cn(
        "absolute right-2 top-2 z-20 rounded-full border border-red-400/30 bg-black/75 px-2.5 py-1 text-[11px] font-semibold text-red-200 shadow-lg hover:bg-red-500/25 hover:text-red-100",
        className,
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onRemove();
      }}
    >
      Verwijderen
    </button>
  );
}

export function CmsListAddButton({
  label,
  onAdd,
  className,
  compact,
}: {
  label: string;
  onAdd: () => void;
  className?: string;
  /** Smaller inline add control (e.g. under a sub-list). */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      data-cms-editor-chrome
      data-cms-list-add=""
      className={cn(
        compact
          ? "mt-2 inline-flex items-center justify-center rounded-lg border border-dashed border-sky-400/40 bg-sky-500/5 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:border-sky-400/70 hover:bg-sky-500/10"
          : "flex min-h-[8rem] w-full flex-col items-center justify-center gap-2 rounded-[1.35rem] border border-dashed border-sky-400/40 bg-sky-500/5 text-sm font-semibold text-sky-200 hover:border-sky-400/70 hover:bg-sky-500/10",
        className,
      )}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onAdd();
      }}
    >
      {label}
    </button>
  );
}
