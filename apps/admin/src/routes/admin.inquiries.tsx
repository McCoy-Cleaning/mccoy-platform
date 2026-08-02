import { createFileRoute } from "@tanstack/react-router";
import * as React from "react";
import {
  Inbox,
  Briefcase,
  GlassWater,
  Sofa,
  HelpCircle,
  Search,
  ArrowLeft,
  Send,
  Loader2,
  RefreshCw,
  Mail,
  AlertTriangle,
  Paperclip,
  Download,
  MessageSquare,
  Trash2,
  Pin,
  PinOff,
} from "lucide-react";
import { PageHeader } from "@/components/admin/AdminBits";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  bulkDeleteAdminFormInboxMessages,
  deleteAdminFormInboxMessage,
  getAdminFormInboxAttachment,
  getAdminFormInboxMessage,
  getAdminFormInboxThread,
  listAdminFormInbox,
  markAdminRequestsNotificationsRead,
  replyAdminFormInboxMessage,
} from "@/lib/api/admin-requests.functions";
import { refreshAdminRequestsUnreadBadge } from "@/lib/requests/unread-badge";
import {
  MAX_INQUIRY_PINS,
  sortInboxItemsByPins,
  useInquiryPins,
} from "@/lib/requests/inquiry-pins";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KIND_LABELS, FIELD_LABELS_NL } from "@/lib/requests/labels";
import type { FormKind } from "@/lib/forms/types";
import type {
  FormInboxAttachment,
  FormInboxMessage,
  FormInboxMessageSummary,
  FormInboxThreadItem,
  InboxScopeFacet,
} from "@mccoy/email/contracts";
import { FORM_KINDS } from "@mccoy/domain";

type KindFilter = FormKind | "all";
type ScopeFilter = string | "all";

const SCOPE_TAB_LIMIT = 5;

export const Route = createFileRoute("/admin/inquiries")({
  validateSearch: (search: Record<string, unknown>) => {
    const kindRaw = typeof search.kind === "string" ? search.kind : "all";
    const kind =
      kindRaw === "all" || (FORM_KINDS as readonly string[]).includes(kindRaw)
        ? (kindRaw as KindFilter)
        : "all";
    const scope =
      typeof search.scope === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(search.scope)
        ? search.scope
        : "all";
    const q = typeof search.q === "string" ? search.q.slice(0, 200) : "";
    return { kind, scope, q };
  },
  component: InquiriesPage,
});

const KIND_FILTERS: {
  id: KindFilter;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}[] = [
  { id: "all", label: "Alles", icon: Inbox, color: "#e8e8f0" },
  { id: "job_application", label: "Sollicitatie", icon: Briefcase, color: "#a78bfa" },
  { id: "glass_washing", label: "Glasbewassing", icon: GlassWater, color: "#22d3ee" },
  { id: "furniture_cleaning", label: "Meubels", icon: Sofa, color: "#f59e0b" },
  { id: "inquiry", label: "Algemeen", icon: HelpCircle, color: "#22c55e" },
  { id: "newsletter", label: "Nieuwsbrief", icon: Mail, color: "#38bdf8" },
];

function kindMeta(kind: FormKind) {
  return KIND_FILTERS.find((f) => f.id === kind) ?? KIND_FILTERS[0]!;
}

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function relativeWhen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} uur`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Gisteren";
  return `${days}d`;
}

function InquiriesPage() {
  const navigate = Route.useNavigate();
  const search = Route.useSearch();
  const kind = search.kind;
  const scopeKey = search.scope as ScopeFilter;
  const [q, setQ] = React.useState(search.q);
  const [debouncedQ, setDebouncedQ] = React.useState(search.q);
  const [items, setItems] = React.useState<FormInboxMessageSummary[]>([]);
  const [scopeFacets, setScopeFacets] = React.useState<InboxScopeFacet[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<FormInboxMessage | null>(null);
  const [listState, setListState] = React.useState<"loading" | "ready" | "error">("loading");
  const [detailState, setDetailState] = React.useState<"idle" | "loading" | "error">("idle");
  const [listError, setListError] = React.useState<string | null>(null);
  const [listErrorCode, setListErrorCode] = React.useState<string | null>(null);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [showAllMailbox, setShowAllMailbox] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(() => new Set());
  const [listDeleteTargetId, setListDeleteTargetId] = React.useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [listDeleteBusy, setListDeleteBusy] = React.useState(false);
  const [listDeleteError, setListDeleteError] = React.useState<string | null>(null);
  const [listDeleteStatus, setListDeleteStatus] = React.useState<string | null>(null);
  const [pinStatus, setPinStatus] = React.useState<string | null>(null);
  const { pinnedIds, togglePin, removePins, isPinned } = useInquiryPins();

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
      setPinStatus(
        result === "pinned" ? `${label} vastgezet.` : `${label} niet meer vastgezet.`,
      );
      window.setTimeout(() => setPinStatus(null), 2500);
    },
    [togglePin],
  );

  const displayItems = React.useMemo(
    () => sortInboxItemsByPins(items, pinnedIds),
    [items, pinnedIds],
  );

  React.useEffect(() => {
    setSelectedIds(new Set());
    setListDeleteTargetId(null);
    setBulkDeleteOpen(false);
    setListDeleteError(null);
    setListDeleteStatus(null);
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

  const loadList = React.useCallback(async () => {
    setListState("loading");
    setListError(null);
    setListErrorCode(null);
    try {
      const result = await listAdminFormInbox({
        data: {
          kind,
          scopeKey,
          q: debouncedQ || undefined,
        },
      });
      if (!result.ok) {
        setListState("error");
        setListError(result.error);
        setListErrorCode("code" in result ? String(result.code) : null);
        setItems([]);
        setScopeFacets([]);
        setShowAllMailbox(false);
        return;
      }
      setItems(result.items);
      setScopeFacets(result.facets?.scopes ?? []);
      setShowAllMailbox(Boolean(result.showAll));
      setListState("ready");
      // Opening Aanvragen clears the nav badge (unread notifications, category requests).
      void markAdminRequestsNotificationsRead()
        .then((res) => {
          if (res.ok && res.count > 0) refreshAdminRequestsUnreadBadge();
        })
        .catch(() => {
          /* non-fatal — badge simply stays until next successful mark */
        });
    } catch {
      setListState("error");
      setListError("Kon mailbox niet laden.");
      setItems([]);
      setScopeFacets([]);
      setShowAllMailbox(false);
    }
  }, [kind, scopeKey, debouncedQ]);

  React.useEffect(() => {
    void loadList();
  }, [loadList]);

  const loadDetail = React.useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailState("loading");
    setDetailError(null);
    try {
      const result = await getAdminFormInboxMessage({ data: { id } });
      if (!result.ok) {
        setDetail(null);
        setDetailState("error");
        setDetailError(result.error);
        return;
      }
      setDetail(result.message);
      setDetailState("idle");
      setItems((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));

      void getAdminFormInboxThread({ data: { id } })
        .then((threadResult) => {
          if (!threadResult.ok) return;
          setDetail((prev) =>
            prev && prev.id === id ? { ...prev, thread: threadResult.thread } : prev,
          );
        })
        .catch(() => {
          /* keep root-only thread */
        });
    } catch {
      setDetail(null);
      setDetailState("error");
      setDetailError("Kon het bericht niet openen.");
    }
  }, []);

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setDetailState("idle");
    setDetailError(null);
  };

  const useScopeSelect = scopeFacets.length > SCOPE_TAB_LIMIT;
  const allVisibleSelected =
    displayItems.length > 0 && displayItems.every((item) => selectedIds.has(item.id));
  const someVisibleSelected = displayItems.some((item) => selectedIds.has(item.id));

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    setSelectedIds((prev) => {
      if (allVisibleSelected) return new Set();
      const next = new Set(prev);
      for (const item of displayItems) next.add(item.id);
      return next;
    });
  };

  const applyListDeleteSuccess = (deletedIds: string[], partialError?: string | null) => {
    const deleted = new Set(deletedIds);
    removePins(deletedIds);
    setItems((prev) => prev.filter((item) => !deleted.has(item.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of deletedIds) next.delete(id);
      return next;
    });
    if (partialError) {
      setListDeleteStatus(null);
      setListDeleteError(partialError);
    } else {
      setListDeleteError(null);
      setListDeleteStatus(
        deletedIds.length === 1
          ? "Bericht verwijderd uit de mailbox."
          : `${deletedIds.length} berichten verwijderd uit de mailbox.`,
      );
    }
    void loadList();
  };

  const performListSingleDelete = async () => {
    if (!listDeleteTargetId) return;
    setListDeleteBusy(true);
    setListDeleteError(null);
    setListDeleteStatus(null);
    try {
      const result = await deleteAdminFormInboxMessage({ data: { id: listDeleteTargetId } });
      if (!result.ok) {
        setListDeleteError(result.error);
        setListDeleteBusy(false);
        return;
      }
      const deletedId = listDeleteTargetId;
      setListDeleteTargetId(null);
      setListDeleteBusy(false);
      applyListDeleteSuccess([deletedId]);
    } catch {
      setListDeleteError("Verwijderen mislukt. Probeer het opnieuw.");
      setListDeleteBusy(false);
    }
  };

  const performBulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setListDeleteBusy(true);
    setListDeleteError(null);
    setListDeleteStatus(null);
    try {
      const result = await bulkDeleteAdminFormInboxMessages({ data: { ids } });
      if (!result.ok) {
        if (result.deletedCount > 0) {
          setBulkDeleteOpen(false);
          applyListDeleteSuccess(result.deletedIds, result.error);
        } else {
          setListDeleteError(result.error);
        }
        setListDeleteBusy(false);
        return;
      }
      setBulkDeleteOpen(false);
      setListDeleteBusy(false);
      applyListDeleteSuccess(result.deletedIds, "partial" in result ? result.error : null);
    } catch {
      setListDeleteError("Verwijderen mislukt. Probeer het opnieuw.");
      setListDeleteBusy(false);
    }
  };

  const listDeleteTarget = listDeleteTargetId
    ? items.find((item) => item.id === listDeleteTargetId)
    : null;

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
              void loadList();
              if (selectedId) void loadDetail(selectedId);
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
          ). Zet dit uit in <code className="text-amber-50/90">.env</code> voor
          alleen website-formulieren.
        </div>
      ) : null}

      {selectedId ? (
        <InboxDetail
          detail={detail}
          state={detailState}
          error={detailError}
          onBack={closeDetail}
          isPinned={selectedId ? isPinned(selectedId) : false}
          onTogglePin={
            selectedId
              ? () => {
                  const label =
                    detail?.submitterName ??
                    detail?.submitterEmail ??
                    detail?.from ??
                    "Aanvraag";
                  handleTogglePin(selectedId, label);
                }
              : undefined
          }
          onDeleted={() => {
            const deletedId = selectedId;
            removePins([deletedId]);
            closeDetail();
            setItems((prev) => prev.filter((item) => item.id !== deletedId));
            void loadList();
          }}
          onAppendReply={(item) => {
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
          onRefreshDetail={() => {
            if (selectedId) void loadDetail(selectedId);
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
            <div
              className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
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
                  <div
                    aria-hidden
                    className="mx-1 w-px shrink-0 self-stretch bg-white/15"
                  />
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

          <ConfirmationDialog
            open={listDeleteTargetId !== null}
            title="E-mail verwijderen"
            description={
              listDeleteTarget
                ? `Dit verwijdert het formulierbericht van ${listDeleteTarget.submitterName ?? listDeleteTarget.submitterEmail ?? listDeleteTarget.from} uit de mailbox (Verwijderde items). Dit kan niet eenvoudig ongedaan worden gemaakt vanuit Aanvragen.`
                : "Dit verwijdert het formulierbericht uit de mailbox (Verwijderde items). Dit kan niet eenvoudig ongedaan worden gemaakt vanuit Aanvragen."
            }
            confirmLabel="Verwijderen"
            tone="destructive"
            pending={listDeleteBusy}
            error={listDeleteError}
            onConfirm={performListSingleDelete}
            onCancel={() => {
              if (listDeleteBusy) return;
              setListDeleteTargetId(null);
              setListDeleteError(null);
            }}
          />

          <ConfirmationDialog
            open={bulkDeleteOpen}
            title={`${selectedIds.size} berichten verwijderen`}
            description={`Weet u zeker dat u ${selectedIds.size} geselecteerde berichten wilt verwijderen? Ze worden verplaatst naar Verwijderde items in de mailbox. Dit kan niet eenvoudig ongedaan worden gemaakt vanuit Aanvragen.`}
            confirmLabel="Verwijderen"
            tone="destructive"
            pending={listDeleteBusy}
            error={listDeleteError}
            onConfirm={performBulkDelete}
            onCancel={() => {
              if (listDeleteBusy) return;
              setBulkDeleteOpen(false);
              setListDeleteError(null);
            }}
          />

          <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-xl">
            {listDeleteError && !listDeleteTargetId && !bulkDeleteOpen ? (
              <div
                role="alert"
                className="border-b border-red-500/20 bg-red-500/10 px-5 py-3 text-sm text-red-200"
              >
                {listDeleteError}
              </div>
            ) : null}
            {listDeleteStatus ? (
              <div
                role="status"
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
                onToggleSelectAll={toggleSelectAllVisible}
                onBulkDelete={() => {
                  setListDeleteError(null);
                  setBulkDeleteOpen(true);
                }}
              />
            ) : null}
            {listState === "loading" && (
              <div className="flex items-center justify-center gap-3 p-12 text-base text-white/55">
                <Loader2 className="h-5 w-5 animate-spin" />
                Berichten laden…
              </div>
            )}
            {listState === "error" && (
              <div role="alert" className="space-y-4 p-10 text-center">
                {listErrorCode === "config" ? (
                  <>
                    <AlertTriangle className="mx-auto h-10 w-10 text-amber-300/80" />
                    <p className="text-base font-semibold text-amber-100">
                      Mailbox niet geconfigureerd
                    </p>
                    <p className="mx-auto max-w-md text-sm leading-relaxed text-white/55">
                      {listError}. Zet{" "}
                      <code className="text-white/75">FORM_INBOX_PROVIDER=imap</code> terwijl Graph
                      nog niet klaar is, plus SMTP_* / FORM_INBOX_* (IMAP lezen + SMTP versturen).
                      Of configureer Microsoft Graph. Zie docs/apps-and-hosts.md.
                    </p>
                  </>
                ) : (
                  <p className="text-base text-red-300">{listError ?? "Er ging iets mis."}</p>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => void loadList()}
                    className="a-btn a-btn-secondary"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Opnieuw proberen
                  </button>
                </div>
              </div>
            )}
            {listState === "ready" && items.length === 0 && (
              <div className="p-12 text-center">
                <Mail className="mx-auto mb-4 h-10 w-10 text-white/30" />
                <p className="text-lg font-semibold text-white/80">Geen berichten gevonden</p>
                <p className="mt-2 text-[15px] text-white/50">
                  {scopeKey !== "all"
                    ? "Geen openstaande aanvragen voor deze scope. Gesloten of verwijderde items verschijnen hier niet meer."
                    : "Zodra een klant een formulier op de website invult, verschijnt het hier."}
                </p>
              </div>
            )}
            {listState === "ready" && displayItems.length > 0 && (
              <ul className="divide-y divide-white/5">
                {displayItems.map((m) => {
                  const meta = kindMeta(m.kind);
                  const Icon = meta.icon;
                  const rowLabel =
                    m.submitterName ?? m.submitterEmail ?? m.from ?? "Formulierbericht";
                  const isSelected = selectedIds.has(m.id);
                  const pinned = isPinned(m.id);
                  return (
                    <li
                      key={m.id}
                      className={cn(
                        "group flex items-stretch",
                        pinned && "bg-amber-400/[0.04]",
                      )}
                    >
                      <label className="flex shrink-0 items-center px-4 sm:px-5">
                        <span className="sr-only">Selecteer {rowLabel}</span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-white/25 bg-black/40 accent-[#1e88e5]"
                          checked={isSelected}
                          disabled={listDeleteBusy}
                          onChange={(e) => toggleSelected(m.id, e.target.checked)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => void loadDetail(m.id)}
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
                            {m.submitterName && m.submitterEmail
                              ? m.submitterEmail
                              : KIND_LABELS[m.kind]}
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
                          onClick={() => handleTogglePin(m.id, rowLabel)}
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
                          onClick={() => {
                            setListDeleteError(null);
                            setListDeleteTargetId(m.id);
                          }}
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
        </>
      )}
    </div>
  );
}

function InboxListSelectionToolbar({
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

function InboxDetail({
  detail,
  state,
  error,
  onBack,
  onDeleted,
  onAppendReply,
  onRefreshDetail,
  isPinned,
  onTogglePin,
}: {
  detail: FormInboxMessage | null;
  state: "idle" | "loading" | "error";
  error: string | null;
  onBack: () => void;
  onDeleted: () => void;
  onAppendReply: (item: FormInboxThreadItem) => void;
  onRefreshDetail: () => void;
  isPinned: boolean;
  onTogglePin?: () => void;
}) {
  const [reply, setReply] = React.useState("");
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [replyError, setReplyError] = React.useState<string | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [replySuccess, setReplySuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    setReply("");
    setConfirmOpen(false);
    setDeleteOpen(false);
    setReplyError(null);
    setDeleteError(null);
    setReplySuccess(null);
  }, [detail?.id]);

  const performDelete = async () => {
    if (!detail) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const result = await deleteAdminFormInboxMessage({ data: { id: detail.id } });
      if (!result.ok) {
        setDeleteError(result.error);
        setDeleteBusy(false);
        return;
      }
      setDeleteOpen(false);
      setDeleteBusy(false);
      onDeleted();
    } catch {
      setDeleteError("Verwijderen mislukt. Probeer het opnieuw.");
      setDeleteBusy(false);
    }
  };

  const performSend = async () => {
    if (!detail) return;
    const body = reply.trim();
    setBusy(true);
    setReplyError(null);
    setReplySuccess(null);
    try {
      const result = await replyAdminFormInboxMessage({
        data: { id: detail.id, body },
      });
      if (!result.ok) {
        setReplyError(result.error);
        setBusy(false);
        return;
      }

      onAppendReply({
        id: `local-reply:${detail.id}:${Date.now()}`,
        uid: 0,
        direction: "admin",
        from: "McCoy",
        to: result.toEmail,
        date: new Date().toISOString(),
        subject: detail.subject.startsWith("Re:") ? detail.subject : `Re: ${detail.subject}`,
        textBody: body,
        messageId: result.resendId ?? null,
        attachments: [],
      });
      setReply("");
      setConfirmOpen(false);
      setReplySuccess(`Antwoord verzonden naar ${result.toEmail}.`);
      setBusy(false);
      window.setTimeout(() => onRefreshDetail(), 1200);
    } catch {
      setReplyError("Verzenden mislukt. Probeer het opnieuw.");
      setBusy(false);
    }
  };

  const title =
    detail?.submitterName ??
    detail?.fields.find((f) => f.key === "name")?.value ??
    detail?.subject ??
    "Aanvraag";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="a-btn a-btn-secondary">
          <ArrowLeft className="h-4 w-4" />
          Terug naar overzicht
        </button>
        {detail && state !== "loading" ? (
          <div className="flex flex-wrap items-center gap-2">
            {onTogglePin ? (
              <Button
                type="button"
                variant="outline"
                aria-pressed={isPinned}
                className={cn(
                  "min-h-11 rounded-xl",
                  isPinned
                    ? "border-amber-400/35 bg-amber-400/10 text-amber-100 hover:bg-amber-400/20 hover:text-white"
                    : "border-white/20 bg-white/5 text-white/85 hover:bg-white/10 hover:text-white",
                )}
                onClick={onTogglePin}
                disabled={deleteBusy || busy}
              >
                {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                {isPinned ? "Losmaken" : "Vastzetten"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              className="min-h-11 rounded-xl border-red-400/30 bg-red-500/10 text-red-100 hover:bg-red-500/20 hover:text-white"
              onClick={() => {
                setDeleteError(null);
                setDeleteOpen(true);
              }}
              disabled={deleteBusy || busy}
            >
              <Trash2 className="h-4 w-4" />
              Verwijderen
            </Button>
          </div>
        ) : null}
      </div>

      <ConfirmationDialog
        open={deleteOpen}
        title="E-mail verwijderen"
        description="Dit verwijdert het formulierbericht uit de mailbox (Verwijderde items). Dit kan niet eenvoudig ongedaan worden gemaakt vanuit Aanvragen."
        confirmLabel="Verwijderen"
        tone="destructive"
        pending={deleteBusy}
        error={deleteError}
        onConfirm={performDelete}
        onCancel={() => {
          if (deleteBusy) return;
          setDeleteOpen(false);
          setDeleteError(null);
        }}
      />

      {state === "loading" && (
        <div className="flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-[#0c1220] p-14 text-base text-white/55">
          <Loader2 className="h-5 w-5 animate-spin" />
          Bericht laden…
        </div>
      )}

      {state === "error" && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-base text-red-200"
        >
          {error ?? "Kon details niet laden."}
        </div>
      )}

      {detail && state !== "loading" && (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.85fr)]">
          <div className="space-y-5">
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1220]">
              <div className="border-b border-white/10 px-6 py-5">
                <div className="flex flex-wrap items-center gap-2 text-[12px] font-medium uppercase tracking-[0.14em] text-white/40">
                  <span className="text-cyan-200/80">{KIND_LABELS[detail.kind]}</span>
                  {(detail.scopeLabel || detail.scopeKey) && (
                    <span className="rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[11px] normal-case tracking-normal text-cyan-100">
                      {detail.scopeLabel || detail.scopeKey}
                    </span>
                  )}
                  {detail.requestNumber ? (
                    <span className="font-mono normal-case tracking-normal text-white/45">
                      {detail.requestNumber}
                    </span>
                  ) : null}
                </div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white break-words">
                  {title}
                </h2>
                <p className="mt-1 text-sm text-white/45">{formatWhen(detail.date)}</p>
              </div>

              <div className="grid gap-px bg-white/10 sm:grid-cols-2">
                <div className="bg-[#0c1220] px-6 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    Antwoord naar
                  </p>
                  <p className="mt-1 break-all text-[15px] text-white/90">
                    {detail.submitterEmail ?? "Niet gevonden"}
                  </p>
                </div>
                <div className="bg-[#0c1220] px-6 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                    Mailbox
                  </p>
                  <p className="mt-1 break-all text-[15px] text-white/70">{detail.to}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-[#0c1220]">
              <div className="border-b border-white/10 px-6 py-4">
                <h3 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  {detail.fields.length > 0 ? "Ingevulde gegevens" : "Inhoud"}
                </h3>
              </div>
              {detail.fields.length > 0 ? (
                <dl className="grid grid-cols-1 gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
                  {detail.fields.map((field) => {
                    const label = FIELD_LABELS_NL[field.key] ?? field.label;
                    const fullWidth = isFullWidthFormField(field.key);

                    return (
                      <div
                        key={`${field.key}-${field.label}`}
                        className={cn(
                          "bg-[#0c1220]",
                          fullWidth
                            ? "col-span-full grid gap-1 px-5 py-4 sm:grid-cols-[9.5rem_minmax(0,1fr)] sm:gap-6 sm:px-6"
                            : "px-4 py-2.5 sm:px-5 sm:py-3",
                        )}
                      >
                        <dt
                          className={cn(
                            "text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40",
                            !fullWidth && "leading-snug",
                          )}
                        >
                          {label}
                        </dt>
                        <dd className={cn("min-w-0", !fullWidth && "mt-0.5")}>
                          <FormFieldValue fieldKey={field.key} label={label} value={field.value} />
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              ) : (
                <div className="max-h-[22rem] overflow-auto px-6 py-5">
                  <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed text-white/85">
                    {detail.textBody || "(geen tekstinhoud)"}
                  </pre>
                </div>
              )}
            </section>

            <AttachmentsBlock messageId={detail.id} attachments={detail.attachments} />

            <ConversationThread
              thread={detail.thread}
              rootId={detail.id}
              hideRoot={detail.fields.length > 0}
            />
          </div>

          <section className="h-fit rounded-2xl border border-white/10 bg-[#0c1220] p-6 xl:sticky xl:top-6">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-[#1e88e5]/30 bg-[#1e88e5]/10">
                <Send className="h-4 w-4 text-[#90caf9]" />
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-white">Antwoorden</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/50">
                  {detail.submitterEmail
                    ? `Verstuur een e-mail naar ${detail.submitterEmail}. Het antwoord verschijnt in het gesprek.`
                    : "Geen submitter-e-mail gevonden — antwoorden is niet mogelijk."}
                </p>
              </div>
            </div>

            <label className="mt-6 block">
              <span className="a-label">Uw bericht</span>
              <textarea
                value={reply}
                onChange={(e) => {
                  setReply(e.target.value);
                  setReplySuccess(null);
                }}
                rows={9}
                maxLength={8000}
                disabled={!detail.submitterEmail}
                placeholder="Typ hier uw antwoord…"
                className="mt-1.5 w-full resize-y rounded-xl border border-white/12 bg-black/25 px-4 py-3 text-base outline-none transition placeholder:text-white/30 focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/25 disabled:opacity-50"
              />
            </label>

            {replySuccess && (
              <div
                role="status"
                className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200"
              >
                {replySuccess}
              </div>
            )}

            <Button
              type="button"
              size="lg"
              className="mt-4 min-h-12 w-full rounded-xl text-base font-semibold"
              onClick={() => setConfirmOpen(true)}
              disabled={busy || !detail.submitterEmail || reply.trim().length < 2}
            >
              <Send className="h-4 w-4" />
              Verstuur antwoord
            </Button>

            <ConfirmationDialog
              open={confirmOpen}
              title="Antwoord versturen"
              description={
                detail.submitterEmail
                  ? `Verstuur dit antwoord naar ${detail.submitterEmail}? Dit kan niet ongedaan worden gemaakt.`
                  : "Geen afzender-e-mail gevonden — antwoorden is niet mogelijk."
              }
              confirmLabel="Versturen"
              pending={busy}
              error={replyError}
              onConfirm={performSend}
              onCancel={() => {
                if (busy) return;
                setConfirmOpen(false);
                setReplyError(null);
              }}
            />
          </section>
        </div>
      )}
    </div>
  );
}

const COLLAPSE_FIELD_KEYS = new Set(["motivation", "letter"]);
const COLLAPSE_CHAR_THRESHOLD = 220;

/** Long-text fields stay full-width with readable spacing; scalars use the compact grid. */
const FULL_WIDTH_FIELD_KEYS = new Set(["message", "motivation", "letter", "description"]);

function isFullWidthFormField(fieldKey: string): boolean {
  return FULL_WIDTH_FIELD_KEYS.has(fieldKey);
}

function FormFieldValue({
  fieldKey,
  label,
  value,
}: {
  fieldKey: string;
  label: string;
  value: string;
}) {
  const [open, setOpen] = React.useState(false);
  const shouldCollapse =
    COLLAPSE_FIELD_KEYS.has(fieldKey) && value.trim().length > COLLAPSE_CHAR_THRESHOLD;

  if (!shouldCollapse) {
    return <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white/90">{value}</p>;
  }

  const preview = value.trim().slice(0, COLLAPSE_CHAR_THRESHOLD).trimEnd();

  return (
    <div className="space-y-2">
      <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white/90">
        {preview}
        <span className="text-white/40">…</span>
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-sm font-medium text-white/85 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e88e5]"
      >
        Alles lezen
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden border-white/10 bg-[#0f172a] text-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">{label}</DialogTitle>
            <DialogDescription className="sr-only">Volledige tekst van {label}</DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(60vh,28rem)] overflow-y-auto rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="whitespace-pre-wrap break-words text-base leading-relaxed text-white/90">
              {value}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AttachmentsBlock({
  messageId,
  attachments,
}: {
  messageId?: string;
  attachments: FormInboxAttachment[];
}) {
  const [busyName, setBusyName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (!attachments.length) return null;

  const download = async (att: FormInboxAttachment) => {
    if (att.contentBase64) {
      const binary = atob(att.contentBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: att.contentType || "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.filename;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    if (!messageId) {
      setError("Bijlage niet beschikbaar om te downloaden.");
      return;
    }

    setBusyName(att.filename);
    setError(null);
    try {
      const result = await getAdminFormInboxAttachment({
        data: { id: messageId, filename: att.filename },
      });
      if (!result.ok || !result.attachment.contentBase64) {
        setError(result.ok ? "Download mislukt." : result.error);
        return;
      }
      const binary = atob(result.attachment.contentBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], {
        type: result.attachment.contentType || "application/octet-stream",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.attachment.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download mislukt.");
    } finally {
      setBusyName(null);
    }
  };

  return (
    <div>
      <h3 className="mb-2.5 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-white/55">
        <Paperclip className="h-4 w-4" />
        Bijlagen
      </h3>
      <ul className="space-y-2">
        {attachments.map((att) => (
          <li
            key={`${att.filename}-${att.size}`}
            className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
          >
            <div className="min-w-0">
              <div className="truncate text-[15px] text-white/90">{att.filename}</div>
              <div className="text-xs text-white/45">
                {att.contentType}
                {att.size > 0 ? ` · ${Math.round(att.size / 1024)} KB` : ""}
              </div>
            </div>
            <button
              type="button"
              onClick={() => void download(att)}
              disabled={busyName === att.filename}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/85 transition hover:bg-white/10 disabled:opacity-50"
            >
              {busyName === att.filename ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Download
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p className="mt-2 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function ConversationThread({
  thread,
  rootId,
  hideRoot,
}: {
  thread: FormInboxThreadItem[];
  rootId: string;
  /** When structured fields are shown above, omit the form root to avoid duplication. */
  hideRoot: boolean;
}) {
  const items = thread.filter((item) => {
    if (item.direction === "form") return false;
    if (hideRoot && item.id === rootId) return false;
    return true;
  });

  const directionLabel: Record<FormInboxThreadItem["direction"], string> = {
    form: "Websiteformulier",
    customer: "Klant",
    admin: "McCoy",
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[#0c1220]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-6 py-4">
        <h3 className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-white/45">
          <MessageSquare className="h-4 w-4 text-white/50" />
          Gesprek
        </h3>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs text-white/50">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="px-6 py-8 text-sm leading-relaxed text-white/45">
          Nog geen antwoorden in dit gesprek. Zodra u een bericht verstuurt, verschijnt het hier.
        </div>
      ) : (
        <ol className="space-y-0 divide-y divide-white/10 px-3 py-3">
          {items.map((item) => {
            const isAdmin = item.direction === "admin";
            const isCustomer = item.direction === "customer";
            return (
              <li key={item.id} className="px-3 py-3">
                <article
                  className={cn(
                    "rounded-xl border px-4 py-3.5",
                    isAdmin && "border-[#1e88e5]/25 bg-[#1e88e5]/10",
                    isCustomer && "border-emerald-500/20 bg-emerald-500/10",
                    !isAdmin && !isCustomer && "border-white/10 bg-black/20",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                          isAdmin && "bg-[#1e88e5]/20 text-[#90caf9]",
                          isCustomer && "bg-emerald-500/20 text-emerald-200",
                          !isAdmin && !isCustomer && "bg-white/10 text-white/70",
                        )}
                      >
                        {directionLabel[item.direction]}
                      </span>
                      <span className="truncate text-xs text-white/40">
                        {isAdmin ? `naar ${item.to}` : item.from}
                      </span>
                    </div>
                    <time className="text-xs text-white/40">{formatWhen(item.date)}</time>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-white/90">
                    {item.textBody || "(geen tekst)"}
                  </p>
                  {item.attachments.length > 0 && (
                    <div className="mt-3">
                      <AttachmentsBlock messageId={item.id} attachments={item.attachments} />
                    </div>
                  )}
                </article>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
