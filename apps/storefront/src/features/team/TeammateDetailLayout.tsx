import {
  Ban,
  KeyRound,
  MailPlus,
  Pencil,
  ShoppingBag,
  Star,
  Users,
} from "lucide-react";

import {
  averageOrderLabel,
  formatNlDate,
  memberSinceLabel,
  teammateInitials,
  yesNoNl,
  type TeammateDetailView,
} from "./teammate-detail-view";

export function TeammateDetailLayout({
  detail,
  busy = false,
  onEdit,
  onResetPassword,
  onDeactivate,
  onResendInvite,
}: {
  detail: TeammateDetailView;
  busy?: boolean;
  onEdit: () => void;
  onResetPassword: () => void;
  onDeactivate: () => void;
  onResendInvite: () => void;
}) {
  const initials = teammateInitials(detail);
  return (
    <div className="space-y-6" data-testid="user-detail-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Gebruikersdetails</h1>
        <a href="/account/company/users" className="mt-2 inline-flex text-sm font-medium text-sky-700 hover:underline">
          Terug naar team
        </a>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="user-identity-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-sky-100 text-lg font-bold tracking-wide text-sky-800"
            aria-hidden
          >
            {initials}
          </div>
          <div>
            <h2 id="user-identity-heading" className="text-2xl font-bold tracking-tight text-slate-900">
              {detail.fullName}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-2">
              <li>
                <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {detail.roleLabel}
                </span>
              </li>
              <li>
                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {detail.statusLabel}
                </span>
              </li>
            </ul>
            <p className="mt-2 text-sm text-slate-500">{memberSinceLabel(detail.memberSince)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="snelle-acties-heading">
        <h2 id="snelle-acties-heading" className="text-lg font-semibold text-slate-900">
          Snelle acties
        </h2>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          <Action icon={Pencil} label="Gegevens bewerken" disabled={busy} onClick={onEdit} />
          <Action
            icon={KeyRound}
            label="Wachtwoord opnieuw instellen"
            disabled={busy || !detail.canResetPassword}
            onClick={onResetPassword}
          />
          <Action
            icon={Ban}
            label={detail.blocked ? "Gebruiker activeren" : "Gebruiker deactiveren"}
            disabled={busy || !detail.canDeactivate}
            onClick={onDeactivate}
            danger={!detail.blocked}
          />
          <Action
            icon={MailPlus}
            label="Uitnodiging opnieuw versturen"
            disabled={busy || !detail.canResendInvite}
            onClick={onResendInvite}
          />
        </ul>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="persoonsgegevens-heading">
          <div className="flex items-start justify-between gap-3">
            <h2 id="persoonsgegevens-heading" className="text-lg font-semibold text-slate-900">
              Persoonsgegevens
            </h2>
            <button type="button" className="text-sm font-medium text-sky-700 hover:underline" onClick={onEdit}>
              Gegevens bewerken
            </button>
          </div>
          <dl className="mt-5 space-y-3.5 text-sm">
            <Row label="Voornaam" value={detail.firstName || "—"} />
            <Row label="Achternaam" value={detail.lastName || "—"} />
            <Row label="E-mailadres" value={detail.email} />
            <Row label="Telefoonnummer" value={detail.phone || "—"} />
            <Row label="Functie" value={detail.jobTitle?.trim() || "—"} />
          </dl>
        </section>
        <div className="space-y-6">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="account-toegang-heading">
            <h2 id="account-toegang-heading" className="text-lg font-semibold text-slate-900">
              Account & toegang
            </h2>
            <dl className="mt-5 space-y-3.5 text-sm">
              <Row label="Laatste login" value={formatNlDate(detail.lastLoginAt)} />
              <Row label="Aangemeld op" value={formatNlDate(detail.signedUpAt)} />
              <Row label="Status" value={detail.statusLabel} />
              <Row label="Uitnodigingsstatus" value={detail.invitationStatusLabel} />
            </dl>
            <p className="mt-5 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900" role="note">
              {detail.callout}
            </p>
          </section>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="rechten-heading">
            <h2 id="rechten-heading" className="text-lg font-semibold text-slate-900">
              Rechten
            </h2>
            <dl className="mt-5 space-y-3.5 text-sm">
              {detail.rights.map((right) => (
                <Row key={right.id} label={right.label} value={yesNoNl(right.allowed)} />
              ))}
            </dl>
          </section>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="bestelgedrag-heading">
        <h2 id="bestelgedrag-heading" className="text-lg font-semibold text-slate-900">
          Bestelgedrag
        </h2>
        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={ShoppingBag} label="Bestellingen totaal" value={String(detail.orderCount)} />
          <Kpi icon={Star} label="Favorieten" value={String(detail.favouriteCount)} />
          <Kpi icon={ShoppingBag} label="Recente bestelling" value={formatNlDate(detail.lastOrderAt)} />
          <Kpi icon={Users} label="Gemiddelde bestelwaarde" value={averageOrderLabel(detail)} />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="favoriete-lijsten-heading">
          <h2 id="favoriete-lijsten-heading" className="text-lg font-semibold text-slate-900">
            Favoriete productlijsten
          </h2>
          <ul className="mt-5 divide-y divide-slate-100">
            {detail.favouriteLists.map((list) => (
              <li key={list.id} className="py-3 text-sm font-medium text-slate-800">
                {list.name}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="recente-bestellingen-heading">
          <h2 id="recente-bestellingen-heading" className="text-lg font-semibold text-slate-900">
            Recente bestellingen
          </h2>
          {detail.recentOrders.length === 0 ? (
            <p className="mt-5 text-sm text-slate-500">Nog geen bestellingen.</p>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <caption className="sr-only">Recente bestellingen</caption>
                <thead className="text-xs uppercase tracking-wide text-slate-400">
                  <tr>
                    <th className="px-3 py-2 font-medium">Bestelnummer</th>
                    <th className="px-3 py-2 font-medium">Datum</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recentOrders.map((order) => (
                    <tr key={order.id} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 font-medium text-slate-800">{order.number}</td>
                      <td className="px-3 py-2.5 text-slate-500">{formatNlDate(order.placedAt)}</td>
                      <td className="px-3 py-2.5 text-slate-800">{order.statusLabel}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="text-sm font-medium text-sky-700">Bekijken</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby="notities-heading">
        <h2 id="notities-heading" className="text-lg font-semibold text-slate-900">
          Notities
        </h2>
        <ul className="mt-5 space-y-3">
          {detail.notes.map((note) => (
            <li key={note.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
              <p className="flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                <time dateTime={note.at}>{note.dated}</time>
                <span className="font-medium">{note.author}</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-800">{note.body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Action({
  icon: Icon,
  label,
  disabled,
  onClick,
  danger,
}: {
  icon: typeof Pencil;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={
          danger
            ? "flex w-full items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-40"
            : "flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-40"
        }
      >
        <Icon className="h-4 w-4" aria-hidden />
        {label}
      </button>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{value}</dd>
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <Icon className="h-4 w-4 text-slate-400" aria-hidden />
      <p className="mt-2 text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
