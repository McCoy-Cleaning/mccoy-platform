import { Mail, Pin, PinOff, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/admin/EmptyState";
import { ErrorState } from "@/components/admin/ErrorState";
import { InlineLoader } from "@/components/admin/InlineLoader";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KIND_LABELS } from "@/lib/requests/labels";
import type { FormInboxMessageSummary } from "@mccoy/email/contracts";
import type { ListState } from "../hooks/useInquiriesListQuery";
import { kindMeta } from "../lib/filters";
import { relativeWhen } from "../lib/format";
import type { ScopeFilter } from "../types/search";
import { InboxListSelectionToolbar } from "./InboxListSelectionToolbar";
import { MailboxConfigHelp } from "./MailboxConfigHelp";

export function InquiriesList({
  listState,
  refreshing = false,
  listError,
  listErrorCode,
  items,
  displayItems,
  debouncedQ,
  scopeKey,
  selectedIds,
  listDeleteBusy,
  deletingIds,
  listDeleteError,
  listDeleteTargetId,
  bulkDeleteOpen,
  listDeleteStatus,
  retryFailedIds = [],
  pinStatus,
  allVisibleSelected,
  someVisibleSelected,
  isPinned,
  onRetry,
  onRetryFailedDeletes,
  onToggleSelectAll,
  onBulkDelete,
  onToggleSelected,
  onOpenDetail,
  onTogglePin,
  onRequestDelete,
}: {
  listState: ListState;
  refreshing?: boolean;
  listError: string | null;
  listErrorCode: string | null;
  items: FormInboxMessageSummary[];
  displayItems: FormInboxMessageSummary[];
  debouncedQ: string;
  scopeKey: ScopeFilter;
  selectedIds: Set<string>;
  listDeleteBusy: boolean;
  deletingIds?: Set<string>;
  listDeleteError: string | null;
  listDeleteTargetId: string | null;
  bulkDeleteOpen: boolean;
  listDeleteStatus: string | null;
  retryFailedIds?: string[];
  pinStatus: string | null;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  isPinned: (id: string) => boolean;
  onRetry: () => void;
  onRetryFailedDeletes?: () => void;
  onToggleSelectAll: () => void;
  onBulkDelete: () => void;
  onToggleSelected: (id: string, checked: boolean) => void;
  onOpenDetail: (id: string) => void;
  onTogglePin: (id: string, label: string) => void;
  onRequestDelete: (id: string) => void;
}) {
  const showInitialLoader = listState === "loading" && items.length === 0;
  const showFullError = listState === "error" && items.length === 0;
  const hasVisibleRows = displayItems.length > 0;
  const pendingDeletes = deletingIds ?? new Set<string>();

  return (
    <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
      {refreshing && hasVisibleRows ? (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-white/10 bg-white/[0.03] px-5 py-2 text-xs text-white/55"
        >
          Vernieuwen…
        </div>
      ) : null}
      {listError && listState === "ready" && items.length > 0 ? (
        <div
          role="status"
          className="border-b border-amber-400/20 bg-amber-400/10 px-5 py-3 text-sm text-amber-100"
        >
          {listError}
        </div>
      ) : null}
      {listDeleteError && !listDeleteTargetId && !bulkDeleteOpen ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-200"
        >
          <span>{listDeleteError}</span>
          {retryFailedIds.length > 0 && onRetryFailedDeletes ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-red-400/40 text-red-100 hover:bg-red-500/20"
              onClick={onRetryFailedDeletes}
              disabled={listDeleteBusy}
            >
              Opnieuw proberen ({retryFailedIds.length})
            </Button>
          ) : null}
        </div>
      ) : null}
      {listDeleteStatus ? (
        <div
          role="status"
          aria-live="polite"
          className="border-b border-emerald-500/20 bg-emerald-500/10 px-5 py-3 text-sm text-emerald-200"
        >
          {listDeleteStatus}
        </div>
      ) : null}
      {pinStatus ? (
        <div
          role="status"
          className="border-b border-cyan-500/20 bg-cyan-500/10 px-5 py-3 text-sm text-cyan-100"
        >
          {pinStatus}
        </div>
      ) : null}
      {listState === "ready" && displayItems.length > 0 ? (
        <InboxListSelectionToolbar
          allVisibleSelected={allVisibleSelected}
          someVisibleSelected={someVisibleSelected}
          selectedCount={selectedIds.size}
          busy={listDeleteBusy}
          onToggleSelectAll={onToggleSelectAll}
          onBulkDelete={onBulkDelete}
        />
      ) : null}
      {showInitialLoader && <InlineLoader label="Berichten laden…" />}
      {showFullError &&
        (listErrorCode === "config" ? (
          <ErrorState
            code="config"
            title="Mailbox niet geconfigureerd"
            message={listError ?? "Mailboxconfiguratie ontbreekt."}
            onRetry={onRetry}
            retryLabel="Opnieuw proberen"
          >
            <MailboxConfigHelp />
          </ErrorState>
        ) : (
          <ErrorState
            message={listError ?? "Er ging iets mis."}
            onRetry={onRetry}
            retryLabel="Opnieuw proberen"
          />
        ))}
      {listState === "ready" && items.length === 0 && !showInitialLoader && (
        <EmptyState
          icon={Mail}
          title="Geen berichten gevonden"
          description={
            debouncedQ
              ? "Geen berichten komen overeen met deze zoekopdracht. Pas de filters of zoekterm aan."
              : scopeKey !== "all"
                ? "Geen openstaande aanvragen voor deze scope. Gesloten of verwijderde items verschijnen hier niet meer."
                : "Zodra een klant een formulier op de website invult, verschijnt het hier."
          }
        />
      )}
      {displayItems.length > 0 && !showInitialLoader && !showFullError && (
        <ul className="divide-y divide-white/5">
          {displayItems.map((m) => {
            const meta = kindMeta(m.kind);
            const Icon = meta.icon;
            const rowLabel = m.submitterName ?? m.submitterEmail ?? m.from ?? "Formulierbericht";
            const isSelected = selectedIds.has(m.id);
            const pinned = isPinned(m.id);
            const isDeleting = pendingDeletes.has(m.id);
            return (
              <li
                key={m.id}
                className={cn(
                  "group flex items-stretch",
                  pinned && "bg-amber-400/[0.04]",
                  isDeleting && "opacity-50",
                )}
              >
                <label className="flex shrink-0 items-center px-4 sm:px-5">
                  <span className="sr-only">Selecteer {rowLabel}</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-white/25 bg-black/40 accent-[#1e88e5]"
                    checked={isSelected}
                    disabled={listDeleteBusy}
                    onChange={(e) => onToggleSelected(m.id, e.target.checked)}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onOpenDetail(m.id)}
                  className="flex min-w-0 flex-1 items-center gap-4 py-4 pr-2 text-left transition hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1e88e5] sm:pr-4"
                >
                  <div
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10"
                    style={{ backgroundColor: `${meta.color}22`, color: meta.color }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-base font-semibold">{rowLabel}</div>
                      {pinned ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-100">
                          <Pin className="h-3 w-3" aria-hidden />
                          Vastgezet
                        </span>
                      ) : null}
                      {m.unread && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full bg-[#2f9ff0] shadow-[0_0_8px_rgba(30,136,229,0.9)]"
                          aria-label="Ongelezen"
                        />
                      )}
                      <span className="hidden rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/55 sm:inline">
                        {KIND_LABELS[m.kind]}
                      </span>
                      {m.scopeLabel || m.scopeKey ? (
                        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs text-cyan-100">
                          {m.scopeLabel || m.scopeKey}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-0.5 truncate text-sm text-white/55">
                      {m.submitterName && m.submitterEmail ? m.submitterEmail : KIND_LABELS[m.kind]}
                    </div>
                    {m.snippet && m.snippet !== m.submitterEmail && (
                      <div className="mt-0.5 truncate text-sm text-white/40">{m.snippet}</div>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-sm text-white/45">
                    <div>{relativeWhen(m.date)}</div>
                    {m.requestNumber && (
                      <div className="mt-0.5 font-mono text-xs text-white/35">
                        {m.requestNumber}
                      </div>
                    )}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-1 pr-3 sm:pr-5">
                  <button
                    type="button"
                    aria-label={pinned ? `${rowLabel} losmaken` : `${rowLabel} vastzetten`}
                    aria-pressed={pinned}
                    disabled={listDeleteBusy}
                    onClick={() => onTogglePin(m.id, rowLabel)}
                    className={cn(
                      "inline-flex h-11 w-11 items-center justify-center rounded-xl border transition focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
                      pinned
                        ? "border-amber-400/35 bg-amber-400/15 text-amber-100 opacity-100 focus-visible:ring-amber-400/40"
                        : "border-white/15 bg-white/5 text-white/70 opacity-100 hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:ring-[#1e88e5]/40 sm:opacity-0",
                    )}
                  >
                    {pinned ? (
                      <PinOff className="h-4 w-4" aria-hidden />
                    ) : (
                      <Pin className="h-4 w-4" aria-hidden />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Verwijder ${rowLabel}`}
                    disabled={listDeleteBusy}
                    onClick={() => onRequestDelete(m.id)}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-red-400/20 bg-red-500/5 text-red-200/80 opacity-100 transition hover:border-red-400/35 hover:bg-red-500/15 hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40 disabled:opacity-50 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
