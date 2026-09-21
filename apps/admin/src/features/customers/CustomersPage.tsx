import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpDown,
  Building2,
  Check,
  Download,
  Filter,
  Loader2,
  Mail,
  Search,
  Settings,
  SlidersHorizontal,
  TrendingUp,
  Upload,
  Users,
  X,
} from "lucide-react";

import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { EmptyState } from "@/components/admin/EmptyState";
import { ErrorState } from "@/components/admin/ErrorState";
import {
  deleteAdminPortalCompanies,
  exportAdminCustomersDirectory,
  getAdminCustomersDirectory,
  resendAdminPortalInvitation,
  seedAdminCommerceFixtures,
} from "@/lib/api/admin-customers.functions";
import heroVanUrl from "@/assets/customers-hero-van.jpg";
import { RowActionsMenu, type RowActionId } from "./components/RowActionsMenu";
import { ServiceClientImportDialog } from "./components/ServiceClientImportDialog";
import {
  deleteRecordConfirmCopy,
  deleteRecordRequest,
  deleteRecordSuccessMessage,
  interpretDeleteRecordResult,
  nextDirectorySelectionAfterDelete,
} from "./lib/delete-record";
import {
  companyInitials,
  csvExportSummary,
  DIRECTORY_TABS,
  formatDisplaySaldo,
  formatNlDate,
  formatNlNumber,
  kpiTrend,
  portalStatusDotClass,
  portalStatusTextClass,
  selectedDirectoryItem,
  toCustomerPanelProps,
  typeBadgeClass,
  type CustomerPanelProps,
} from "./lib/directory-view";
import type { CustomersDirectoryTab, CustomersSearch } from "./types/search";

type DirectoryItem = {
  companyId: string;
  legalName: string;
  displayName: string | null;
  companyType: string;
  typeBadge: { id: "service" | "portal"; label: "Service" | "Portaal" };
  customerNumber: string | null;
  contactPersonName: string | null;
  email: string | null;
  invoiceAllowed: boolean;
  kvkNumber: string | null;
  vatNumber: string | null;
  addressStreet: string | null;
  addressHouseNumber: string | null;
  addressHouseSuffix: string | null;
  addressPostalCode: string | null;
  addressCity: string | null;
  invitedUserCount: number;
  pendingInviteEmail: string | null;
  portalPill: {
    id: string;
    label: string;
    tone: string;
  };
  lastOrderAt: string | null;
  outstandingMinor: number;
  outstandingSource: "demo" | "seed" | "none";
};

type ImportRun = {
  id: string;
  fileName: string;
  importedAt: string;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  source: "import" | "demo";
};

type CsvExportState =
  | { status: "idle" }
  | { status: "busy" }
  | { status: "done"; message: string }
  | { status: "error"; message: string };

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      items: DirectoryItem[];
      total: number;
      page: number;
      pageSize: number;
      kpis: {
        totalCustomers: number;
        serviceClients: number;
        registrationRequired: number;
        activePortals: number;
        totalCreatedLast7Days: number;
        totalCreatedPrevious7Days: number;
      };
      importHistory: ImportRun[];
    };

export function CustomersPage({ search }: { search: CustomersSearch }) {
  const navigate = useNavigate({ from: "/customers" });
  const [page, setPage] = useState<PageState>({ status: "loading" });
  /** A follow-up read is in flight while results are already on screen. */
  const [refreshing, setRefreshing] = useState(false);
  const [listEpoch, setListEpoch] = useState(0);
  const [qDraft, setQDraft] = useState(search.q);
  const [serviceImportOpen, setServiceImportOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DirectoryItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<CsvExportState>({ status: "idle" });
  const [selectedSnapshot, setSelectedSnapshot] = useState<DirectoryItem | null>(null);
  const [panelDismissed, setPanelDismissed] = useState(false);
  const panelDismissedRef = useRef(panelDismissed);
  panelDismissedRef.current = panelDismissed;

  function refreshList() {
    setListEpoch((n) => n + 1);
  }

  useEffect(() => {
    setQDraft(search.q);
  }, [search.q]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (qDraft === search.q) return;
      void navigate({
        search: (prev) => ({ ...prev, q: qDraft, page: 1 }),
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [qDraft, search.q, navigate]);

  useEffect(() => {
    let cancelled = false;
    // Keep the current results on screen while the next page loads. Blanking the
    // table on every keystroke, tab, and page change collapsed the layout and
    // reset the KPI cards to placeholders.
    setPage((prev) => (prev.status === "ok" ? prev : { status: "loading" }));
    setRefreshing(true);
    void getAdminCustomersDirectory({
      data: {
        q: search.q || undefined,
        tab: search.tab,
        portalStatus: search.portalStatus !== "all" ? search.portalStatus : undefined,
        page: search.page,
        pageSize: 25,
        companyId: search.companyId,
      },
    }).then((res) => {
      if (cancelled) return;
      setRefreshing(false);
      if (!res.ok) {
        setPage({ status: "error", message: res.error });
        return;
      }
      setPage({
        status: "ok",
        items: res.items,
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
        kpis: res.kpis,
        importHistory: res.importHistory,
      });
      if (!panelDismissedRef.current) {
        const matched = selectedDirectoryItem(res.items, search.companyId);
        const nextSelected = matched ?? res.items[0] ?? null;
        setSelectedSnapshot((prev) => {
          if (matched) return matched;
          if (prev) {
            const stillVisible = selectedDirectoryItem(res.items, prev.companyId);
            return stillVisible ?? prev;
          }
          return nextSelected;
        });
        const nextId = matched?.companyId ?? res.items[0]?.companyId;
        if (!search.companyId && nextId) {
          void navigate({
            search: (prev) => ({ ...prev, companyId: nextId }),
            replace: true,
          });
        }
      }
    }).catch(() => {
      // A rejected read must clear the in-flight flag, otherwise the table stays
      // dimmed and busy forever.
      if (cancelled) return;
      setRefreshing(false);
      setPage((prev) =>
        prev.status === "ok"
          ? prev
          : { status: "error", message: "Klanten konden niet worden geladen. Probeer het opnieuw." },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [search.tab, search.q, search.portalStatus, search.page, listEpoch, navigate]);

  useEffect(() => {
    if (page.status !== "ok" || !search.companyId) return;
    const matched = selectedDirectoryItem(page.items, search.companyId);
    if (!matched || matched.companyId === selectedSnapshot?.companyId) return;
    setPanelDismissed(false);
    setSelectedSnapshot(matched);
  }, [search.companyId, page, selectedSnapshot?.companyId]);

  const pageCount = page.status === "ok" ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;
  const selectedId = selectedSnapshot?.companyId ?? search.companyId;
  const deleteCopy = deleteRecordConfirmCopy(
    deleteTarget ? deleteTarget.displayName || deleteTarget.legalName : "",
  );
  const panelProps =
    selectedSnapshot && !panelDismissed ? toCustomerPanelProps(selectedSnapshot) : null;
  const totalTrend =
    page.status === "ok"
      ? kpiTrend(page.kpis.totalCreatedLast7Days, page.kpis.totalCreatedPrevious7Days)
      : null;

  function setTab(tab: CustomersDirectoryTab) {
    void navigate({
      search: (prev) => ({ ...prev, tab, page: 1 }),
    });
  }

  function selectCompany(item: DirectoryItem) {
    setPanelDismissed(false);
    setSelectedSnapshot(item);
    void navigate({
      search: (prev) => ({ ...prev, companyId: item.companyId }),
    });
  }

  function closePanel() {
    setPanelDismissed(true);
    setSelectedSnapshot(null);
    void navigate({
      search: (prev) => ({ ...prev, companyId: undefined }),
    });
  }

  /**
   * The KPIs describe the whole filtered set, so the export must too. The rows are
   * built server-side under the same filters and the same staff authorization; the
   * browser only receives the finished file.
   */
  async function exportCsv() {
    if (exportState.status === "busy") return;
    setExportState({ status: "busy" });
    try {
      const res = await exportAdminCustomersDirectory({
        data: {
          q: search.q || undefined,
          tab: search.tab,
          portalStatus: search.portalStatus !== "all" ? search.portalStatus : undefined,
        },
      });
      if (!res.ok) {
        setExportState({ status: "error", message: res.error });
        return;
      }
      const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mccoy-klanten.csv";
      a.click();
      URL.revokeObjectURL(url);
      setExportState({
        status: "done",
        message: csvExportSummary({
          rowCount: res.rowCount,
          total: res.total,
          truncated: res.truncated,
          maxRows: res.maxRows,
        }),
      });
    } catch {
      setExportState({
        status: "error",
        message: "Export mislukt. Probeer het opnieuw.",
      });
    }
  }

  async function sendReminder(item: DirectoryItem) {
    if (!item.pendingInviteEmail) return;
    setReminderBusy(true);
    const res = await resendAdminPortalInvitation({
      data: {
        companyId: item.companyId,
        email: item.pendingInviteEmail,
        intendedRole: "account_admin",
      },
    });
    setReminderBusy(false);
    if (!res.ok) {
      setFlash(res.error);
      return;
    }
    setFlash("Herinnering verstuurd.");
    refreshList();
  }

  function companyDetailSearch(companyId: string) {
    return {
      tab: "service" as const,
      q: "",
      status: "all" as const,
      portalStatus: "all" as const,
      page: 1,
      companyId,
    };
  }

  function handleRowAction(action: RowActionId, companyId: string) {
    const item =
      page.status === "ok" ? selectedDirectoryItem(page.items, companyId) : null;
    const target = item ?? (selectedSnapshot?.companyId === companyId ? selectedSnapshot : null);
    if (target) selectCompany(target);
    if (action === "remind") {
      if (target) void sendReminder(target);
      return;
    }
    if (action === "delete") {
      if (!target || deleteBusy) return;
      setDeleteError(null);
      setDeleteTarget(target);
      return;
    }
    void navigate({
      to: "/customers/company/$companyId",
      params: { companyId },
      search: companyDetailSearch(companyId),
      hash: action === "users" ? "gebruikers" : undefined,
    });
  }

  function cancelDeleteRecord() {
    if (deleteBusy) return;
    setDeleteTarget(null);
    setDeleteError(null);
  }

  async function confirmDeleteRecord() {
    if (!deleteTarget || deleteBusy) return;
    const target = deleteTarget;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const res = await deleteAdminPortalCompanies({
        data: deleteRecordRequest(target.companyId),
      });
      const outcome = interpretDeleteRecordResult(res);
      if (!outcome.ok) {
        setDeleteError(outcome.message);
        return;
      }
      const name = target.displayName || target.legalName;
      const remaining =
        page.status === "ok"
          ? nextDirectorySelectionAfterDelete(page.items, target.companyId, selectedId)
          : null;
      setDeleteTarget(null);
      setFlash(deleteRecordSuccessMessage(name));
      if (remaining) {
        selectCompany(remaining);
      } else if (selectedId === target.companyId) {
        closePanel();
      }
      refreshList();
    } catch {
      setDeleteError("Verwijderen mislukt. Probeer het opnieuw.");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0b1c33]">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]">
          <div className="relative z-10 p-6 sm:p-8 lg:p-10">
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Klanten</h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-white/65 sm:text-base">
              Beheer al uw klanten en portaalcliënten — serviceklanten, registraties en
              uitnodigingen op één plek.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                className="a-btn a-btn-primary"
                onClick={() => setServiceImportOpen(true)}
              >
                <Upload className="h-4 w-4" aria-hidden />
                Serviceklanten importeren
              </button>
              <button
                type="button"
                className="a-btn a-btn-secondary"
                onClick={() => void exportCsv()}
                disabled={exportState.status === "busy"}
                aria-describedby="klanten-export-status"
              >
                {/* Fixed-size icon slot: swapping in the spinner must not resize the button. */}
                <span className="grid h-4 w-4 place-items-center" aria-hidden>
                  {exportState.status === "busy" ? (
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </span>
                {exportState.status === "busy" ? "Export voorbereiden…" : "CSV export"}
              </button>
              <button
                type="button"
                className="a-btn a-btn-secondary"
                aria-expanded={filtersOpen}
                aria-controls="klanten-filters"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                <Filter className="h-4 w-4" aria-hidden />
                Filteren
              </button>
            </div>
          </div>
          <div className="relative min-h-[11rem] lg:min-h-full">
            <img
              src={heroVanUrl}
              alt="McCoy bus voor een bedrijfspand"
              className="absolute inset-0 h-full w-full object-cover object-[70%_60%]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0b1c33] via-[#0b1c33]/40 to-transparent lg:from-[#0b1c33]/80" />
          </div>
        </div>
      </section>

      {flash ? (
        <p
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
          role="status"
        >
          {flash}
        </p>
      ) : null}

      <div
        id="klanten-export-status"
        role="status"
        aria-live="polite"
        className={
          exportState.status === "error"
            ? "rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
            : exportState.status === "done"
              ? "rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80"
              : "sr-only"
        }
      >
        {exportState.status === "busy"
          ? "Export wordt voorbereid…"
          : exportState.status === "done" || exportState.status === "error"
            ? exportState.message
            : ""}
        {exportState.status === "error" ? (
          <button
            type="button"
            className="ml-3 font-medium underline underline-offset-2 hover:text-white"
            onClick={() => void exportCsv()}
          >
            Opnieuw proberen
          </button>
        ) : null}
      </div>

      <section aria-labelledby="klanten-kpis-heading">
        <h2 id="klanten-kpis-heading" className="sr-only">
          Klantenoverzicht
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label="Totaal klanten"
            value={page.status === "ok" ? formatNlNumber(page.kpis.totalCustomers) : "—"}
            delta={totalTrend?.delta ?? "…"}
            tone={totalTrend?.tone ?? "neutral"}
            icon={Users}
            accent="from-[#1e88e5] to-[#22d3ee]"
          />
          <KpiCard
            label="Serviceklanten"
            value={page.status === "ok" ? formatNlNumber(page.kpis.serviceClients) : "—"}
            delta="service"
            tone="neutral"
            icon={Building2}
            accent="from-[#22c55e] to-[#84cc16]"
          />
          <KpiCard
            label="Registratie vereist"
            value={page.status === "ok" ? formatNlNumber(page.kpis.registrationRequired) : "—"}
            delta="actie"
            tone="neutral"
            icon={Mail}
            accent="from-[#f59e0b] to-[#ef4444]"
          />
          <KpiCard
            label="Actieve portalen"
            value={page.status === "ok" ? formatNlNumber(page.kpis.activePortals) : "—"}
            delta="portaal"
            tone="neutral"
            icon={SlidersHorizontal}
            accent="from-[#7c3aed] to-[#ec4899]"
          />
        </div>
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Klantfilters"
          className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5"
        >
          {DIRECTORY_TABS.map((tab) => {
            const selected = search.tab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={
                  selected
                    ? "rounded-xl bg-[#1e88e5]/30 px-4 py-2.5 text-sm font-semibold text-white"
                    : "rounded-xl px-4 py-2.5 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white/85"
                }
                onClick={() => setTab(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
        <label className="relative block min-w-0 w-full lg:max-w-sm">
          <span className="sr-only">Zoeken in klanten</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Zoek op bedrijf, nummer of e-mail"
            className="a-input w-full pl-10 pr-10"
          />
          {/* Fixed-size slot inside the field: the spinner cannot shift the layout. */}
          <span className="pointer-events-none absolute right-3 top-1/2 grid h-4 w-4 -translate-y-1/2 place-items-center">
            {refreshing ? (
              <Loader2
                className="h-4 w-4 animate-spin text-white/40 motion-reduce:animate-none"
                aria-hidden
              />
            ) : null}
          </span>
        </label>
      </div>

      {/* Announces the outcome of a search or page change once it settles. */}
      <p role="status" aria-live="polite" className="sr-only">
        {refreshing || page.status !== "ok"
          ? ""
          : `${page.total} klanten gevonden, pagina ${page.page} van ${pageCount}.`}
      </p>

      {filtersOpen ? (
        <div
          id="klanten-filters"
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
        >
          <label className="flex flex-col gap-2 text-sm text-white/70 sm:flex-row sm:items-center">
            <span>Portalstatus</span>
            <select
              className="a-input sm:max-w-xs"
              value={search.portalStatus}
              onChange={(e) =>
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    portalStatus: e.target.value as CustomersSearch["portalStatus"],
                    page: 1,
                  }),
                })
              }
            >
              <option value="all">Alle</option>
              <option value="active">Actief</option>
              <option value="invited">Uitnodiging verzonden</option>
              <option value="registration_required">Registratie vereist</option>
              <option value="reminder_sent">Herinnering verstuurd</option>
              <option value="invite_expired">Link verlopen</option>
              <option value="suspended">Geblokkeerd / opgeschort</option>
            </select>
          </label>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          {page.status === "loading" ? (
            // Placeholder rows reserve the table's footprint so the first real
            // page does not push the pagination and history strip down.
            <div role="status" aria-busy="true">
              <span className="sr-only">Klanten laden…</span>
              <div className="divide-y divide-white/5" aria-hidden>
                {Array.from({ length: 8 }, (_, index) => (
                  <div key={index} className="flex items-center gap-4 px-4 py-3.5">
                    <div className="h-4 flex-1 animate-pulse rounded bg-white/[0.06] motion-reduce:animate-none" />
                    <div className="h-4 w-24 animate-pulse rounded bg-white/[0.05] motion-reduce:animate-none" />
                    <div className="h-4 w-40 animate-pulse rounded bg-white/[0.05] motion-reduce:animate-none" />
                    <div className="h-4 w-20 animate-pulse rounded bg-white/[0.05] motion-reduce:animate-none" />
                  </div>
                ))}
              </div>
            </div>
          ) : page.status === "error" ? (
            <ErrorState title="Klanten laden mislukt" message={page.message} />
          ) : page.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search.q ? "Geen treffers" : "Nog geen klanten"}
              description={
                search.q
                  ? "Pas de zoekterm of filters aan."
                  : "Importeer serviceklanten via CSV of laad demogegevens voor lokale ontwikkeling."
              }
              action={
                !search.q ? (
                  <button
                    type="button"
                    className="a-btn a-btn-secondary"
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        setBusy(true);
                        const res = await seedAdminCommerceFixtures({ data: { confirm: true } });
                        setBusy(false);
                        if (!res.ok) setFlash(res.error);
                        else {
                          setFlash("Demogegevens geladen.");
                          refreshList();
                        }
                      })();
                    }}
                  >
                    Demogegevens laden
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div
              className={`overflow-x-auto transition-opacity motion-reduce:transition-none ${
                refreshing ? "opacity-60" : ""
              }`}
              aria-busy={refreshing || undefined}
            >
              <table className="min-w-[64rem] w-full text-left text-sm">
                <caption className="sr-only">Klantenlijst</caption>
                <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        Bedrijf
                        <ArrowUpDown className="h-3 w-3 text-white/35" aria-hidden />
                      </span>
                    </th>
                    <th className="px-4 py-3 font-medium">Klantnummer</th>
                    <th className="px-4 py-3 font-medium">Contactpersoon</th>
                    <th className="px-4 py-3 font-medium">E-mailadres</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Portalstatus</th>
                    <th className="px-4 py-3 font-medium">Laatste bestelling</th>
                    <th className="px-4 py-3 font-medium">Openstaand saldo</th>
                    <th className="px-4 py-3 text-right font-medium">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {page.items.map((row) => {
                    const name = row.displayName || row.legalName;
                    const selected = row.companyId === selectedId;
                    return (
                      <tr
                        key={row.companyId}
                        tabIndex={0}
                        aria-selected={selected}
                        className={
                          selected
                            ? "cursor-pointer bg-[#1e88e5]/10 [&>td]:shadow-[inset_0_1px_0_0_rgba(56,189,248,0.42),inset_0_-1px_0_0_rgba(56,189,248,0.42)] [&>td:first-child]:shadow-[inset_1px_1px_0_0_rgba(56,189,248,0.42),inset_0_-1px_0_0_rgba(56,189,248,0.42)] [&>td:last-child]:shadow-[inset_-1px_1px_0_0_rgba(56,189,248,0.42),inset_0_-1px_0_0_rgba(56,189,248,0.42)]"
                            : "cursor-pointer hover:bg-white/[0.03]"
                        }
                        onClick={() => selectCompany(row)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectCompany(row);
                          }
                        }}
                      >
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-3 text-left">
                            <span
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#1e88e5]/20 text-xs font-bold tracking-wide text-[#8ec8f8]"
                              aria-hidden
                            >
                              {companyInitials(name)}
                            </span>
                            <span className="truncate font-medium text-white/90">{name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 tabular-nums text-white/70">
                          {row.customerNumber ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-white/70">{row.contactPersonName ?? "—"}</td>
                        <td className="px-4 py-3 text-white/70">{row.email ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${typeBadgeClass(row.typeBadge.id)}`}
                          >
                            {row.typeBadge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-2 text-sm ${portalStatusTextClass(row.portalPill.tone)}`}
                          >
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${portalStatusDotClass(row.portalPill.tone)}`}
                              aria-hidden
                            />
                            {row.portalPill.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-white/55">
                          {formatNlDate(row.lastOrderAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums text-white/70">
                          <span title="Weergave uit demo-snapshot — geen wettelijk saldo">
                            {formatDisplaySaldo(row.outstandingMinor, row.outstandingSource)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <RowActionsMenu
                            companyId={row.companyId}
                            companyName={name}
                            canRemind={Boolean(row.pendingInviteEmail)}
                            reminderBusy={reminderBusy && selected}
                            onOpen={() => selectCompany(row)}
                            onAction={handleRowAction}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
          {page.status === "loading" && !panelProps ? (
            <p className="text-sm text-white/55">Details laden…</p>
          ) : page.status === "error" || !panelProps ? (
            <p className="text-sm text-white/55">Selecteer een klant om details te zien.</p>
          ) : (
            <SelectedCompanyPanel
              panel={panelProps}
              reminderBusy={reminderBusy}
              onClose={closePanel}
              onRemind={() => {
                if (selectedSnapshot) void sendReminder(selectedSnapshot);
              }}
            />
          )}
        </aside>
      </div>

      {page.status === "ok" && page.total > page.pageSize ? (
        <div className="flex items-center justify-between gap-3 text-sm text-white/60">
          <span>
            Pagina {page.page} van {pageCount} · {page.total} totaal
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="a-btn a-btn-secondary"
              disabled={page.page <= 1}
              onClick={() =>
                void navigate({ search: (prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }) })
              }
            >
              Vorige
            </button>
            <button
              type="button"
              className="a-btn a-btn-secondary"
              disabled={page.page >= pageCount}
              onClick={() =>
                void navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })
              }
            >
              Volgende
            </button>
          </div>
        </div>
      ) : null}

      <ImportHistoryStrip runs={page.status === "ok" ? page.importHistory : []} />

      <ServiceClientImportDialog
        open={serviceImportOpen}
        onClose={() => setServiceImportOpen(false)}
        onDone={(msg) => {
          setServiceImportOpen(false);
          setFlash(msg);
          void navigate({
            search: (prev) => ({ ...prev, tab: "service", page: 1 }),
          });
          refreshList();
        }}
      />

      <ConfirmationDialog
        open={deleteTarget !== null}
        title={deleteCopy.title}
        description={deleteCopy.description}
        confirmLabel={deleteCopy.confirmLabel}
        cancelLabel={deleteCopy.cancelLabel}
        tone="destructive"
        pending={deleteBusy}
        error={deleteError}
        onConfirm={() => void confirmDeleteRecord()}
        onCancel={cancelDeleteRecord}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  tone,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  delta: string;
  tone: "up" | "down" | "neutral";
  icon: typeof Users;
  accent: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <div
        className={`absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl`}
      />
      <div className="relative flex items-center justify-between">
        <div
          className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${accent} shadow-lg`}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        <span
          className={
            tone === "up"
              ? "inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-emerald-300"
              : tone === "down"
                ? "inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-rose-300"
                : "inline-flex items-center gap-1 rounded-full bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/55"
          }
        >
          {tone === "up" || tone === "down" ? (
            <TrendingUp className={`h-3.5 w-3.5 ${tone === "down" ? "rotate-180" : ""}`} />
          ) : null}
          {delta}
        </span>
      </div>
      <div className="relative mt-4">
        <div className="text-3xl font-bold tracking-tight tabular-nums">{value}</div>
        <div className="mt-1 text-sm text-white/55">{label}</div>
      </div>
    </div>
  );
}

function SelectedCompanyPanel({
  panel,
  reminderBusy,
  onClose,
  onRemind,
}: {
  panel: CustomerPanelProps;
  reminderBusy: boolean;
  onClose: () => void;
  onRemind: () => void;
}) {
  const companySearch = {
    tab: "service" as const,
    q: "",
    status: "all" as const,
    portalStatus: "all" as const,
    page: 1,
    companyId: panel.companyId,
  };
  return (
    <div className="relative space-y-5">
      <button
        type="button"
        className="absolute right-0 top-0 grid h-9 w-9 place-items-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white"
        onClick={onClose}
        aria-label="Sluit details"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="pr-10">
        <div
          className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-2xl bg-[#1e88e5]/20 text-lg font-bold tracking-wide text-[#8ec8f8]"
          aria-hidden
        >
          {panel.initials}
        </div>
        <h2 className="mt-4 font-display text-xl font-bold tracking-tight">{panel.name}</h2>
        <p className="mt-1 text-sm text-white/55">{panel.typeLabel}</p>
      </div>
      <dl className="space-y-3 text-sm">
        <DetailRow label="Klantnummer" value={panel.customerNumber ?? "—"} />
        <div className="flex justify-between gap-3">
          <dt className="text-white/45">Factuur toegestaan</dt>
          <dd className="inline-flex items-center gap-1.5 text-right text-white/85">
            {panel.invoiceAllowed ? (
              <>
                <Check className="h-4 w-4 text-emerald-400" aria-hidden />
                Ja
              </>
            ) : (
              "Nee"
            )}
          </dd>
        </div>
        <DetailRow label="KVK nummer" value={panel.kvkNumber ?? "—"} />
        <DetailRow label="BTW nummer" value={panel.vatNumber ?? "—"} />
        <div className="flex justify-between gap-3">
          <dt className="text-white/45">Adres</dt>
          <dd className="whitespace-pre-line text-right text-white/85">{panel.address}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-white/45">Uitgenodigde gebruikers</dt>
          <dd className="text-right text-white/85">{panel.invitedUserCount}</dd>
        </div>
        <div className="flex justify-end">
          <Link
            to="/customers/company/$companyId"
            params={{ companyId: panel.companyId }}
            search={companySearch}
            className="text-sm font-medium text-[#8ec8f8] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1e88e5]"
          >
            Gebruikers beheren →
          </Link>
        </div>
      </dl>
      <div className="flex flex-col gap-2">
        <Link
          to="/customers/company/$companyId"
          params={{ companyId: panel.companyId }}
          search={companySearch}
          className="a-btn a-btn-primary w-full"
        >
          Bekijk details →
        </Link>
        <button
          type="button"
          className="a-btn a-btn-secondary w-full"
          disabled={reminderBusy || !panel.pendingInviteEmail}
          onClick={onRemind}
        >
          <Mail className="h-4 w-4" aria-hidden />
          {reminderBusy ? "Versturen…" : "Stuur herinnering"}
        </button>
        <Link
          to="/customers/company/$companyId"
          params={{ companyId: panel.companyId }}
          search={companySearch}
          className="a-btn a-btn-secondary w-full"
        >
          <Settings className="h-4 w-4" aria-hidden />
          Beheer portaal
        </Link>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-white/45">{label}</dt>
      <dd className="text-right text-white/85">{value}</dd>
    </div>
  );
}

function ImportHistoryStrip({ runs }: { runs: ImportRun[] }) {
  return (
    <section
      className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4"
      aria-labelledby="klanten-import-heading"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="klanten-import-heading" className="text-sm font-semibold text-white/85">
            Importhistorie
          </h2>
          <p className="mt-0.5 text-xs text-white/45">
            Recente CSV-import van serviceklanten. Demorijen zijn geen productiedata.
          </p>
        </div>
        {runs.length === 0 ? (
          <p className="text-sm text-white/50">Nog geen imports.</p>
        ) : (
          <ul className="space-y-1 text-sm text-white/70">
            {runs.map((run) => (
              <li key={run.id}>
                <span className="font-medium text-white/85">{run.fileName}</span>
                {" · "}
                {formatNlDate(run.importedAt)}
                {" · "}
                {run.createdCount} nieuw / {run.updatedCount} bijgewerkt
                {run.skippedCount ? ` / ${run.skippedCount} overgeslagen` : ""}
                {run.source === "demo" ? " · demo" : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
