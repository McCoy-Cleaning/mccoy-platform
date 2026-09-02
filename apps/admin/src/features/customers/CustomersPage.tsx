import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Download,
  Loader2,
  Search,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { formatMoneyMinor } from "@mccoy/domain";

import { PageHeader } from "@/components/admin/AdminBits";
import { EmptyState } from "@/components/admin/EmptyState";
import { ErrorState } from "@/components/admin/ErrorState";
import { AppDialog } from "@/components/admin/AppDialog";
import { Button } from "@/components/ui/button";
import {
  deleteAdminPortalCompanies,
  exportAdminCustomers,
  importAdminExistingServiceClients,
  listAdminCustomers,
  listAdminPortalCompanies,
  seedAdminCommerceFixtures,
} from "@/lib/api/admin-customers.functions";
import type { CustomersSearch } from "./types/search";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      population: "guests" | "portal";
      items: Array<Record<string, unknown>>;
      total: number;
      page: number;
      pageSize: number;
    };

export function CustomersPage({ search }: { search: CustomersSearch }) {
  const navigate = useNavigate({ from: "/customers" });
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [listEpoch, setListEpoch] = useState(0);
  const [qDraft, setQDraft] = useState(search.q);
  const [serviceImportOpen, setServiceImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

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
    setList({ status: "loading" });
    const load =
      search.tab === "portal"
        ? listAdminPortalCompanies({
            data: {
              q: search.q || undefined,
              portalStatus:
                search.portalStatus !== "all" ? search.portalStatus : undefined,
              page: search.page,
              pageSize: 25,
            },
          }).then((res) => {
            if (cancelled) return;
            if (!res.ok) {
              setList({ status: "error", message: res.error });
              return;
            }
            setList({
              status: "ok",
              population: "portal",
              items: res.items as Array<Record<string, unknown>>,
              total: res.total,
              page: res.page,
              pageSize: res.pageSize,
            });
          })
        : listAdminCustomers({
            data: {
              population: "guests",
              q: search.q || undefined,
              page: search.page,
              pageSize: 25,
              sort: "created",
              order: "desc",
            },
          }).then((res) => {
            if (cancelled) return;
            if (!res.ok) {
              setList({ status: "error", message: res.error });
              return;
            }
            setList({
              status: "ok",
              population: "guests",
              items: res.items as Array<Record<string, unknown>>,
              total: res.total,
              page: res.page,
              pageSize: res.pageSize,
            });
          });
    void load;
    return () => {
      cancelled = true;
    };
  }, [search.tab, search.q, search.portalStatus, search.page, listEpoch]);

  const pageCount =
    list.status === "ok" ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={Building2}
        accent="#22c55e"
        title="Klanten"
        subtitle="Serviceklanten (CSV-import én zelfregistratie) en gasten die hebben gekocht — los van website-aanvragen."
        actions={[
          {
            label: "Exporteren",
            icon: Download,
            onClick: () => {
              void (async () => {
                setBusy(true);
                if (search.tab === "portal") {
                  const res = await listAdminPortalCompanies({
                    data: {
                      q: search.q || undefined,
                      portalStatus:
                        search.portalStatus !== "all" ? search.portalStatus : undefined,
                      page: 1,
                      pageSize: 100,
                    },
                  });
                  setBusy(false);
                  if (!res.ok) {
                    setFlash(res.error);
                    return;
                  }
                  const header =
                    "company_id,legal_name,display_name,klantsoort,portaalstatus,external_customer_id,account_admin_email,active_users,pending_invites";
                  const lines = [
                    header,
                    ...res.items.map((row) =>
                      [
                        row.companyId,
                        csvEscape(String(row.legalName ?? "")),
                        csvEscape(String(row.displayName ?? "")),
                        csvEscape(String(row.partyTypeLabel ?? row.partyType ?? "")),
                        csvEscape(String(row.portalStatusLabel ?? row.portalStatus ?? "")),
                        csvEscape(String(row.externalCustomerId ?? "")),
                        csvEscape(String(row.accountAdminEmail ?? "")),
                        String(row.activeUserCount ?? 0),
                        String(row.pendingInviteCount ?? 0),
                      ].join(","),
                    ),
                  ];
                  const blob = new Blob([`\uFEFF${lines.join("\n")}\n`], {
                    type: "text/csv;charset=utf-8",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "mccoy-serviceklanten.csv";
                  a.click();
                  URL.revokeObjectURL(url);
                  return;
                }
                const res = await exportAdminCustomers({
                  data: {
                    population: "guests",
                    q: search.q || undefined,
                  },
                });
                setBusy(false);
                if (!res.ok) {
                  setFlash(res.error);
                  return;
                }
                const blob = new Blob([res.csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "mccoy-gastkopers.csv";
                a.click();
                URL.revokeObjectURL(url);
              })();
            },
          },
          {
            label: "Serviceklanten importeren",
            icon: Upload,
            onClick: () => setServiceImportOpen(true),
          },
        ]}
      />

      {flash ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80" role="status">
          {flash}
        </p>
      ) : null}

      <div
        role="tablist"
        aria-label="Klantpopulatie"
        className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5"
      >
        {(
          [
            { id: "portal" as const, label: "Serviceklanten (portaal)" },
            { id: "guests" as const, label: "Gasten die hebben gekocht" },
          ] as const
        ).map((tab) => {
          const selected = search.tab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={
                selected
                  ? "rounded-xl bg-[#22c55e]/25 px-4 py-2.5 text-sm font-semibold text-white"
                  : "rounded-xl px-4 py-2.5 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white/85"
              }
              onClick={() =>
                void navigate({
                  search: {
                    tab: tab.id,
                    q: search.q,
                    status: "all",
                    portalStatus: "all",
                    page: 1,
                  },
                })
              }
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Zoeken</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={qDraft}
            onChange={(e) => setQDraft(e.target.value)}
            placeholder="Zoek op naam, e-mail, bedrijf of telefoon"
            className="a-input w-full pl-10"
          />
        </label>
        {search.tab === "portal" ? (
          <label className="flex items-center gap-2 text-sm text-white/70">
            <span>Portaal</span>
            <select
              className="a-input"
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
              <option value="active">Actief (ingelogd / geactiveerd)</option>
              <option value="registration_required">Registratie nodig (nog geen uitnodiging)</option>
              <option value="invited">Uitgenodigd (wacht op activatie)</option>
              <option value="reminder_sent">Herinnering verstuurd</option>
              <option value="invite_expired">Link verlopen</option>
              <option value="suspended">Opgeschort</option>
            </select>
          </label>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
        {list.status === "loading" ? (
          <div className="flex items-center gap-3 p-10 text-white/60" aria-busy="true">
            <Loader2 className="h-5 w-5 animate-spin" />
            Klanten laden…
          </div>
        ) : list.status === "error" ? (
          <ErrorState title="Klanten laden mislukt" message={list.message} />
        ) : list.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={
              search.q
                ? "Geen treffers"
                : search.tab === "guests"
                  ? "Nog geen gastkopers"
                  : "Nog geen serviceklanten"
            }
            description={
              search.q
                ? "Pas de zoekterm of filters aan."
                : search.tab === "guests"
                  ? "Gastkopers verschijnen hier zodra er orders zonder gekoppelde klantaccount bestaan (checkout, import of testfixtures)."
                  : "Importeer bestaande klanten via CSV of wacht tot bedrijven zichzelf registreren. Portaalstatus toont wie al is geactiveerd en wie nog moet registreren."
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
                        setFlash(`Fixtures geladen (${res.emails.length} e-mails).`);
                        refreshList();
                      }
                    })();
                  }}
                >
                  Testfixtures laden
                </button>
              ) : undefined
            }
          />
        ) : search.tab === "portal" ? (
          <PortalCompaniesTable
            items={list.items}
            onDeleted={(msg) => {
              setFlash(msg);
              refreshList();
            }}
          />
        ) : (
          <GuestsTable items={list.items} />
        )}
      </div>

      {list.status === "ok" && list.total > list.pageSize ? (
        <div className="flex items-center justify-between gap-3 text-sm text-white/60">
          <span>
            Pagina {list.page} van {pageCount} · {list.total} totaal
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="a-btn a-btn-secondary"
              disabled={list.page <= 1}
              onClick={() =>
                void navigate({ search: (prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }) })
              }
            >
              Vorige
            </button>
            <button
              type="button"
              className="a-btn a-btn-secondary"
              disabled={list.page >= pageCount}
              onClick={() =>
                void navigate({ search: (prev) => ({ ...prev, page: prev.page + 1 }) })
              }
            >
              Volgende
            </button>
          </div>
        </div>
      ) : null}

      <ServiceClientImportDialog
        open={serviceImportOpen}
        onClose={() => setServiceImportOpen(false)}
        onDone={(msg) => {
          setServiceImportOpen(false);
          setFlash(msg);
          void navigate({
            search: (prev) => ({ ...prev, tab: "portal", page: 1 }),
          });
          // Always bump epoch: navigate alone is a no-op when already on portal/page 1.
          refreshList();
        }}
      />
    </div>
  );
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function PortalCompaniesTable({
  items,
  onDeleted,
}: {
  items: Array<Record<string, unknown>>;
  onDeleted: (msg: string) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allIds = items.map((row) => String(row.companyId));
  const allIdsKey = allIds.join("|");
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  useEffect(() => {
    // Prune selection when the visible company set changes — do not close confirm dialog.
    setSelected((prev) => new Set([...prev].filter((id) => allIds.includes(id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by stable id list
  }, [allIdsKey]);

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      if (allIds.every((id) => prev.has(id))) return new Set();
      return new Set(allIds);
    });
  }

  function askDelete(ids: string[]) {
    if (!ids.length) return;
    setPendingIds(ids);
    setError(null);
    setConfirmOpen(true);
  }

  async function confirmDelete() {
    if (!pendingIds.length) return;
    setBusy(true);
    setError(null);
    try {
      const res = await deleteAdminPortalCompanies({ data: { companyIds: pendingIds } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const failedMessages = res.results
        .filter(
          (r): r is Extract<(typeof res.results)[number], { ok: false }> => !r.ok,
        )
        .map((r) => r.error);
      if (res.deleted === 0) {
        setError(failedMessages[0] || "Verwijderen mislukt.");
        return;
      }
      setConfirmOpen(false);
      setPendingIds([]);
      setSelected(new Set());
      const extra = failedMessages.length ? ` Mislukt: ${failedMessages.slice(0, 3).join("; ")}` : "";
      onDeleted(`Verwijderd: ${res.deleted} · mislukt: ${res.failed}.${extra}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  const pendingLabel =
    pendingIds.length === 1
      ? items.find((r) => String(r.companyId) === pendingIds[0])?.legalName
      : null;

  return (
    <div className="space-y-3">
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm">
          <span className="text-white/75">{selected.size} geselecteerd</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-red-500/30 text-red-200 hover:bg-red-500/10"
            onClick={() => askDelete([...selected])}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden />
            Bulk verwijderen
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/20 bg-transparent"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Selecteer alle serviceklanten op deze pagina"
                />
              </th>
              <th className="px-4 py-3 font-medium">Klant</th>
              <th className="px-4 py-3 font-medium">Klantsoort</th>
              <th className="px-4 py-3 font-medium">Portaalstatus</th>
              <th className="px-4 py-3 font-medium">Accountbeheerder</th>
              <th className="px-4 py-3 font-medium">Gebruikers</th>
              <th className="px-4 py-3 font-medium">Uitnodigingen</th>
              <th className="px-4 py-3 font-medium">Acties</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map((row) => {
              const id = String(row.companyId);
              return (
                <tr key={id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-white/20 bg-transparent"
                      checked={selected.has(id)}
                      onChange={() => toggleOne(id)}
                      aria-label={`Selecteer ${String(row.legalName)}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to="/customers/company/$companyId"
                      params={{ companyId: id }}
                      search={{ tab: "portal", q: "", status: "all", portalStatus: "all", page: 1 }}
                      className="block rounded-lg -mx-2 px-2 py-1 font-medium text-white/90 hover:bg-white/5 hover:underline"
                    >
                      {String(row.displayName || row.legalName)}
                      <div className="text-xs font-normal text-white/45 no-underline">
                        {String(row.legalName)}
                        {row.externalCustomerId
                          ? ` · #${String(row.externalCustomerId)}`
                          : ""}
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {String(row.partyTypeLabel ?? (row.partyType === "private_person" ? "Particulier" : "Bedrijf"))}
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/75">
                      {String(row.portalStatusLabel)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/70">
                    {row.accountAdminName
                      ? `${String(row.accountAdminName)} (${String(row.accountAdminEmail)})`
                      : "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-white/70">
                    {Number(row.activeUserCount)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-white/70">
                    {Number(row.pendingInviteCount)}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 text-red-200 hover:bg-red-500/10"
                      onClick={() => askDelete([id])}
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                      Verwijderen
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <AppDialog
        open={confirmOpen}
        onOpenChange={(v) => {
          if (!v && !busy) {
            setConfirmOpen(false);
            setPendingIds([]);
            setError(null);
          }
        }}
        title={pendingIds.length === 1 ? "Serviceklant verwijderen" : "Serviceklanten verwijderen"}
        description={
          pendingIds.length === 1
            ? `Weet je zeker dat je “${String(pendingLabel ?? "dit bedrijf")}” wilt verwijderen? Uitnodigingen en lidmaatschappen verdwijnen. Bedrijven met orders kunnen niet worden verwijderd.`
            : `Weet je zeker dat je ${pendingIds.length} serviceklanten wilt verwijderen? Uitnodigingen en lidmaatschappen verdwijnen. Bedrijven met orders worden overgeslagen.`
        }
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setConfirmOpen(false);
                setPendingIds([]);
                setError(null);
              }}
            >
              Annuleren
            </Button>
            <Button
              type="button"
              loading={busy}
              className="bg-red-600 text-white hover:bg-red-500"
              onClick={() => void confirmDelete()}
            >
              Verwijderen
            </Button>
          </>
        }
      >
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </AppDialog>
    </div>
  );
}

function GuestsTable({ items }: { items: Array<Record<string, unknown>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
          <tr>
            <th className="px-4 py-3 font-medium">Gast</th>
            <th className="px-4 py-3 font-medium">Bedrijf</th>
            <th className="px-4 py-3 font-medium">Orders</th>
            <th className="px-4 py-3 font-medium">Omzet</th>
            <th className="px-4 py-3 font-medium">Conversie</th>
            <th className="px-4 py-3 font-medium">Laatste aankoop</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {items.map((row) => {
            const id = String(row.id);
            const collision = row.collidingCustomerId ? "Bestaande klant" : "Uitnodigen";
            return (
              <tr key={id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <Link
                    to="/customers/guest/$guestId"
                    params={{ guestId: id }}
                    search={{ tab: "guests", q: "", status: "all", portalStatus: "all", page: 1 }}
                    className="font-medium text-white/90 hover:underline"
                  >
                    {String(row.fullName || row.email)}
                  </Link>
                  <div className="text-xs text-white/45">{String(row.email)}</div>
                </td>
                <td className="px-4 py-3 text-white/70">{String(row.companyName || "—")}</td>
                <td className="px-4 py-3 tabular-nums text-white/70">{Number(row.orderCount)}</td>
                <td className="px-4 py-3 tabular-nums text-white/70">
                  {formatMoneyMinor(Number(row.totalSpendMinor) || 0)}
                </td>
                <td className="px-4 py-3 text-white/70">{collision}</td>
                <td className="px-4 py-3 text-white/55">
                  {row.lastOrderAt
                    ? new Date(String(row.lastOrderAt)).toLocaleDateString("nl-NL")
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}


type ServicePreview = {
  fileName: string;
  sheetName: string | null;
  headers: string[];
  sheetNames: string[];
  totalRows: number;
  counts: {
    new: number;
    update: number;
    unchanged: number;
    invalid: number;
    conflict: number;
  };
  inviteCounts: {
    willInvite: number;
    missingEmail: number;
    skippedNotNew: number;
  };
  importableCount: number;
  rows: Array<{
    sourceRowNumber: number;
    externalCustomerId: string | null;
    companyName: string | null;
    classification: string;
    reason: string | null;
    autoInvitePlan: string;
  }>;
};

function classificationLabelNl(c: string): string {
  if (c === "NEW") return "Nieuw";
  if (c === "UPDATE") return "Bijwerken";
  if (c === "UNCHANGED") return "Ongewijzigd";
  if (c === "INVALID") return "Ongeldig";
  if (c === "CONFLICT") return "Conflict";
  return c;
}

function autoInviteLabelNl(plan: string): string {
  if (plan === "will_invite") return "Uitnodiging Account Admin";
  if (plan === "missing_email") return "Geen e-mail (geen uitnodiging)";
  return "Geen auto-uitnodiging";
}

function ServiceClientImportDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [sheetName, setSheetName] = useState<string>("");
  const [preview, setPreview] = useState<ServicePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mapId, setMapId] = useState("");
  const [mapName, setMapName] = useState("");

  useEffect(() => {
    if (!open) {
      setFileName(null);
      setFileBase64(null);
      setSheetName("");
      setPreview(null);
      setError(null);
      setMapId("");
      setMapName("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  async function readFile(file: File) {
    setError(null);
    setPreview(null);
    if (file.size > 2_000_000) {
      setError("Bestand te groot (max 2 MB).");
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx") && !lower.endsWith(".txt")) {
      setError("Alleen .csv of .xlsx wordt ondersteund.");
      return;
    }
    const buf = await file.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
    const b64 = btoa(binary);
    setFileName(file.name);
    setFileBase64(b64);
  }

  async function runPreview(nextSheet?: string) {
    if (!fileName || !fileBase64) {
      setError("Kies eerst een bestand.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await importAdminExistingServiceClients({
      data: {
        fileName,
        fileBase64,
        commit: false,
        sheetName: (nextSheet ?? sheetName) || null,
        columnMap: {
          ...(mapId.trim() ? { externalCustomerId: mapId.trim() } : {}),
          ...(mapName.trim() ? { legalName: mapName.trim() } : {}),
        },
      },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setPreview(null);
      return;
    }
    if (res.mode === "preview") {
      setPreview(res.preview as ServicePreview);
      if (!sheetName && res.preview.sheetName) setSheetName(res.preview.sheetName);
    }
  }

  async function runCommit() {
    if (!fileName || !fileBase64) return;
    setBusy(true);
    setError(null);
    const res = await importAdminExistingServiceClients({
      data: {
        fileName,
        fileBase64,
        commit: true,
        sheetName: sheetName || null,
        columnMap: {
          ...(mapId.trim() ? { externalCustomerId: mapId.trim() } : {}),
          ...(mapName.trim() ? { legalName: mapName.trim() } : {}),
        },
      },
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (res.mode === "commit") {
      onDone(
        `Serviceklanten import: ${res.mirrored} naar mirror, sync ${res.sync.created} nieuw / ${res.sync.updated} bijgewerkt. Uitnodigingen: ${res.invites.sent} verstuurd / ${res.invites.skipped} overgeslagen / ${res.invites.failed} mislukt. Ongeldig ${res.skippedInvalid}, conflict ${res.skippedConflict}.`,
      );
    }
  }

  const problemRows =
    preview?.rows.filter((r) => r.classification === "INVALID" || r.classification === "CONFLICT") ??
    [];

  return (
    <AppDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Serviceklanten importeren"
      description="CSV of Excel → voorvertoning → mirror → sync. Vul Klantsoort in (bedrijf of particulier). Nieuwe rijen met e-mail krijgen automatisch één Account Admin-uitnodiging. Identiteit = klantnummer."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            Annuleren
          </Button>
          {!preview ? (
            <Button type="button" loading={busy} onClick={() => void runPreview()} disabled={!fileBase64}>
              Voorvertoning
            </Button>
          ) : (
            <Button
              type="button"
              loading={busy}
              onClick={() => void runCommit()}
              disabled={preview.importableCount === 0}
            >
              Importeer geldige rijen ({preview.importableCount})
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3 text-sm text-white/80">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm font-medium text-white/90">Sjabloon CSV</p>
          <p className="mt-1 text-xs text-white/55">
            Download het sjabloon, vul bestaande klanten in en let op{" "}
            <span className="text-white/80">Klantsoort</span> (
            <code className="text-white/75">bedrijf</code> of{" "}
            <code className="text-white/75">particulier</code>). Bij particulier is Bedrijfsnaam de
            volledige persoonsnaam; KVK/BTW meestal leeg.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3"
            disabled={busy}
            onClick={() => {
              const csv = `\uFEFFKlantnummer,Klantsoort,Bedrijfsnaam,Handelsnaam,E-mail,Telefoon,Contactpersoon,KVK,BTW,Straat,Huisnummer,Toevoeging,Postcode,Plaats,Land,Factuur toegestaan
10482,bedrijf,ABC Facility BV,ABC Facility,info@abc.example,0612345678,Jan de Vries,12345678,NL123456789B01,Hoofdstraat,12,a,1234 AB,Amsterdam,NL,nee
10483,particulier,Maria Jansen,,maria@example.com,0687654321,,,,,,,Hoofdstraat,1,,1000 AA,Amsterdam,NL,nee
`;
              const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "mccoy-serviceklanten-import-sjabloon.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden />
            Sjabloon downloaden
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
          }}
        />

        <div className="rounded-xl border border-dashed border-white/20 bg-white/[0.04] p-4">
          <p className="text-sm font-medium text-white/90">Stap 1 — Bestand uploaden</p>
          <p className="mt-1 text-xs text-white/55">
            Klik op de knop hieronder om een .csv of .xlsx van je computer te kiezen.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mr-2 h-4 w-4" aria-hidden />
              Bestand kiezen
            </Button>
            {fileName ? (
              <span className="text-xs text-emerald-300/90">Geselecteerd: {fileName}</span>
            ) : (
              <span className="text-xs text-white/45">Nog geen bestand gekozen</span>
            )}
          </div>
        </div>

        {preview && preview.sheetNames.length > 1 ? (
          <label className="block">
            Werkblad
            <select
              className="a-input mt-1 w-full"
              value={sheetName}
              onChange={(e) => {
                setSheetName(e.target.value);
                void runPreview(e.target.value);
              }}
            >
              {preview.sheetNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs">
            Kolom klantnummer (optioneel)
            <select
              className="a-input mt-1 w-full"
              value={mapId}
              onChange={(e) => setMapId(e.target.value)}
            >
              <option value="">Automatisch (bekende aliassen)</option>
              {(preview?.headers ?? []).map((h) => (
                <option key={`id-${h}`} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs">
            Kolom bedrijfsnaam (optioneel)
            <select
              className="a-input mt-1 w-full"
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
            >
              <option value="">Automatisch (bekende aliassen)</option>
              {(preview?.headers ?? []).map((h) => (
                <option key={`name-${h}`} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        </div>
        {preview && (mapId || mapName) ? (
          <Button type="button" variant="outline" size="sm" loading={busy} onClick={() => void runPreview()}>
            Opnieuw classificeren
          </Button>
        ) : null}

        {preview ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs">
            <p>
              Rijen: {preview.totalRows} · Nieuw: {preview.counts.new} · Bijwerken:{" "}
              {preview.counts.update} · Ongewijzigd: {preview.counts.unchanged} · Ongeldig:{" "}
              {preview.counts.invalid} · Conflict: {preview.counts.conflict}
            </p>
            <p className="mt-1">
              Auto-uitnodiging Account Admin: {preview.inviteCounts.willInvite} · Zonder e-mail:{" "}
              {preview.inviteCounts.missingEmail} · Niet van toepassing:{" "}
              {preview.inviteCounts.skippedNotNew}
            </p>
            <p className="mt-1 text-white/50">
              Ongeldige en conflictregels worden nooit opgeslagen. Bijwerken stuurt geen nieuwe
              uitnodiging. Annuleren na voorvertoning wijzigt niets.
            </p>
          </div>
        ) : null}

        {problemRows.length ? (
          <div className="max-h-40 overflow-auto rounded-xl border border-red-500/20 bg-red-500/5 p-2 text-xs">
            {problemRows.slice(0, 40).map((r) => (
              <p key={`${r.sourceRowNumber}-${r.externalCustomerId ?? ""}`} className="py-0.5">
                Rij {r.sourceRowNumber}: {classificationLabelNl(r.classification)} —{" "}
                {r.externalCustomerId ?? "(geen ID)"} / {r.companyName ?? "—"} — {r.reason}
              </p>
            ))}
          </div>
        ) : null}

        {preview?.rows.some((r) => r.classification === "NEW") ? (
          <div className="max-h-32 overflow-auto rounded-xl border border-white/10 bg-white/[0.02] p-2 text-xs text-white/70">
            {preview.rows
              .filter((r) => r.classification === "NEW")
              .slice(0, 30)
              .map((r) => (
                <p key={`invite-${r.sourceRowNumber}-${r.externalCustomerId ?? ""}`} className="py-0.5">
                  Rij {r.sourceRowNumber}: {r.companyName ?? "—"} — {autoInviteLabelNl(r.autoInvitePlan)}
                </p>
              ))}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </AppDialog>
  );
}
