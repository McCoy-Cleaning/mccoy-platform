import * as React from "react";
import { getRouteApi } from "@tanstack/react-router";
import { Inbox, RefreshCw, Search } from "lucide-react";
import { PageHeader } from "@/components/admin/AdminBits";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { filterInboxMessages, type FormInboxThreadItem } from "@mccoy/email/contracts";
import { useInquiriesListQuery } from "../hooks/useInquiriesListQuery";
import { useInquiriesRealtimeRefresh } from "../hooks/useInquiriesRealtimeRefresh";
import { useInquiryDetailQuery } from "../hooks/useInquiryDetailQuery";
import { useInquiryListDeletes } from "../hooks/useInquiryListDeletes";
import { useInquirySelection } from "../hooks/useInquirySelection";
import { KIND_FILTERS, SCOPE_TAB_LIMIT } from "../lib/filters";
import { MAX_INQUIRY_PINS, sortInboxItemsByPins, useInquiryPins } from "../lib/pins";
import type { KindFilter, ScopeFilter } from "../types/search";
import { InboxDetail } from "./InboxDetail";
import { InquiriesList } from "./InquiriesList";
import { InquiryListDeleteDialogs } from "./InquiryListDeleteDialogs";

const inquiriesRouteApi = getRouteApi("/_app/inquiries");

export function InquiriesPage() {
  const navigate = inquiriesRouteApi.useNavigate();
  const search = inquiriesRouteApi.useSearch();
  const kind = search.kind;
  const scopeKey = search.scope as ScopeFilter;
  const [q, setQ] = React.useState(search.q);
  const [debouncedQ, setDebouncedQ] = React.useState(search.q);
  const [pinStatus, setPinStatus] = React.useState<string | null>(null);
  const { pinnedIds, togglePin, removePins, isPinned } = useInquiryPins();

  const {
    items,
    setItems,
    scopeFacets,
    listState,
    refreshing,
    listError,
    listErrorCode,
    showAllMailbox,
    loadList,
    registerTombstones,
    clearTombstones,
  } = useInquiriesListQuery({ kind, scopeKey, debouncedQ });

  const { selectedId, detail, setDetail, detailState, detailError, loadDetail, softRefreshDetail, closeDetail } =
    useInquiryDetailQuery({ setItems });

  useInquiriesRealtimeRefresh({ loadList, selectedId, softRefreshDetail });

  const openInquiry = React.useCallback(
    (id: string) => {
      void navigate({
        search: (prev) => ({ ...prev, id }),
        replace: false,
      });
    },
    [navigate],
  );

  const backToList = React.useCallback(() => {
    closeDetail();
    void navigate({
      search: (prev) => {
        const { id: _removed, ...rest } = prev;
        return rest;
      },
      replace: true,
    });
  }, [closeDetail, navigate]);

  // Hydrate detail from ?id= (open / refresh / notification deep link).
  React.useEffect(() => {
    const urlId = search.id;
    if (!urlId) {
      if (selectedId) closeDetail();
      return;
    }
    if (urlId !== selectedId) {
      void loadDetail(urlId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to URL id
  }, [search.id]);

  const displayItems = React.useMemo(
    () =>
      sortInboxItemsByPins(
        filterInboxMessages(items, { kind, scopeKey, q: debouncedQ }),
        pinnedIds,
      ),
    [items, pinnedIds, kind, scopeKey, debouncedQ],
  );

  const { selectedIds, setSelectedIds, toggleSelected, toggleSelectAllVisible } =
    useInquirySelection({
      items: displayItems,
      kind,
      scopeKey,
      debouncedQ,
    });

  const deletes = useInquiryListDeletes({
    items,
    selectedIds,
    setSelectedIds,
    setItems,
    removePins,
    registerTombstones,
    clearTombstones,
    selectedId,
    closeDetail: backToList,
  });

  const applySearch = React.useCallback(() => {
    const trimmed = q.trim();
    setDebouncedQ(trimmed);
    if (trimmed !== search.q) {
      void navigate({
        search: (prev) => ({ ...prev, q: trimmed }),
        replace: true,
      });
    }
  }, [q, navigate, search.q]);

  const handleTogglePin = React.useCallback(
    (id: string, label: string) => {
      const result = togglePin(id);
      if (result === "max_reached") {
        setPinStatus(`Maximaal ${MAX_INQUIRY_PINS} vastgezette aanvragen. Maak eerst een pin los.`);
        window.setTimeout(() => setPinStatus(null), 4000);
        return;
      }
      setPinStatus(result === "pinned" ? `${label} vastgezet.` : `${label} niet meer vastgezet.`);
      window.setTimeout(() => setPinStatus(null), 2500);
    },
    [togglePin],
  );

  React.useEffect(() => {
    deletes.resetDeleteUiOnFilterChange();
    // Mirror original: clear delete UI when filters/search change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- kind/scope/q gate
  }, [kind, scopeKey, debouncedQ]);

  React.useEffect(() => {
    setQ(search.q);
    setDebouncedQ(search.q);
  }, [search.q]);

  React.useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    if (debouncedQ === search.q) return;
    void navigate({
      search: (prev) => ({ ...prev, q: debouncedQ }),
      replace: true,
    });
  }, [debouncedQ, navigate, search.q]);

  const setKind = (next: KindFilter) => {
    void navigate({ search: (prev) => ({ ...prev, kind: next }) });
  };

  const setScopeKey = (next: ScopeFilter) => {
    void navigate({ search: (prev) => ({ ...prev, scope: next }) });
  };

  const useScopeSelect = scopeFacets.length > SCOPE_TAB_LIMIT;
  const allVisibleSelected =
    displayItems.length > 0 && displayItems.every((item) => selectedIds.has(item.id));
  const someVisibleSelected = displayItems.some((item) => selectedIds.has(item.id));

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={Inbox}
        accent="#22d3ee"
        title="Aanvragen"
        subtitle="Websiteformulieren (inclusief aangepaste formulieren). Open een bericht om te lezen, te antwoorden of te verwijderen."
        actions={[
          {
            label: "Vernieuwen",
            icon: RefreshCw,
            onClick: () => {
              void loadList({ fresh: true });
              if (selectedId) softRefreshDetail(selectedId);
            },
          },
        ]}
      />

      {showAllMailbox ? (
        <div
          role="status"
          className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"
        >
          Debugmodus: alle berichten uit de mailbox worden getoond (
          <code className="text-amber-50/90">FORM_INBOX_SHOW_ALL</code>
          ). Zet dit uit in <code className="text-amber-50/90">.env</code> voor alleen
          website-formulieren.
        </div>
      ) : null}

      {selectedId ? (
        <InboxDetail
          detail={detail}
          state={detailState}
          error={detailError}
          onBack={backToList}
          isPinned={selectedId ? isPinned(selectedId) : false}
          onTogglePin={
            selectedId
              ? () => {
                  const label =
                    detail?.submitterName ?? detail?.submitterEmail ?? detail?.from ?? "Aanvraag";
                  handleTogglePin(selectedId, label);
                }
              : undefined
          }
          onDeleted={() => {
            const deletedId = selectedId;
            if (!deletedId) return;
            removePins([deletedId]);
            backToList();
            registerTombstones(
              new Map([
                [
                  deletedId,
                  {
                    deletedAt: Date.now(),
                    operationId: `detail_${Date.now().toString(36)}`,
                  },
                ],
              ]),
            );
            setItems((prev) => prev.filter((item) => item.id !== deletedId));
          }}
          onAppendReply={(item: FormInboxThreadItem) => {
            setDetail((prev) =>
              prev && prev.id === selectedId
                ? {
                    ...prev,
                    thread: [...prev.thread, item].sort(
                      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
                    ),
                  }
                : prev,
            );
          }}
          onRemoveReply={(id) => {
            setDetail((prev) =>
              prev && prev.id === selectedId
                ? { ...prev, thread: prev.thread.filter((item) => item.id !== id) }
                : prev,
            );
          }}
          onRefreshDetail={() => {
            if (selectedId) softRefreshDetail(selectedId);
          }}
        />
      ) : (
        <>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-stretch"
            onSubmit={(e) => {
              e.preventDefault();
              applySearch();
            }}
          >
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
              <label className="sr-only" htmlFor="inquiry-search">
                Zoek aanvragen
              </label>
              <input
                id="inquiry-search"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Zoek op naam, e-mail of onderwerp…"
                autoComplete="off"
                className="w-full rounded-2xl border border-white/15 bg-white/[0.04] py-3.5 pl-12 pr-4 text-base outline-none transition placeholder:text-white/35 focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30"
              />
            </div>
            <Button
              type="submit"
              size="lg"
              className="min-h-[3.25rem] shrink-0 rounded-2xl px-6 text-base font-semibold"
            >
              <Search className="h-5 w-5" />
              Zoeken
            </Button>
          </form>

          <div className="space-y-2">
            <p className="text-xs text-white/45">
              Type (Algemeen, Sollicitatie, …) en scope (bijv. test) zijn aparte filters — beide
              tegelijk actief.
            </p>
            <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div
                role="tablist"
                aria-label="Filter op formuliertype"
                className="flex shrink-0 gap-2"
              >
                {KIND_FILTERS.map((f) => {
                  const Icon = f.icon;
                  const isActive = kind === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setKind(f.id)}
                      className={cn(
                        "group relative flex shrink-0 snap-start items-center gap-2.5 rounded-2xl border px-5 py-3 text-[15px] font-semibold transition-all",
                        isActive
                          ? "border-transparent bg-white text-[#0a0a0f] shadow-lg"
                          : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:text-white",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {scopeFacets.length > 0 ? (
                <>
                  <div aria-hidden className="mx-1 w-px shrink-0 self-stretch bg-white/15" />
                  {useScopeSelect ? (
                    <div className="flex shrink-0 items-center gap-2">
                      <label htmlFor="inquiry-scope" className="sr-only">
                        Scope
                      </label>
                      <select
                        id="inquiry-scope"
                        value={scopeKey}
                        onChange={(e) => setScopeKey(e.target.value as ScopeFilter)}
                        className="min-w-[10rem] rounded-2xl border border-white/15 bg-white/[0.04] px-4 py-3 text-[15px] font-semibold outline-none focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30"
                      >
                        <option value="all">Alle scopes</option>
                        {scopeFacets.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label} ({s.count})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div
                      role="tablist"
                      aria-label="Filter op scope"
                      className="flex shrink-0 gap-2"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={scopeKey === "all"}
                        onClick={() => setScopeKey("all")}
                        className={cn(
                          "shrink-0 snap-start rounded-2xl border px-5 py-3 text-[15px] font-semibold transition-all",
                          scopeKey === "all"
                            ? "border-transparent bg-white text-[#0a0a0f] shadow-lg"
                            : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:text-white",
                        )}
                      >
                        Alle scopes
                      </button>
                      {scopeFacets.map((s) => {
                        const isActive = scopeKey === s.key;
                        return (
                          <button
                            key={s.key}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => setScopeKey(s.key)}
                            className={cn(
                              "shrink-0 snap-start rounded-2xl border px-5 py-3 text-[15px] font-semibold transition-all",
                              isActive
                                ? "border-transparent bg-white text-[#0a0a0f] shadow-lg"
                                : "border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:text-white",
                            )}
                          >
                            {s.label}
                            <span className="ml-1.5 text-xs font-medium opacity-60">
                              ({s.count})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>

          <InquiryListDeleteDialogs
            listDeleteTargetId={deletes.listDeleteTargetId}
            listDeleteTarget={deletes.listDeleteTarget}
            bulkDeleteOpen={deletes.bulkDeleteOpen}
            selectedCount={selectedIds.size}
            listDeleteBusy={deletes.listDeleteBusy}
            listDeleteError={deletes.listDeleteError}
            onConfirmSingle={() => void deletes.performListSingleDelete()}
            onCancelSingle={() => {
              if (deletes.listDeleteBusy) return;
              deletes.setListDeleteTargetId(null);
              deletes.setListDeleteError(null);
            }}
            onConfirmBulk={() => void deletes.performBulkDelete()}
            onCancelBulk={() => {
              if (deletes.listDeleteBusy) return;
              deletes.setBulkDeleteOpen(false);
              deletes.setListDeleteError(null);
            }}
          />

          <InquiriesList
            listState={listState}
            refreshing={refreshing}
            listError={listError}
            listErrorCode={listErrorCode}
            items={items}
            displayItems={displayItems}
            debouncedQ={debouncedQ}
            scopeKey={scopeKey}
            selectedIds={selectedIds}
            listDeleteBusy={deletes.listDeleteBusy}
            deletingIds={deletes.deletingIds}
            listDeleteError={deletes.listDeleteError}
            listDeleteTargetId={deletes.listDeleteTargetId}
            bulkDeleteOpen={deletes.bulkDeleteOpen}
            listDeleteStatus={deletes.listDeleteStatus}
            retryFailedIds={deletes.retryFailedIds}
            pinStatus={pinStatus}
            allVisibleSelected={allVisibleSelected}
            someVisibleSelected={someVisibleSelected}
            isPinned={isPinned}
            onRetry={() => void loadList()}
            onRetryFailedDeletes={() => void deletes.retryFailedDeletes()}
            onToggleSelectAll={() => toggleSelectAllVisible(displayItems, allVisibleSelected)}
            onBulkDelete={() => {
              deletes.setListDeleteError(null);
              deletes.setBulkDeleteOpen(true);
            }}
            onToggleSelected={toggleSelected}
            onOpenDetail={openInquiry}
            onTogglePin={handleTogglePin}
            onRequestDelete={(id) => {
              deletes.setListDeleteError(null);
              deletes.setListDeleteTargetId(id);
            }}
          />
        </>
      )}
    </div>
  );
}
