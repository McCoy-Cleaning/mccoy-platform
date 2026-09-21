import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  Ban,
  Box,
  Check,
  Clock,
  Crown,
  Loader2,
  Mail,
  Phone,
  Plus,
  RotateCcw,
  Search,
  Send,
  Shield,
  TrendingUp,
  Users,
  X,
} from "lucide-react";

import { AppDialog } from "@/components/admin/AppDialog";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { EmptyState } from "@/components/admin/EmptyState";
import { ErrorState } from "@/components/admin/ErrorState";
import { AdminFormField } from "@/components/admin/AdminFormField";
import { Button } from "@/components/ui/button";
import {
  inviteAdminPortalAccountAdmin,
  inviteAdminPortalAccountUser,
  resendAdminPortalInvitation,
  setAdminCustomerBlocked,
} from "@/lib/api/admin-customers.functions";
import { listAdminPortalUsers } from "@/lib/api/admin-users.functions";

import { UsersRowActionsMenu, type UserRowActionId } from "./components/UsersRowActionsMenu";
import {
  buildRegistrationTimeline,
  formatNlDate,
  formatNlDateTime,
  formatNlNumber,
  isAccountAdmin,
  mapPortalUserKpiCards,
  personInitials,
  portalUserStatusDotClass,
  portalUserStatusTextClass,
  selectedPortalUserRow,
  truncationNoticeNl,
  userDetailsParam,
  type PortalUserKpiCard,
  type PortalUserKpiIcon,
  type PortalUserRow,
  type PortalUserTimelineStep,
  type PortalUsersKpis,
  type PortalUsersTruncation,
} from "./lib/users-view";
import type { UsersSearch } from "./types/search";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      items: PortalUserRow[];
      companies: Array<{ id: string; name: string }>;
      total: number;
      page: number;
      pageSize: number;
      kpis: PortalUsersKpis;
      truncation: PortalUsersTruncation | null;
    };

type InviteForm = {
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: "account_admin" | "account_user";
};

const EMPTY_INVITE: InviteForm = {
  companyId: "",
  email: "",
  firstName: "",
  lastName: "",
  phone: "",
  role: "account_user",
};

export function UsersPage({ search }: { search: UsersSearch }) {
  const navigate = useNavigate({ from: "/users" });
  const goTo = useNavigate();
  const [page, setPage] = useState<PageState>({ status: "loading" });
  /** A follow-up read is in flight while results are already on screen. */
  const [refreshing, setRefreshing] = useState(false);
  const [listEpoch, setListEpoch] = useState(0);
  const [qDraft, setQDraft] = useState(search.q);
  const [flash, setFlash] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<PortalUserRow | null>(null);
  const [panelDismissed, setPanelDismissed] = useState(false);
  const panelDismissedRef = useRef(panelDismissed);
  panelDismissedRef.current = panelDismissed;

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>(EMPTY_INVITE);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [rightsOpen, setRightsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<PortalUserRow | null>(null);
  const [blockError, setBlockError] = useState<string | null>(null);
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(null);

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
    // Keep the current rows on screen while the next page loads, so searching and
    // paging do not collapse the table and reset the surrounding layout.
    setPage((prev) => (prev.status === "ok" ? prev : { status: "loading" }));
    setRefreshing(true);
    void listAdminPortalUsers({
      data: {
        q: search.q || undefined,
        companyId: search.companyId,
        page: search.page,
        pageSize: 25,
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
        companies: res.companies,
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
        kpis: res.kpis,
        truncation: res.truncation,
      });
      if (!panelDismissedRef.current) {
        const matched = selectedPortalUserRow(res.items, search.userId);
        setSelectedSnapshot((prev) => {
          if (matched) return matched;
          if (prev) {
            const stillVisible = selectedPortalUserRow(res.items, prev.id);
            return stillVisible ?? prev;
          }
          return res.items[0] ?? null;
        });
        const nextId = matched?.id ?? res.items[0]?.id;
        if (!search.userId && nextId) {
          void navigate({
            search: (prev) => ({ ...prev, userId: nextId }),
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
          : { status: "error", message: "Gebruikers konden niet worden geladen. Probeer het opnieuw." },
      );
    });
    return () => {
      cancelled = true;
    };
  }, [search.q, search.companyId, search.page, listEpoch, navigate]);

  useEffect(() => {
    if (page.status !== "ok" || !search.userId) return;
    const matched = selectedPortalUserRow(page.items, search.userId);
    if (!matched) return;
    setPanelDismissed(false);
    setSelectedSnapshot(matched);
  }, [search.userId, page]);

  const pageCount = page.status === "ok" ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;
  const selectedId = selectedSnapshot?.id ?? search.userId;
  const selected = selectedSnapshot && !panelDismissed ? selectedSnapshot : null;
  const timeline = selected ? buildRegistrationTimeline(selected) : [];
  const kpiCards = page.status === "ok" ? mapPortalUserKpiCards(page.kpis) : null;
  const companies = page.status === "ok" ? page.companies : [];
  const truncationNotice =
    page.status === "ok" ? truncationNoticeNl(page.truncation) : null;

  function selectUser(item: PortalUserRow) {
    setPanelDismissed(false);
    setSelectedSnapshot(item);
    void navigate({
      search: (prev) => ({ ...prev, userId: item.id }),
    });
  }

  function closePanel() {
    setPanelDismissed(true);
    setSelectedSnapshot(null);
    void navigate({
      search: (prev) => ({ ...prev, userId: undefined }),
    });
  }

  function openInvite(defaults?: Partial<InviteForm>) {
    setInviteForm({
      ...EMPTY_INVITE,
      companyId: defaults?.companyId ?? search.companyId ?? selected?.companyId ?? "",
      role: defaults?.role ?? "account_user",
    });
    setInviteError(null);
    setInviteOpen(true);
  }

  async function sendReminder(item: PortalUserRow) {
    if (!item.canRemind) {
      setUnavailableMessage("Herinnering sturen is alleen beschikbaar voor openstaande uitnodigingen.");
      return;
    }
    setActionBusy(true);
    const res = await resendAdminPortalInvitation({
      data: {
        companyId: item.companyId,
        email: item.email,
        intendedRole: item.accountType,
      },
    });
    setActionBusy(false);
    if (!res.ok) {
      setFlash(res.error);
      return;
    }
    setFlash("Herinnering verstuurd.");
    refreshList();
  }

  async function resetInvitation(item: PortalUserRow) {
    if (!item.canResetInvite) {
      setUnavailableMessage("Resetten is alleen beschikbaar voor openstaande uitnodigingen.");
      return;
    }
    setActionBusy(true);
    const res = await resendAdminPortalInvitation({
      data: {
        companyId: item.companyId,
        email: item.email,
        intendedRole: item.accountType,
      },
    });
    setActionBusy(false);
    if (!res.ok) {
      setFlash(res.error);
      return;
    }
    setFlash("Uitnodiging opnieuw verstuurd.");
    refreshList();
  }

  async function confirmBlock() {
    if (!blockTarget?.userId || actionBusy) return;
    setActionBusy(true);
    setBlockError(null);
    const res = await setAdminCustomerBlocked({
      data: { customerId: blockTarget.userId, blocked: !blockTarget.blocked },
    });
    setActionBusy(false);
    if (!res.ok) {
      setBlockError(res.error);
      return;
    }
    setFlash(blockTarget.blocked ? "Gebruiker gedeblokkeerd." : "Gebruiker geblokkeerd.");
    setBlockTarget(null);
    refreshList();
  }

  async function submitInvite() {
    if (actionBusy) return;
    if (!inviteForm.companyId) {
      setInviteError("Kies een bedrijf.");
      return;
    }
    if (!inviteForm.email.trim()) {
      setInviteError("Vul een e-mailadres in.");
      return;
    }
    setActionBusy(true);
    setInviteError(null);
    const payload = {
      companyId: inviteForm.companyId,
      email: inviteForm.email.trim(),
      firstName: inviteForm.firstName.trim() || null,
      lastName: inviteForm.lastName.trim() || null,
    };
    const res =
      inviteForm.role === "account_admin"
        ? await inviteAdminPortalAccountAdmin({ data: payload })
        : await inviteAdminPortalAccountUser({
            data: { ...payload, phone: inviteForm.phone.trim() || null },
          });
    setActionBusy(false);
    if (!res.ok) {
      setInviteError(res.error);
      return;
    }
    setInviteOpen(false);
    setFlash("Uitnodiging verstuurd.");
    refreshList();
  }

  function openUserDetails(item: PortalUserRow) {
    void goTo({
      to: "/users/$userId",
      params: { userId: userDetailsParam(item) },
      search: { q: "", companyId: undefined, userId: undefined, page: 1 },
    });
  }

  function handleRowAction(action: UserRowActionId, userId: string) {
    const item =
      page.status === "ok" ? selectedPortalUserRow(page.items, userId) : null;
    const target = item ?? (selectedSnapshot?.id === userId ? selectedSnapshot : null);
    if (target) selectUser(target);
    if (!target) return;
    if (action === "view") {
      openUserDetails(target);
      return;
    }
    if (action === "remind") {
      void sendReminder(target);
      return;
    }
    if (action === "reset") {
      void resetInvitation(target);
      return;
    }
    if (action === "block") {
      if (!target.canBlock) {
        setUnavailableMessage("Blokkeren is alleen beschikbaar voor geactiveerde accounts.");
        return;
      }
      setBlockError(null);
      setBlockTarget(target);
    }
  }

  function onHeaderInvite() {
    if (selected?.canRemind) {
      void sendReminder(selected);
      return;
    }
    openInvite();
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Gebruikers beheren
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-white/65 sm:text-base">
            Wie toegang heeft tot het klantportaal en de beheeromgeving. Elk bedrijf heeft één
            accounteigenaar en één of meer bestellers.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" className="a-btn a-btn-primary" onClick={() => openInvite()}>
            <Plus className="h-4 w-4" aria-hidden />
            Nieuwe gebruiker
          </button>
          <button type="button" className="a-btn a-btn-secondary" onClick={onHeaderInvite}>
            <Mail className="h-4 w-4" aria-hidden />
            Uitnodiging versturen
          </button>
          <button type="button" className="a-btn a-btn-secondary" onClick={() => setRightsOpen(true)}>
            <Shield className="h-4 w-4" aria-hidden />
            Rechtenoverzicht
          </button>
        </div>
      </header>

      {flash ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80" role="status">
          {flash}
        </p>
      ) : null}

      {truncationNotice ? (
        <p
          role="status"
          data-testid="users-truncation-notice"
          className="flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-50"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-hidden />
          <span>{truncationNotice}</span>
        </p>
      ) : null}

      <section aria-labelledby="gebruikers-kpis-heading">
        <h2 id="gebruikers-kpis-heading" className="sr-only">
          Gebruikersoverzicht
        </h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {(kpiCards ?? PLACEHOLDER_KPI_CARDS).map((card) => (
            <KpiCard key={card.id} card={card} valueReady={Boolean(kpiCards)} />
          ))}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
          <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold text-white/90">
              <Users className="h-5 w-5 text-white/50" aria-hidden />
              Alle gebruikers
              {page.status === "ok" ? (
                <span className="text-sm font-medium text-white/45">({page.total})</span>
              ) : null}
            </h2>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block min-w-0 w-full sm:w-64">
                <span className="sr-only">Zoeken in gebruikers</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  value={qDraft}
                  onChange={(event) => setQDraft(event.target.value)}
                  placeholder="Zoek op naam, e-mail of bedrijf"
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
              <label className="block sm:w-56">
                <span className="sr-only">Filter op bedrijf</span>
                <select
                  className="a-input w-full"
                  value={search.companyId ?? ""}
                  onChange={(event) =>
                    void navigate({
                      search: (prev) => ({
                        ...prev,
                        companyId: event.target.value || undefined,
                        page: 1,
                      }),
                    })
                  }
                >
                  <option value="">Alle bedrijven</option>
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Announces the outcome of a search, filter, or page change once it settles. */}
          <p role="status" aria-live="polite" className="sr-only">
            {refreshing || page.status !== "ok" ? "" : `${page.total} gebruikers gevonden.`}
          </p>

          {page.status === "loading" ? (
            // Placeholder rows reserve the table's footprint so the first real
            // page does not push the pagination strip down.
            <div role="status" aria-busy="true">
              <span className="sr-only">Gebruikers laden…</span>
              <div className="divide-y divide-white/5" aria-hidden>
                {Array.from({ length: 8 }, (_, index) => (
                  <div key={index} className="flex items-center gap-4 px-4 py-3.5">
                    <div className="h-4 flex-1 animate-pulse rounded bg-white/[0.06] motion-reduce:animate-none" />
                    <div className="h-4 w-40 animate-pulse rounded bg-white/[0.05] motion-reduce:animate-none" />
                    <div className="h-4 w-24 animate-pulse rounded bg-white/[0.05] motion-reduce:animate-none" />
                    <div className="h-4 w-20 animate-pulse rounded bg-white/[0.05] motion-reduce:animate-none" />
                  </div>
                ))}
              </div>
            </div>
          ) : page.status === "error" ? (
            <ErrorState title="Gebruikers laden mislukt" message={page.message} onRetry={refreshList} />
          ) : page.items.length === 0 ? (
            <EmptyState
              icon={Users}
              title={search.q || search.companyId ? "Geen treffers" : "Nog geen gebruikers"}
              description={
                search.q || search.companyId
                  ? "Pas de zoekterm of het bedrijfsfilter aan."
                  : "Nodig een accounteigenaar of besteller uit voor een bestaand bedrijf."
              }
              action={
                !search.q && !search.companyId ? (
                  <button type="button" className="a-btn a-btn-secondary" onClick={() => openInvite()}>
                    Nieuwe gebruiker
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
              <table className="min-w-[72rem] w-full text-left text-sm">
                <caption className="sr-only">Portaalgebruikers</caption>
                <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
                  <tr>
                    <th className="px-4 py-3 font-medium">Naam</th>
                    <th className="px-4 py-3 font-medium">E-mailadres</th>
                    <th className="px-4 py-3 font-medium">Bedrijf</th>
                    <th className="px-4 py-3 font-medium">Type account</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Laatste login</th>
                    <th className="px-4 py-3 font-medium">Laatste bestelling</th>
                    <th className="px-4 py-3 text-right font-medium">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {page.items.map((row) => {
                    const selectedRow = row.id === selectedId;
                    return (
                      <tr
                        key={row.id}
                        tabIndex={0}
                        aria-selected={selectedRow}
                        data-user-id={row.id}
                        className={
                          selectedRow
                            ? "cursor-pointer bg-[#1e88e5]/10 ring-1 ring-inset ring-sky-400/40"
                            : "cursor-pointer hover:bg-white/[0.03]"
                        }
                        onClick={() => selectUser(row)}
                        onKeyDown={(event) => {
                          if (event.target !== event.currentTarget) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            selectUser(row);
                          }
                        }}
                      >
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-3 text-left">
                            <span
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#1e88e5]/20 text-xs font-bold tracking-wide text-[#8ec8f8]"
                              aria-hidden
                            >
                              {personInitials(row.fullName)}
                            </span>
                            <span className="truncate font-medium text-white/90">{row.fullName}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white/70">{row.email}</td>
                        <td className="px-4 py-3 text-white/70">{row.companyName}</td>
                        <td className="px-4 py-3">
                          <AccountTypeLabel type={row.accountType} label={row.accountTypeLabel} />
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-2 text-sm ${portalUserStatusTextClass(row.status.tone)}`}
                          >
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full ${portalUserStatusDotClass(row.status.tone)}`}
                              aria-hidden
                            />
                            {row.status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-white/55">
                          {formatNlDate(row.lastLoginAt)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-white/55">
                          {formatNlDate(row.lastOrderAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <UsersRowActionsMenu
                            userId={row.id}
                            userName={row.fullName}
                            canRemind={row.canRemind}
                            canReset={row.canResetInvite}
                            canBlock={row.canBlock}
                            blocked={row.blocked}
                            reminderBusy={actionBusy && selectedRow}
                            onOpen={() => selectUser(row)}
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
        </section>

        <aside className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
          {page.status === "loading" && !selected ? (
            <p className="text-sm text-white/55">Details laden…</p>
          ) : page.status === "error" || !selected ? (
            <p className="text-sm text-white/55">Selecteer een gebruiker om details te zien.</p>
          ) : (
            <SelectedUserPanel
              user={selected}
              busy={actionBusy}
              onClose={closePanel}
              onViewDetails={() => openUserDetails(selected)}
              onRemind={() => void sendReminder(selected)}
              onBlock={() => handleRowAction("block", selected.id)}
              onReset={() => void resetInvitation(selected)}
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

      <section
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
        aria-labelledby="registratiestatus-heading"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="registratiestatus-heading" className="text-base font-semibold text-white/90">
              Registratiestatus
            </h2>
            <p className="mt-1 text-sm text-white/50">
              Volg de registratie en uitnodigingen van deze gebruiker.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-medium text-[#8ec8f8] transition hover:text-white disabled:opacity-40"
            disabled={!selected}
            onClick={() => setHistoryOpen(true)}
          >
            Bekijk volledige historie
            <span aria-hidden>→</span>
          </button>
        </div>
        {selected ? <RegistrationTimeline steps={timeline} /> : null}
      </section>

      <AppDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title="Nieuwe gebruiker uitnodigen"
        description="Stuurt een portaalinuitnodiging naar het gekozen bedrijf. Per bedrijf is er één actieve accounteigenaar."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setInviteOpen(false)} disabled={actionBusy}>
              Annuleren
            </Button>
            <Button type="button" loading={actionBusy} onClick={() => void submitInvite()}>
              Uitnodiging versturen
            </Button>
          </>
        }
      >
        <div className="grid gap-4">
          <AdminFormField label="Bedrijf">
            <select
              className="a-input w-full"
              value={inviteForm.companyId}
              onChange={(event) => setInviteForm((prev) => ({ ...prev, companyId: event.target.value }))}
            >
              <option value="">Kies een bedrijf</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
          </AdminFormField>
          <AdminFormField label="E-mailadres">
            <input
              type="email"
              className="a-input w-full"
              value={inviteForm.email}
              onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
            />
          </AdminFormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <AdminFormField label="Voornaam">
              <input
                className="a-input w-full"
                value={inviteForm.firstName}
                onChange={(event) => setInviteForm((prev) => ({ ...prev, firstName: event.target.value }))}
              />
            </AdminFormField>
            <AdminFormField label="Achternaam">
              <input
                className="a-input w-full"
                value={inviteForm.lastName}
                onChange={(event) => setInviteForm((prev) => ({ ...prev, lastName: event.target.value }))}
              />
            </AdminFormField>
          </div>
          <AdminFormField label="Telefoon (optioneel)">
            <input
              className="a-input w-full"
              value={inviteForm.phone}
              onChange={(event) => setInviteForm((prev) => ({ ...prev, phone: event.target.value }))}
            />
          </AdminFormField>
          <AdminFormField label="Type account">
            <select
              className="a-input w-full"
              value={inviteForm.role}
              onChange={(event) =>
                setInviteForm((prev) => ({
                  ...prev,
                  role: event.target.value as InviteForm["role"],
                }))
              }
            >
              <option value="account_user">Besteller</option>
              <option value="account_admin">Accountbeheerder</option>
            </select>
          </AdminFormField>
          {inviteError ? (
            <p role="alert" className="text-sm text-red-300">
              {inviteError}
            </p>
          ) : null}
        </div>
      </AppDialog>

      <AppDialog
        open={rightsOpen}
        onOpenChange={setRightsOpen}
        title="Rechtenoverzicht"
        description="Portaalrollen zoals ze nu server-side worden afgedwongen. Een volledig rechtenmatrix-product volgt later."
        footer={
          <Button type="button" variant="outline" onClick={() => setRightsOpen(false)}>
            Sluiten
          </Button>
        }
      >
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-semibold text-white/90">Accountbeheerder</dt>
            <dd className="mt-1 text-white/60">
              Eén actieve eigenaar per bedrijf. Beheert gebruikers en bedrijfsgegevens in het
              klantportaal.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-white/90">Besteller</dt>
            <dd className="mt-1 text-white/60">
              Kan bestellingen plaatsen. Heeft geen beheer over andere gebruikers of
              bedrijfsinstellingen.
            </dd>
          </div>
        </dl>
      </AppDialog>

      <AppDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        title="Registratiehistorie"
        description={
          selected
            ? `Bekende uitnodigingsstappen voor ${selected.fullName}.`
            : "Geen gebruiker geselecteerd."
        }
        footer={
          <Button type="button" variant="outline" onClick={() => setHistoryOpen(false)}>
            Sluiten
          </Button>
        }
      >
        {selected ? (
          <ol className="space-y-3 text-sm">
            {timeline.map((step) => (
              <li key={step.id} className="flex justify-between gap-3">
                <span className="text-white/80">{step.label}</span>
                <span className="text-white/50">{formatNlDate(step.at)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-white/55">Geen historie beschikbaar.</p>
        )}
      </AppDialog>

      <ConfirmationDialog
        open={blockTarget !== null}
        title={blockTarget?.blocked ? "Gebruiker deblokkeren?" : "Gebruiker blokkeren?"}
        description={
          blockTarget
            ? blockTarget.blocked
              ? `${blockTarget.fullName} krijgt weer toegang tot het klantportaal.`
              : `${blockTarget.fullName} verliest toegang tot het klantportaal.`
            : ""
        }
        confirmLabel={blockTarget?.blocked ? "Deblokkeren" : "Blokkeren"}
        tone="destructive"
        pending={actionBusy}
        error={blockError}
        onConfirm={() => void confirmBlock()}
        onCancel={() => {
          if (actionBusy) return;
          setBlockTarget(null);
          setBlockError(null);
        }}
      />

      <ConfirmationDialog
        open={unavailableMessage !== null}
        title="Actie niet beschikbaar"
        description={unavailableMessage ?? ""}
        confirmLabel="Sluiten"
        cancelLabel="Annuleren"
        onConfirm={() => setUnavailableMessage(null)}
        onCancel={() => setUnavailableMessage(null)}
      />
    </div>
  );
}

const PLACEHOLDER_KPI_CARDS = mapPortalUserKpiCards({
  activeUsers: 0,
  awaitingActivation: 0,
  accountAdmins: 0,
  orderers: 0,
  activeCreatedLast7Days: 0,
  activeCreatedPrevious7Days: 0,
});

const KPI_ICONS: Record<PortalUserKpiIcon, typeof Users> = {
  users: Users,
  clock: Clock,
  shield: Shield,
  box: Box,
};

function KpiCard({ card, valueReady }: { card: PortalUserKpiCard; valueReady: boolean }) {
  const Icon = KPI_ICONS[card.icon];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-11 w-11 place-items-center rounded-xl ${card.well}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
        {card.trend ? (
          <span
            className={
              card.tone === "up"
                ? "inline-flex items-center gap-1 text-sm font-semibold text-emerald-400"
                : card.tone === "down"
                  ? "inline-flex items-center gap-1 text-sm font-semibold text-rose-400"
                  : "inline-flex items-center gap-1 text-sm font-semibold text-white/55"
            }
          >
            {card.tone === "up" || card.tone === "down" ? (
              <TrendingUp className={`h-3.5 w-3.5 ${card.tone === "down" ? "rotate-180" : ""}`} />
            ) : null}
            {card.trend}
          </span>
        ) : null}
      </div>
      <div className="mt-4">
        <div className="text-sm text-white/55">{card.label}</div>
        <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
          {valueReady ? formatNlNumber(card.value) : "—"}
        </div>
        <div className="mt-1 text-sm text-white/45">{card.helper}</div>
      </div>
    </div>
  );
}

function AccountTypeLabel({
  type,
  label,
}: {
  type: PortalUserRow["accountType"];
  label: PortalUserRow["accountTypeLabel"];
}) {
  if (isAccountAdmin(type)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-white/90">
        <Crown
          className="h-4 w-4 fill-amber-400 text-amber-400"
          aria-hidden
          data-sigil="account-admin-crown"
        />
        {label}
      </span>
    );
  }
  return <span className="text-sm text-white/80">{label}</span>;
}

function StatusBadge({ status }: { status: PortalUserRow["status"] }) {
  if (status.id === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400">
        <Check className="h-3.5 w-3.5" aria-hidden />
        Actief
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-2 text-sm ${portalUserStatusTextClass(status.tone)}`}>
      <span className={`h-2 w-2 rounded-full ${portalUserStatusDotClass(status.tone)}`} aria-hidden />
      {status.label}
    </span>
  );
}

function SelectedUserPanel({
  user,
  busy,
  onClose,
  onViewDetails,
  onRemind,
  onBlock,
  onReset,
}: {
  user: PortalUserRow;
  busy: boolean;
  onClose: () => void;
  onViewDetails: () => void;
  onRemind: () => void;
  onBlock: () => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-base font-semibold text-white/90">Gebruikersdetails</h2>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white"
          onClick={onClose}
          aria-label="Sluit details"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-4">
        <div
          className="grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-full bg-[#1e88e5]/20 text-lg font-bold tracking-wide text-[#8ec8f8]"
          aria-hidden
        >
          {personInitials(user.fullName)}
        </div>
        <div className="min-w-0">
          <p className="font-display text-xl font-bold tracking-tight">{user.fullName}</p>
          <div className="mt-1.5">
            <StatusBadge status={user.status} />
          </div>
        </div>
      </div>
      <div className="space-y-2 text-sm text-white/70">
        <p className="flex items-center gap-2">
          <Mail className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
          <span className="truncate">{user.email}</span>
        </p>
        <p className="flex items-center gap-2">
          <Phone className="h-4 w-4 shrink-0 text-white/40" aria-hidden />
          <span>{user.phone ?? "—"}</span>
        </p>
      </div>
      <dl className="space-y-3 text-sm">
        <DetailRow label="Bedrijf" value={user.companyName} />
        <div className="flex items-center justify-between gap-3">
          <dt className="text-white/45">Type account</dt>
          <dd>
            <AccountTypeLabel type={user.accountType} label={user.accountTypeLabel} />
          </dd>
        </div>
        <DetailRow label="Uitgenodigd door" value={user.invitedByName ?? "—"} />
        <DetailRow label="Uitgenodigd op" value={formatNlDate(user.invitedAt)} />
        <DetailRow label="Uitnodiging verloopt op" value={formatNlDate(user.invitationExpiresAt)} />
        <DetailRow label="Laatste login" value={formatNlDate(user.lastLoginAt)} />
        <DetailRow label="Laatste bestelling" value={formatNlDate(user.lastOrderAt)} />
      </dl>
      <div className="flex flex-col gap-2">
        <button type="button" className="a-btn a-btn-primary w-full" onClick={onViewDetails}>
          Bekijk details
        </button>
        <button
          type="button"
          className="a-btn a-btn-secondary w-full"
          disabled={busy || !user.canRemind}
          onClick={onRemind}
        >
          <Send className="h-4 w-4" aria-hidden />
          {busy ? "Versturen…" : "Herinnering sturen"}
        </button>
        <button
          type="button"
          className="a-btn a-btn-danger w-full"
          disabled={busy || !user.canBlock}
          onClick={onBlock}
        >
          <Ban className="h-4 w-4" aria-hidden />
          {user.blocked ? "Deblokkeren" : "Blokkeren"}
        </button>
        <button
          type="button"
          className="a-btn a-btn-secondary w-full"
          disabled={busy || !user.canResetInvite}
          onClick={onReset}
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
          Resetten uitnodiging
        </button>
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

function RegistrationTimeline({ steps }: { steps: PortalUserTimelineStep[] }) {
  return (
    <ol className="relative mt-8 grid gap-6 sm:grid-cols-3" data-testid="registration-timeline">
      <span
        className="pointer-events-none absolute left-[16.666%] right-[16.666%] top-4 hidden h-px bg-white/20 sm:block"
        aria-hidden
      />
      {steps.map((step, index) => {
        const done = step.state === "done";
        return (
          <li
            key={step.id}
            data-timeline-step={step.id}
            data-timeline-state={step.state}
            className="relative flex gap-3 sm:flex-col sm:items-center sm:text-center"
          >
            {index < steps.length - 1 ? (
              <span
                className="absolute left-[0.95rem] top-8 h-[calc(100%-0.5rem)] w-px bg-white/15 sm:hidden"
                aria-hidden
              />
            ) : null}
            <span
              className={
                done
                  ? "relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1e88e5] text-white shadow-[0_0_0_4px_rgba(30,136,229,0.18)]"
                  : "relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-white/30 bg-[#0c1220] text-xs font-semibold text-white/55"
              }
              data-timeline-marker={done ? "check" : "number"}
              aria-hidden
            >
              {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : index + 1}
            </span>
            <div className="min-w-0 pb-2 sm:pb-0">
              <p className="font-medium text-white/90">{step.label}</p>
              {done ? (
                <>
                  <p className="mt-1 text-sm text-white/50">{formatNlDateTime(step.at)}</p>
                  {step.detail ? <p className="mt-0.5 text-sm text-white/45">{step.detail}</p> : null}
                </>
              ) : step.detail ? (
                <p className="mt-1 text-sm text-white/50">{step.detail}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
