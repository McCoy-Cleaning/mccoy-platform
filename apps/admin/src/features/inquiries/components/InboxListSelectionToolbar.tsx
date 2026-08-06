import * as React from "react";
import { Loader2, Trash2 } from "lucide-react";

export function InboxListSelectionToolbar({
  allVisibleSelected,
  someVisibleSelected,
  selectedCount,
  busy,
  onToggleSelectAll,
  onBulkDelete,
}: {
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  selectedCount: number;
  busy: boolean;
  onToggleSelectAll: () => void;
  onBulkDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 sm:px-5">
      <label className="inline-flex min-h-11 items-center gap-2.5 text-sm text-white/70">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-white/25 bg-black/40 accent-[#1e88e5]"
          checked={allVisibleSelected}
          ref={(el) => {
            if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
          }}
          disabled={busy}
          onChange={onToggleSelectAll}
        />
        Alles selecteren
      </label>
      {selectedCount > 0 ? (
        <>
          <span className="text-sm text-white/45" aria-live="polite">
            {selectedCount} geselecteerd
          </span>
          {/* Future: add Archiveren here when mailbox archive status exists */}
          <button
            type="button"
            disabled={busy}
            onClick={onBulkDelete}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Verwijderen
          </button>
        </>
      ) : null}
    </div>
  );
}
