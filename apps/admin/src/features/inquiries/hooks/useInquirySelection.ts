import * as React from "react";
import type { FormInboxMessageSummary } from "@mccoy/email/contracts";
import type { KindFilter, ScopeFilter } from "../types/search";

/** Multi-select for list bulk actions. Filters out ids that leave the visible list. */
export function useInquirySelection(params: {
  items: FormInboxMessageSummary[];
  kind: KindFilter;
  scopeKey: ScopeFilter;
  debouncedQ: string;
}) {
  const { items, kind, scopeKey, debouncedQ } = params;
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());

  React.useEffect(() => {
    setSelectedIds(new Set());
  }, [kind, scopeKey, debouncedQ]);

  React.useEffect(() => {
    setSelectedIds((prev) => {
      const visible = new Set(items.map((item) => item.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [items]);

  const toggleSelected = React.useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const toggleSelectAllVisible = React.useCallback(
    (displayItems: FormInboxMessageSummary[], allVisibleSelected: boolean) => {
      setSelectedIds((prev) => {
        if (allVisibleSelected) return new Set();
        const next = new Set(prev);
        for (const item of displayItems) next.add(item.id);
        return next;
      });
    },
    [],
  );

  return {
    selectedIds,
    setSelectedIds,
    toggleSelected,
    toggleSelectAllVisible,
  };
}
