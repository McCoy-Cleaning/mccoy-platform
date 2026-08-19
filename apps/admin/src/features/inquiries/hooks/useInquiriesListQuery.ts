import * as React from "react";
import { listAdminFormInbox } from "@/lib/api/admin-requests.functions";
import type { FormInboxMessageSummary, InboxScopeFacet } from "@mccoy/email/contracts";
import type { KindFilter, ScopeFilter } from "../types/search";
import {
  filterTombstonedItems,
  pruneTombstonesAfterRefresh,
  type DeleteTombstone,
} from "../lib/optimistic-delete";

export type ListState = "loading" | "ready" | "error";

/**
 * Loads the unfiltered Aanvragen snapshot once (kind=all, scope=all, no q).
 * Kind / scope / search are applied client-side — they must not refetch.
 */
export function useInquiriesListQuery(_params: {
  kind: KindFilter;
  scopeKey: ScopeFilter;
  debouncedQ: string;
}) {
  const [items, setItems] = React.useState<FormInboxMessageSummary[]>([]);
  const [scopeFacets, setScopeFacets] = React.useState<InboxScopeFacet[]>([]);
  const [listState, setListState] = React.useState<ListState>("loading");
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [listError, setListError] = React.useState<string | null>(null);
  const [listErrorCode, setListErrorCode] = React.useState<string | null>(null);
  const [showAllMailbox, setShowAllMailbox] = React.useState(false);
  const [lastSuccessfulLoadAt, setLastSuccessfulLoadAt] = React.useState<string | null>(null);

  const requestGenerationRef = React.useRef(0);
  const hasSuccessfulDataRef = React.useRef(false);
  const tombstonesRef = React.useRef<Map<string, DeleteTombstone>>(new Map());
  const [, bumpTombstones] = React.useState(0);

  const registerTombstones = React.useCallback((entries: Map<string, DeleteTombstone>) => {
    for (const [id, meta] of entries) {
      tombstonesRef.current.set(id, meta);
    }
    bumpTombstones((n) => n + 1);
  }, []);

  const clearTombstones = React.useCallback((ids: string[]) => {
    for (const id of ids) tombstonesRef.current.delete(id);
    bumpTombstones((n) => n + 1);
  }, []);

  const loadList = React.useCallback(async (opts?: { fresh?: boolean }) => {
    const generation = ++requestGenerationRef.current;
    const hadData = hasSuccessfulDataRef.current;
    const explicitRefresh = opts?.fresh === true;

    if (explicitRefresh && hadData) {
      setRefreshing(true);
    } else if (!hadData) {
      setInitialLoading(true);
      setListState("loading");
    }
    if (explicitRefresh || !hadData) {
      setListError(null);
      setListErrorCode(null);
    }

    try {
      const result = await listAdminFormInbox({
        data: {
          kind: "all",
          scopeKey: "all",
          fresh: opts?.fresh,
        },
      });

      if (generation !== requestGenerationRef.current) return;

      if (!result.ok) {
        if (!hasSuccessfulDataRef.current) {
          setListState("error");
          setListError(result.error);
          setListErrorCode("code" in result ? String(result.code) : null);
          setItems([]);
          setScopeFacets([]);
          setShowAllMailbox(false);
        } else {
          setListError(result.error);
          setListErrorCode("code" in result ? String(result.code) : null);
        }
        return;
      }

      const filtered = filterTombstonedItems(result.items, tombstonesRef.current);
      setItems(filtered);
      setScopeFacets(result.facets?.scopes ?? []);
      setShowAllMailbox(Boolean(result.showAll));
      setListState("ready");
      hasSuccessfulDataRef.current = true;
      setLastSuccessfulLoadAt(new Date().toISOString());
      setListError(null);
      setListErrorCode(null);

      tombstonesRef.current = pruneTombstonesAfterRefresh(
        tombstonesRef.current,
        new Set(result.items.map((item) => item.id)),
      );
      bumpTombstones((n) => n + 1);
      // Do not mark all `requests` notifications read on list load — that cleared
      // the bell badge for applicant replies. Mark read when opening an inquiry.
    } catch {
      if (generation !== requestGenerationRef.current) return;
      if (!hasSuccessfulDataRef.current) {
        setListState("error");
        setListError("Kon mailbox niet laden.");
        setItems([]);
        setScopeFacets([]);
        setShowAllMailbox(false);
      } else {
        setListError("Vernieuwen mislukt. Bestaande berichten blijven zichtbaar.");
      }
    } finally {
      if (generation === requestGenerationRef.current) {
        setInitialLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  React.useEffect(() => {
    void loadList();
  }, [loadList]);

  return {
    items,
    setItems,
    scopeFacets,
    listState,
    initialLoading,
    refreshing,
    listError,
    listErrorCode,
    showAllMailbox,
    lastSuccessfulLoadAt,
    loadList,
    registerTombstones,
    clearTombstones,
    getTombstones: () => tombstonesRef.current,
  };
}
