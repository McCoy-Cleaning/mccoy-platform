import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatMoneyMinor } from "@mccoy/domain";
import { ArrowLeft, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminBits";
import { EmptyState } from "@/components/admin/EmptyState";
import { ErrorState } from "@/components/admin/ErrorState";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { AppDialog } from "@/components/admin/AppDialog";
import { Button } from "@/components/ui/button";
import {
  getAdminCustomerDetail,
  setAdminCustomerBlocked,
  updateAdminCustomer,
} from "@/lib/api/admin-customers.functions";
import { Building2 } from "lucide-react";

export function RegisteredCustomerDetailPage({ customerId }: { customerId: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | {
        status: "ok";
        customer: {
          id: string;
          email: string;
          fullName: string | null;
          phone: string | null;
          status: string;
          createdAt: string;
        };
        companies: Array<{ id: string; legalName: string; status: string; invoiceAllowed: boolean }>;
        orders: Array<{
          id: string;
          number: string;
          placedAt: string;
          orderStatus: string;
          paymentStatus: string;
          fulfilmentStatus: string;
          totalMinor: number;
          currency: string;
        }>;
      }
  >({ status: "loading" });
  const [editOpen, setEditOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const reload = () => {
    setState({ status: "loading" });
    void getAdminCustomerDetail({ data: { customerId } }).then((res) => {
      if (!res.ok) {
        setState({ status: "error", message: res.error });
        return;
      }
      setState({
        status: "ok",
        customer: res.customer,
        companies: res.companies.map((c) => ({
          id: c.id,
          legalName: c.legalName,
          status: c.status,
          invoiceAllowed: c.invoiceAllowed,
        })),
        orders: res.orders.map((o) => ({
          id: o.id,
          number: o.number,
          placedAt: o.placedAt,
          orderStatus: o.orderStatus,
          paymentStatus: o.paymentStatus,
          fulfilmentStatus: o.fulfilmentStatus,
          totalMinor: o.totalMinor,
          currency: o.currency,
        })),
      });
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-3 p-10 text-white/60" aria-busy="true">
        <Loader2 className="h-5 w-5 animate-spin" /> Profiel laden…
      </div>
    );
  }
  if (state.status === "error") {
    return <ErrorState title="Klant niet geladen" message={state.message} />;
  }

  const { customer, companies, orders } = state;
  const blocked = customer.status === "blocked";

  return (
    <div className="space-y-6 animate-fade-in">
      <Link to="/customers" search={{ tab: "registered", q: "", status: "all", page: 1 }} className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> Terug naar klanten
      </Link>
      <PageHeader
        icon={Building2}
        accent="#22c55e"
        title={customer.fullName || customer.email}
        subtitle={customer.email}
        actions={[
          { label: "Bewerken", icon: Building2, onClick: () => setEditOpen(true) },
          {
            label: blocked ? "Deblokkeren" : "Blokkeren",
            icon: Building2,
            onClick: () => setBlockOpen(true),
          },
        ]}
      />
      {flash ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm" role="status">
          {flash}
        </p>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold">Overzicht</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-white/45">Status</dt>
            <dd className="text-white/85">{customer.status}</dd>
          </div>
          <div>
            <dt className="text-white/45">Telefoon</dt>
            <dd className="text-white/85">{customer.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-white/45">Account</dt>
            <dd className="text-white/85">Geregistreerd (Auth-profiel)</dd>
          </div>
          <div>
            <dt className="text-white/45">Aangemaakt</dt>
            <dd className="text-white/85">{new Date(customer.createdAt).toLocaleString("nl-NL")}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold">Bedrijven</h2>
        {companies.length === 0 ? (
          <EmptyState title="Geen bedrijf gekoppeld" description="Koppeling via company_users." />
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {companies.map((c) => (
              <li key={c.id} className="flex justify-between gap-3 py-3 text-sm">
                <span className="text-white/85">{c.legalName}</span>
                <span className="text-white/50">
                  {c.status}
                  {c.invoiceAllowed ? " · factuur toegestaan" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold">Orders</h2>
        {orders.length === 0 ? (
          <EmptyState title="Nog geen orders" />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-white/45">
                <tr>
                  <th className="py-2 pr-3">Nummer</th>
                  <th className="py-2 pr-3">Datum</th>
                  <th className="py-2 pr-3">Order</th>
                  <th className="py-2 pr-3">Betaling</th>
                  <th className="py-2 pr-3">Bedrag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 pr-3 font-medium text-white/85">{o.number}</td>
                    <td className="py-2 pr-3 text-white/60">
                      {new Date(o.placedAt).toLocaleDateString("nl-NL")}
                    </td>
                    <td className="py-2 pr-3 text-white/70">{o.orderStatus}</td>
                    <td className="py-2 pr-3 text-white/70">{o.paymentStatus}</td>
                    <td className="py-2 pr-3 tabular-nums">
                      {formatMoneyMinor(o.totalMinor, o.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AppDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Klant bewerken"
        description="E-mail wijzigen gebeurt via Auth, niet via dit formulier."
        footer={
          <EditCustomerFooter
            customerId={customer.id}
            initialName={customer.fullName}
            initialPhone={customer.phone}
            onDone={() => {
              setEditOpen(false);
              setFlash("Profiel bijgewerkt.");
              reload();
            }}
            onCancel={() => setEditOpen(false)}
          />
        }
      >
        <p className="text-sm text-white/55">Pas naam en telefoon aan. E-mail blijft {customer.email}.</p>
      </AppDialog>

      <ConfirmationDialog
        open={blockOpen}
        title={blocked ? "Klant deblokkeren?" : "Klant blokkeren?"}
        description={
          blocked
            ? "De klant kan weer inloggen wanneer het account actief is."
            : "Blokkeren zet status op blocked en trekt sessies in. Orders blijven zichtbaar."
        }
        confirmLabel={blocked ? "Deblokkeren" : "Blokkeren"}
        tone={blocked ? "default" : "destructive"}
        onCancel={() => setBlockOpen(false)}
        onConfirm={async () => {
          const res = await setAdminCustomerBlocked({
            data: { customerId: customer.id, blocked: !blocked },
          });
          setBlockOpen(false);
          if (!res.ok) setFlash(res.error);
          else {
            setFlash(blocked ? "Klant gedeblokkeerd." : "Klant geblokkeerd.");
            reload();
          }
        }}
      />
    </div>
  );
}

function EditCustomerFooter({
  customerId,
  initialName,
  initialPhone,
  onDone,
  onCancel,
}: {
  customerId: string;
  initialName: string | null;
  initialPhone: string | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState(initialName ?? "");
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <div className="mb-4 w-full space-y-3 text-left">
        <label className="block text-sm">
          Naam
          <input className="a-input mt-1 w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="block text-sm">
          Telefoon
          <input className="a-input mt-1 w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </label>
        {error ? <p className="text-sm text-red-300">{error}</p> : null}
      </div>
      <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
        Annuleren
      </Button>
      <Button
        type="button"
        loading={pending}
        onClick={() => {
          void (async () => {
            setPending(true);
            const res = await updateAdminCustomer({
              data: {
                customerId,
                fullName: fullName || null,
                phone: phone || null,
              },
            });
            setPending(false);
            if (!res.ok) setError(res.error);
            else onDone();
          })();
        }}
      >
        Opslaan
      </Button>
    </>
  );
}
