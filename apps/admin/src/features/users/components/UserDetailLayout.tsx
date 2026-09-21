import type { ComponentType, ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Ban,
  Building2,
  Check,
  ChevronRight,
  FileText,
  Globe,
  KeyRound,
  MailPlus,
  Pencil,
  Plus,
  ShoppingBag,
  Star,
  UserRound,
  X,
} from "lucide-react";

import { formatNlDate } from "../lib/users-view";
import {
  adminCustomerTypeLabel,
  averageOrderLabel,
  companyScopedStatsCaption,
  invoiceAllowedLabel,
  jobTitleValue,
  kpiDash,
  lifetimeActivityCaption,
  lifetimeSpendLabel,
  memberSinceLabel,
  orderTotalLabel,
  userDetailInitials,
  yesNoNl,
  LIFETIME_ACTIVITY_HEADING,
  type UserDetailView,
} from "../lib/user-detail-view";

export type UserDetailLayoutProps = {
  detail: UserDetailView;
  busy?: boolean;
  onEdit: () => void;
  onResetPassword: () => void;
  onDeactivate: () => void;
  onResendInvite: () => void;
  onAddNote: () => void;
  onViewOrder?: (orderId: string) => void;
};

const CARD =
  "rounded-3xl border border-white/[0.08] bg-[#0b1424]/90 p-6 shadow-[0_24px_56px_-32px_rgba(0,0,0,0.75)] backdrop-blur-xl";

const CUSTOMERS_SEARCH = {
  tab: "all" as const,
  q: "",
  status: "all" as const,
  portalStatus: "all" as const,
  page: 1,
  companyId: undefined,
};

const USERS_SEARCH = {
  q: "",
  companyId: undefined as string | undefined,
  userId: undefined,
  page: 1,
};

export function UserDetailLayout({
  detail,
  busy = false,
  onEdit,
  onResetPassword,
  onDeactivate,
  onResendInvite,
  onAddNote,
  onViewOrder,
}: UserDetailLayoutProps) {
  const initials = userDetailInitials(detail);
  const companyHref = {
    to: "/customers/company/$companyId" as const,
    params: { companyId: detail.companyId },
    search: {
      tab: "service" as const,
      q: "",
      status: "all" as const,
      portalStatus: "all" as const,
      page: 1,
      companyId: detail.companyId,
    },
  };
  const customerType = detail.companyTypeLabel || adminCustomerTypeLabel(detail.companyType);

  return (
    <div className="space-y-7 animate-fade-in" data-testid="user-detail-page">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-white/45">
          <li>
            <Link to="/customers" search={CUSTOMERS_SEARCH} className="hover:text-white">
              Klanten
            </Link>
          </li>
          <li aria-hidden className="text-white/25">
            ›
          </li>
          <li>
            <Link {...companyHref} className="hover:text-white">
              {detail.companyName}
            </Link>
          </li>
          <li aria-hidden className="text-white/25">
            ›
          </li>
          <li>
            <Link
              to="/users"
              search={{ ...USERS_SEARCH, companyId: detail.companyId }}
              className="hover:text-white"
            >
              Gebruikers
            </Link>
          </li>
          <li aria-hidden className="text-white/25">
            ›
          </li>
          <li className="font-medium text-white/75" aria-current="page">
            {detail.fullName}
          </li>
        </ol>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-[2rem] font-bold leading-tight tracking-tight sm:text-[2.35rem]">
          Gebruikersdetails
        </h1>
        <p className="max-w-3xl text-[15px] leading-relaxed text-white/50">
          Beheer de gegevens, status en toegang van deze gebruiker.
        </p>
      </header>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <section className={CARD} aria-labelledby="user-identity-heading">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div
              className="grid h-[5.25rem] w-[5.25rem] shrink-0 place-items-center rounded-full bg-[#1e88e5]/20 text-[1.35rem] font-bold tracking-wide text-[#8ec8f8]"
              aria-hidden
            >
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2
                  id="user-identity-heading"
                  className="font-display text-[1.65rem] font-bold leading-tight tracking-tight"
                >
                  {detail.fullName}
                </h2>
                <span
                  className={
                    detail.statusId === "active"
                      ? "inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-400"
                      : "inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-white/75"
                  }
                >
                  {detail.statusLabel}
                </span>
              </div>
              <ul className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/55">
                <li className="inline-flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-white/35" aria-hidden />
                  <span>{detail.companyName}</span>
                </li>
                <li>Klanttype: {customerType}</li>
                <li>{memberSinceLabel(detail.memberSince)}</li>
              </ul>
            </div>
          </div>
        </section>

        <section className={CARD} aria-labelledby="snelle-acties-heading">
          <h2 id="snelle-acties-heading" className="text-lg font-semibold">
            Snelle acties
          </h2>
          <ul className="mt-4 divide-y divide-white/[0.07]">
            <QuickAction icon={Pencil} label="Gegevens bewerken" disabled={busy || !detail.canEdit} onClick={onEdit} />
            <QuickAction
              icon={Ban}
              label={detail.blocked ? "Gebruiker deblokkeren" : "Gebruiker blokkeren"}
              disabled={busy || !detail.canDeactivate}
              onClick={onDeactivate}
              danger={!detail.blocked}
            />
            <QuickAction
              icon={MailPlus}
              label="Uitnodiging opnieuw versturen"
              disabled={busy || !detail.canResendInvite}
              onClick={onResendInvite}
            />
            <QuickAction
              icon={KeyRound}
              label="Wachtwoord reset mail sturen"
              disabled={busy || !detail.canResetPassword}
              onClick={onResetPassword}
            />
          </ul>
        </section>
      </div>

      <section className={CARD} aria-labelledby="persoonsgegevens-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="persoonsgegevens-heading" className="text-lg font-semibold">
            Persoonsgegevens
          </h2>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-sm font-medium text-white/75 hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
            disabled={busy || !detail.canEdit}
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Gegevens bewerken
          </button>
        </div>
        <dl className="mt-6 grid gap-x-12 gap-y-4 md:grid-cols-2">
          <InfoRow label="Voornaam" value={detail.firstName || "—"} />
          <InfoRow label="Achternaam" value={detail.lastName || "—"} />
          <InfoRow label="E-mailadres" value={detail.email} />
          <InfoRow label="Telefoonnummer" value={detail.phone} />
          <InfoRow label="Functie" value={jobTitleValue(detail.jobTitle)} />
        </dl>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className={CARD} aria-labelledby="account-toegang-heading">
          <h2 id="account-toegang-heading" className="text-lg font-semibold">
            Account & toegang
          </h2>
          <dl className="mt-6 space-y-3.5">
            <InfoRow label="Laatste login" value={formatNlDate(detail.lastLoginAt)} />
            <InfoRow label="Accountstatus" value={detail.statusLabel} />
            <InfoRow label="Uitnodigingsstatus" value={detail.invitationStatusLabel} />
            <InfoRow label="Wachtwoordstatus" value={detail.passwordStatusLabel} />
            <InfoRow label="Loginmethode" value={detail.loginMethodLabel} />
          </dl>
        </section>

        <section className={CARD} aria-labelledby="bedrijfskoppeling-heading">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h2 id="bedrijfskoppeling-heading" className="flex items-center gap-2.5 text-lg font-semibold">
              <Building2 className="h-4 w-4 text-white/40" aria-hidden />
              Bedrijfskoppeling
            </h2>
            <Link
              {...companyHref}
              className="inline-flex min-h-10 items-center text-sm font-medium text-[#8ec8f8] hover:text-white"
            >
              Naar klant
            </Link>
          </div>
          <dl className="mt-6 space-y-3.5">
            <InfoRow label="Bedrijfsnaam" value={detail.companyName} />
            <InfoRow label="KVK" value={detail.kvkNumber} />
            <InfoRow label="BTW" value={detail.vatNumber} />
            <InfoRow label="Factuurstatus" value={invoiceAllowedLabel(detail.invoiceAllowed)} />
            <InfoRow label="Primaire accountbeheerder" value={detail.primaryAdminName} />
            <InfoRow
              label="Aantal gebruikers in bedrijf"
              value={detail.companyUserCount === null ? "—" : String(detail.companyUserCount)}
            />
          </dl>
        </section>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <section className={CARD} aria-labelledby="rechten-heading">
          <h2 id="rechten-heading" className="text-lg font-semibold">
            Rechten & status
          </h2>
          <dl className="mt-6 space-y-3.5">
            {detail.rights.map((right) => (
              <InfoRow key={right.id} label={right.label}>
                <span
                  className={`inline-flex items-center gap-1.5 ${
                    right.allowed ? "text-emerald-400" : "text-white/45"
                  }`}
                >
                  {right.allowed ? (
                    <Check className="h-4 w-4" aria-hidden />
                  ) : (
                    <X className="h-4 w-4" aria-hidden />
                  )}
                  {yesNoNl(right.allowed)}
                </span>
              </InfoRow>
            ))}
          </dl>
        </section>

        <section className={CARD} aria-labelledby="bedrijf-favorieten-heading">
          <h2 id="bedrijf-favorieten-heading" className="text-lg font-semibold">
            Bedrijf favorieten
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-white/45">
            Deze favorieten zijn door McCoy ingesteld voor dit bedrijf.
          </p>
          {detail.favouriteLists.length === 0 ? (
            <p className="mt-5 text-sm text-white/45">Nog geen lijsten.</p>
          ) : (
            <ul className="mt-5 divide-y divide-white/[0.07]">
              {detail.favouriteLists.map((list) => (
                <li key={list.id}>
                  <Link
                    {...companyHref}
                    hash="favoriete-producten"
                    className="flex min-h-11 items-center justify-between gap-3 py-2.5 text-sm font-medium text-[#8ec8f8] hover:text-white"
                  >
                    {list.name}
                    <ChevronRight className="h-4 w-4 shrink-0 text-white/30" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className={CARD} aria-labelledby="besteloverzicht-heading">
        <h2 id="besteloverzicht-heading" className="text-lg font-semibold">
          Besteloverzicht
        </h2>
        <p className="mt-1 text-sm text-white/45">
          {companyScopedStatsCaption(detail.companyName)}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi icon={ShoppingBag} label="Totaal bestellingen" value={kpiDash(detail.orderCount)} />
          <Kpi icon={ShoppingBag} label="Laatste bestelling" value={formatNlDate(detail.lastOrderAt)} />
          <Kpi icon={ShoppingBag} label="Gemiddelde bestelwaarde" value={averageOrderLabel(detail)} />
          <Kpi icon={Star} label="Favorieten" value={kpiDash(detail.favouriteCount)} />
        </div>

        {detail.lifetimeActivity ? (
          <div
            className="mt-6 rounded-2xl border border-dashed border-amber-300/30 bg-amber-300/[0.04] p-5"
            data-testid="lifetime-activity"
          >
            <h3
              id="levenslange-activiteit-heading"
              className="flex items-center gap-2.5 text-base font-semibold text-amber-100/90"
            >
              <Globe className="h-4 w-4 text-amber-200/70" aria-hidden />
              {LIFETIME_ACTIVITY_HEADING}
            </h3>
            <p className="mt-1 text-sm text-white/50">
              {lifetimeActivityCaption(
                detail.companyName,
                detail.lifetimeActivity.spansMultipleCompanies,
              )}
            </p>
            <dl className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
              <LifetimeStat
                label="Bestellingen (alle bedrijven)"
                value={kpiDash(detail.lifetimeActivity.orderCount)}
              />
              <LifetimeStat
                label="Besteed (alle bedrijven)"
                value={lifetimeSpendLabel(detail.lifetimeActivity)}
              />
              <LifetimeStat
                label="Laatste bestelling (alle bedrijven)"
                value={formatNlDate(detail.lifetimeActivity.lastOrderAt)}
              />
            </dl>
          </div>
        ) : null}
      </section>

      <section className={CARD} aria-labelledby="recente-bestellingen-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="recente-bestellingen-heading" className="text-lg font-semibold">
            Recente bestellingen
          </h2>
          <Link
            {...companyHref}
            className="text-sm font-medium text-[#8ec8f8] hover:text-white"
          >
            Alle bestellingen bekijken
          </Link>
        </div>
        {detail.recentOrders.length === 0 ? (
          <p className="mt-5 text-sm text-white/45">Nog geen bestellingen.</p>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[0.07]">
            <table className="min-w-full text-left text-sm">
              <caption className="sr-only">Recente bestellingen</caption>
              <thead className="border-b border-white/[0.07] text-[11px] font-medium text-white/40">
                <tr>
                  <th className="px-4 py-3 font-medium">Bestelnummer</th>
                  <th className="px-4 py-3 font-medium">Datum</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Totaal</th>
                  <th className="px-4 py-3 text-right font-medium">Actie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {detail.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="px-4 py-3 font-medium text-white/90">{order.number}</td>
                    <td className="px-4 py-3 text-white/55">{formatNlDate(order.placedAt)}</td>
                    <td className="px-4 py-3 text-white/80">{order.statusLabel}</td>
                    <td className="px-4 py-3 tabular-nums text-white/80">{orderTotalLabel(order)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#8ec8f8] hover:bg-white/10 hover:text-white"
                        onClick={() => onViewOrder?.(order.id)}
                      >
                        Bekijken
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={CARD} aria-labelledby="notities-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="notities-heading" className="flex items-center gap-2.5 text-lg font-semibold">
            <FileText className="h-4 w-4 text-white/40" aria-hidden />
            Notities intern
          </h2>
          <button
            type="button"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-sm font-medium text-white/75 hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
            onClick={onAddNote}
            disabled={busy}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Notitie toevoegen
          </button>
        </div>
        {detail.notes.length === 0 ? (
          <p className="mt-5 text-sm leading-relaxed text-white/45">Nog geen notities.</p>
        ) : (
          <ul className="mt-5 space-y-3">
            {detail.notes.map((note) => (
              <li key={note.id} className="rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3.5">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-white/40">
                  <time dateTime={note.at}>{note.dated}</time>
                  <span className="font-medium text-white/50">{note.author}</span>
                </p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/80">{note.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  disabled,
  onClick,
  danger,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        className={`flex min-h-12 w-full items-center gap-3 px-0.5 py-2 text-left text-[15px] font-medium disabled:opacity-40 ${
          danger ? "text-red-200 hover:text-red-100" : "text-white/85 hover:text-white"
        }`}
        disabled={disabled}
        onClick={onClick}
      >
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${
            danger ? "bg-red-500/10 text-red-200" : "bg-white/[0.05] text-white/55"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">{label}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-white/30" aria-hidden />
      </button>
    </li>
  );
}

function InfoRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(7.75rem,11rem)_minmax(0,1fr)] items-start gap-x-4 gap-y-1">
      <dt className="text-[11px] font-medium leading-5 tracking-[0.04em] text-white/42">{label}</dt>
      <dd className="min-w-0 text-sm leading-5 text-white/88">
        {children ?? (value && value.trim() ? value : "—")}
      </dd>
    </div>
  );
}

function LifetimeStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-white/45">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums text-amber-50/90">{value}</dd>
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
    <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <Icon className="h-4 w-4 text-white/40" aria-hidden />
      <p className="mt-2 text-xs text-white/45">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
