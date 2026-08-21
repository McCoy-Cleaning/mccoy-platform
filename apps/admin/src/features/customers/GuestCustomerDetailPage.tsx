import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { formatMoneyMinor } from "@mccoy/domain";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/admin/AdminBits";
import { EmptyState } from "@/components/admin/EmptyState";
import { ErrorState } from "@/components/admin/ErrorState";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import {
  convertAdminGuest,
  getAdminGuestDetail,
} from "@/lib/api/admin-customers.functions";

export function GuestCustomerDetailPage({ guestId }: { guestId: string }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | {
        status: "ok";
        guest: {
          id: string;
          emailDisplay: string;
          fullName: string | null;
          companyName: string | null;
          phone: string | null;
          convertedUserId: string | null;
        };
        orders: Array<{
          id: string;
          number: string;
          placedAt: string;
          orderStatus: string;
          paymentStatus: string;
          totalMinor: number;
          currency: string;
          purchaserEmail: string;
          purchaserName: string | null;
        }>;
      }
  >({ status: "loading" });
  const [convertOpen, setConvertOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const reload = () => {
    setState({ status: "loading" });
    void getAdminGuestDetail({ data: { guestId } }).then((res) => {
      if (!res.ok) {
        setState({ status: "error", message: res.error });
        return;
      }
      setState({
        status: "ok",
        guest: res.guest,
        orders: res.orders,
      });
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guestId]);

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-3 p-10 text-white/60" aria-busy="true">
        <Loader2 className="h-5 w-5 animate-spin" /> Gast laden…
      </div>
    );
  }
  if (state.status === "error") {
    return <ErrorState title="Gast niet geladen" message={state.message} />;
  }

  const { guest, orders } = state;
  const converted = Boolean(guest.convertedUserId);

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        to="/customers"
        search={{ tab: "guests", q: "", status: "all", page: 1 }}
        className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar gastkopers
      </Link>
      <PageHeader
        icon={Building2}
        accent="#38bdf8"
        title={guest.fullName || guest.emailDisplay}
        subtitle="Gastkoper — geen Auth-account"
        actions={
          converted
            ? []
            : [
                {
                  label: "Converteren / koppelen",
                  icon: Building2,
                  onClick: () => setConvertOpen(true),
                },
              ]
        }
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
            <dt className="text-white/45">E-mail</dt>
            <dd className="text-white/85">{guest.emailDisplay}</dd>
          </div>
          <div>
            <dt className="text-white/45">Telefoon</dt>
            <dd className="text-white/85">{guest.phone || "—"}</dd>
          </div>
          <div>
            <dt className="text-white/45">Bedrijfsnaam (vrij)</dt>
            <dd className="text-white/85">{guest.companyName || "—"}</dd>
          </div>
          <div>
            <dt className="text-white/45">Conversie</dt>
            <dd className="text-white/85">{converted ? "Gekoppeld aan klant" : "Nog gast"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold">Orders</h2>
        <p className="mt-1 text-sm text-white/50">
          Snapshots (naam/e-mail/bedrag) blijven staan na conversie.
        </p>
        {orders.length === 0 ? (
          <EmptyState title="Geen orders" />
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-white/45">
                <tr>
                  <th className="py-2 pr-3">Nummer</th>
                  <th className="py-2 pr-3">Snapshot e-mail</th>
                  <th className="py-2 pr-3">Betaling</th>
                  <th className="py-2 pr-3">Bedrag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {orders.map((o) => (
                  <tr key={o.id}>
                    <td className="py-2 pr-3 font-medium">{o.number}</td>
                    <td className="py-2 pr-3 text-white/60">{o.purchaserEmail}</td>
                    <td className="py-2 pr-3">{o.paymentStatus}</td>
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

      <ConfirmationDialog
        open={convertOpen}
        title="Gast converteren of koppelen?"
        description="Als er al een klant met dit e-mailadres bestaat, worden orders veilig gekoppeld. Anders wordt een Auth-uitnodiging verstuurd (geen wachtwoord)."
        confirmLabel="Doorgaan"
        onCancel={() => setConvertOpen(false)}
        onConfirm={async () => {
          const res = await convertAdminGuest({
            data: { guestId: guest.id, companyLegalName: guest.companyName || undefined },
          });
          setConvertOpen(false);
          if (!res.ok) setFlash(res.error);
          else {
            setFlash(
              res.mode === "linked_existing"
                ? `Gekoppeld aan bestaande klant (${res.ordersLinked} orders).`
                : res.mode === "already_converted"
                  ? "Al geconverteerd."
                  : `Uitnodiging verstuurd (${res.ordersLinked} orders gekoppeld).`,
            );
            reload();
          }
        }}
      />
    </div>
  );
}
