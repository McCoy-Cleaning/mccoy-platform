import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Building2,
  Download,
  Loader2,
  Search,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { formatMoneyMinor } from "@mccoy/domain";

import { PageHeader } from "@/components/admin/AdminBits";
import { EmptyState } from "@/components/admin/EmptyState";
import { ErrorState } from "@/components/admin/ErrorState";
import { AppDialog } from "@/components/admin/AppDialog";
import { Button } from "@/components/ui/button";
import {
  exportAdminCustomers,
  importAdminCustomers,
  inviteAdminCustomer,
  listAdminCustomers,
  seedAdminCommerceFixtures,
} from "@/lib/api/admin-customers.functions";
import type { CustomersSearch } from "./types/search";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      population: "registered" | "guests";
      items: Array<Record<string, unknown>>;
      total: number;
      page: number;
      pageSize: number;
    };

function statusLabel(status: string): string {
  if (status === "active") return "Actief";
  if (status === "invited") return "Uitgenodigd";
  if (status === "blocked") return "Geblokkeerd";
  return status;
}

export function CustomersPage({ search }: { search: CustomersSearch }) {
  const navigate = useNavigate({ from: "/customers" });
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [qDraft, setQDraft] = useState(search.q);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

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
    void listAdminCustomers({
      data: {
        population: search.tab,
        q: search.q || undefined,
        status: search.tab === "registered" ? search.status : undefined,
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
        population: res.population,
        items: res.items as Array<Record<string, unknown>>,
        total: res.total,
        page: res.page,
        pageSize: res.pageSize,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [search.tab, search.q, search.status, search.page]);

  const pageCount =
    list.status === "ok" ? Math.max(1, Math.ceil(list.total / list.pageSize)) : 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        icon={Building2}
        accent="#22c55e"
        title="Klanten"
        subtitle="Geregistreerde klanten en gasten die een aankoop hebben gedaan — los van website-aanvragen."
        actions={[
          {
            label: "Uitnodigen",
            icon: UserPlus,
            onClick: () => setInviteOpen(true),
          },
          {
            label: "Exporteren",
            icon: Download,
            onClick: () => {
              void (async () => {
                setBusy(true);
                const res = await exportAdminCustomers({
                  data: {
                    population: search.tab,
                    q: search.q || undefined,
                    status: search.tab === "registered" ? search.status : undefined,
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
                a.download =
                  search.tab === "guests"
                    ? "mccoy-gastkopers.csv"
                    : "mccoy-klanten.csv";
                a.click();
                URL.revokeObjectURL(url);
              })();
            },
          },
          {
            label: "Importeren",
            icon: Upload,
            onClick: () => setImportOpen(true),
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
            { id: "registered" as const, label: "Bestaande klanten" },
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
                  search: { tab: tab.id, q: search.q, status: "all", page: 1 },
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
        {search.tab === "registered" ? (
          <label className="flex items-center gap-2 text-sm text-white/70">
            <span>Status</span>
            <select
              className="a-input"
              value={search.status}
              onChange={(e) =>
                void navigate({
                  search: (prev) => ({
                    ...prev,
                    status: e.target.value as CustomersSearch["status"],
                    page: 1,
                  }),
                })
              }
            >
              <option value="all">Alle</option>
              <option value="active">Actief</option>
              <option value="invited">Uitgenodigd</option>
              <option value="blocked">Geblokkeerd</option>
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
                  : "Nog geen geregistreerde klanten"
            }
            description={
              search.q
                ? "Pas de zoekterm of filters aan."
                : search.tab === "guests"
                  ? "Gastkopers verschijnen hier zodra er orders zonder gekoppelde klantaccount bestaan (checkout, import of testfixtures)."
                  : "Nodig een klant uit of laad testfixtures in een niet-productieomgeving."
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
                        void navigate({ search: (prev) => ({ ...prev }) });
                      }
                    })();
                  }}
                >
                  Testfixtures laden
                </button>
              ) : undefined
            }
          />
        ) : search.tab === "registered" ? (
          <RegisteredTable items={list.items} />
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

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onDone={(msg) => {
          setInviteOpen(false);
          setFlash(msg);
        }}
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={(msg) => {
          setImportOpen(false);
          setFlash(msg);
        }}
      />
    </div>
  );
}

function RegisteredTable({ items }: { items: Array<Record<string, unknown>> }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
          <tr>
            <th className="px-4 py-3 font-medium">Klant</th>
            <th className="px-4 py-3 font-medium">Bedrijf</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Orders</th>
            <th className="px-4 py-3 font-medium">Omzet</th>
            <th className="px-4 py-3 font-medium">Laatste order</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {items.map((row) => {
            const id = String(row.id);
            return (
              <tr key={id} className="hover:bg-white/[0.03]">
                <td className="px-4 py-3">
                  <Link
                    to="/customers/registered/$customerId"
                    params={{ customerId: id }}
                    search={{ tab: "registered", q: "", status: "all", page: 1 }}
                    className="font-medium text-white/90 hover:underline"
                  >
                    {String(row.fullName || row.email)}
                  </Link>
                  <div className="text-xs text-white/45">{String(row.email)}</div>
                </td>
                <td className="px-4 py-3 text-white/70">{String(row.companyName || "—")}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/75">
                    {statusLabel(String(row.status))}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-white/70">{Number(row.orderCount)}</td>
                <td className="px-4 py-3 tabular-nums text-white/70">
                  {formatMoneyMinor(Number(row.totalSpendMinor) || 0)}
                </td>
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
                    search={{ tab: "guests", q: "", status: "all", page: 1 }}
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

function InviteDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyLegalName, setCompanyLegalName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <AppDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Klant uitnodigen"
      description="De klant ontvangt een Auth-uitnodiging en stelt zelf een wachtwoord in. Er wordt geen wachtwoord gegenereerd."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Annuleren
          </Button>
          <Button
            type="button"
            loading={saving}
            onClick={() => {
              void (async () => {
                setSaving(true);
                setError(null);
                const res = await inviteAdminCustomer({
                  data: { email, fullName: fullName || undefined, companyLegalName },
                });
                setSaving(false);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                onDone(
                  res.mode === "invited"
                    ? "Uitnodiging verstuurd."
                    : "Bestaande klant gevonden — geen dubbele account aangemaakt.",
                );
              })();
            }}
          >
            Uitnodigen
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block text-sm text-white/80">
          E-mail
          <input className="a-input mt-1 w-full" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm text-white/80">
          Naam
          <input className="a-input mt-1 w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="block text-sm text-white/80">
          Bedrijfsnaam (juridisch)
          <input
            className="a-input mt-1 w-full"
            value={companyLegalName}
            onChange={(e) => setCompanyLegalName(e.target.value)}
          />
        </label>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
    </AppDialog>
  );
}

function ImportDialog({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [csvText, setCsvText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <AppDialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="Klanten importeren (CSV)"
      description="Kolommen: email, full_name, phone, company. Importeert CRM-uitnodigingen — geen wachtwoorden."
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Annuleren
          </Button>
          <Button
            type="button"
            loading={saving}
            onClick={() => {
              void (async () => {
                setSaving(true);
                setError(null);
                const res = await importAdminCustomers({ data: { csvText, commit: true } });
                setSaving(false);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                if (res.mode === "commit") {
                  onDone(`Import: ${res.invited} uitgenodigd, ${res.skipped} overgeslagen.`);
                }
              })();
            }}
          >
            Importeren
          </Button>
        </>
      }
    >
      <label className="block text-sm text-white/80">
        CSV
        <textarea
          className="a-input mt-1 min-h-40 w-full font-mono text-xs"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={"email,full_name,phone,company\nada@example.com,Ada,0612345678,Ada BV"}
        />
      </label>
      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </AppDialog>
  );
}
