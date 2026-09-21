import { useState, type ComponentType, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  Check,
  ChevronRight,
  FileText,
  MoreVertical,
  Pencil,
  Plus,
  Shield,
  Star,
  StickyNote,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type { CompanyPartyType, CustomerPortalStatus } from "@mccoy/domain";

import { EmptyState } from "@/components/admin/EmptyState";
import { formatNlDate, panelTypeLabel } from "../lib/directory-view";
import {
  companyHeadAddress,
  companyProfileDescription,
  companyStatusLabelNl,
  displayOnlyOrderCount,
  lastActivityValueNl,
  memberAvatarInitials,
  memberAvatarTone,
  memberRoleLabelNl,
  memberStatusLabelNl,
  portalBadgeLabelNl,
  profileNotes,
  stackedAvatarLines,
  type ProfileNote,
} from "../lib/company-profile";
import { CompanyFavouriteProductsSection } from "./CompanyFavouriteProductsSection";

export type CompanyProfileCompany = {
  id: string;
  legalName: string;
  displayName: string | null;
  companyType: string;
  partyType: CompanyPartyType;
  status: string;
  invoiceAllowed: boolean;
  email: string | null;
  phone: string | null;
  kvkNumber: string | null;
  vatNumber: string | null;
  contactPersonName: string | null;
  addressStreet: string | null;
  addressHouseNumber: string | null;
  addressHouseSuffix: string | null;
  addressPostalCode: string | null;
  addressCity: string | null;
  addressCountry: string | null;
  notes: string | null;
  externalCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompanyProfileMember = {
  userId: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  membershipStatus: string;
  userStatus: string;
};

export type CompanyProfileInvitation = {
  email: string;
  intendedRole: string;
  status: string;
  expiresAt: string;
  reminderCount: number;
};

export type CompanyProfileLayoutProps = {
  company: CompanyProfileCompany;
  portalStatus: CustomerPortalStatus;
  members: CompanyProfileMember[];
  invitations: CompanyProfileInvitation[];
  flash: string | null;
  busy: boolean;
  onInviteUser: () => void;
  onEditCompany: () => void;
  onChangePortalStatus: () => void;
  onAddNote: () => void;
  onEditNote: (note: ProfileNote) => void;
  onDeleteNote: (note: ProfileNote) => void;
  onViewMember: (member: CompanyProfileMember) => void;
  onEditMember: (member: CompanyProfileMember) => void;
  onToggleMembership: (member: CompanyProfileMember) => void;
  onToggleBlock: (member: CompanyProfileMember) => void;
  onResendInvite: (invitation: CompanyProfileInvitation) => void;
  onTransferAdmin?: (member: CompanyProfileMember) => void;
};

const PAGE_TITLE = "Bedrijfsprofiel & favorieten";
const PAGE_SUBTITLE =
  "Bekijk en beheer alle gegevens, gebruikers en favoriete producten van dit bedrijf.";

const CUSTOMERS_SEARCH = {
  tab: "service" as const,
  q: "",
  status: "all" as const,
  portalStatus: "all" as const,
  page: 1,
  companyId: undefined,
};

const CARD =
  "rounded-3xl border border-white/[0.08] bg-[#0b1424]/90 p-6 shadow-[0_24px_56px_-32px_rgba(0,0,0,0.75)] backdrop-blur-xl";

export function CompanyProfileLayout({
  company,
  portalStatus,
  members,
  invitations,
  flash,
  busy,
  onInviteUser,
  onEditCompany,
  onChangePortalStatus,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onViewMember,
  onEditMember,
  onToggleMembership,
  onToggleBlock,
  onResendInvite,
  onTransferAdmin,
}: CompanyProfileLayoutProps) {
  const name = company.displayName || company.legalName;
  const [avatarPrimary, avatarSecondary] = stackedAvatarLines(name);
  const notes = profileNotes({ notes: company.notes, updatedAt: company.updatedAt });
  const pendingInvites = invitations.filter((invite) => invite.status === "pending");
  const userCount = members.length + pendingInvites.length;
  const headAddress = companyHeadAddress(company);

  return (
    <div className="space-y-7 animate-fade-in">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-sm text-white/45">
          <li>
            <Link
              to="/customers"
              search={{ ...CUSTOMERS_SEARCH, tab: "all" }}
              className="hover:text-white"
            >
              Klanten
            </Link>
          </li>
          <li aria-hidden className="text-white/25">
            ›
          </li>
          <li>
            <Link to="/customers" search={CUSTOMERS_SEARCH} className="hover:text-white">
              Bedrijven
            </Link>
          </li>
          <li aria-hidden className="text-white/25">
            ›
          </li>
          <li className="font-medium text-white/75" aria-current="page">
            {name}
          </li>
        </ol>
      </nav>

      <header className="space-y-2">
        <h1 className="font-display text-[2rem] font-bold leading-tight tracking-tight sm:text-[2.35rem]">
          {PAGE_TITLE}
        </h1>
        <p className="max-w-3xl text-[15px] leading-relaxed text-white/50">{PAGE_SUBTITLE}</p>
      </header>

      {flash ? (
        <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm" role="status">
          {flash}
        </p>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="space-y-5">
          <section className={CARD} aria-labelledby="company-identity-heading">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
              <div
                className="grid h-[5.25rem] w-[5.25rem] shrink-0 place-items-center rounded-2xl bg-white text-[#0b1628] shadow-[0_8px_24px_-12px_rgba(255,255,255,0.35)]"
                aria-hidden
              >
                <span className="flex flex-col items-center justify-center px-1.5 text-center leading-none">
                  <span className="text-[1.15rem] font-extrabold tracking-[0.04em]">{avatarPrimary}</span>
                  {avatarSecondary ? (
                    <span className="mt-1 text-[0.58rem] font-bold tracking-[0.16em] text-[#0b1628]/70">
                      {avatarSecondary}
                    </span>
                  ) : null}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2
                      id="company-identity-heading"
                      className="font-display text-[1.65rem] font-bold leading-tight tracking-tight"
                    >
                      {name}
                    </h2>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      <StatusPill label={panelTypeLabel({ companyType: company.companyType })} />
                      <StatusPill label={companyStatusLabelNl(company.status)} />
                      <StatusPill label={portalBadgeLabelNl(portalStatus)} />
                    </ul>
                  </div>
                  <dl className="flex shrink-0 flex-wrap gap-x-8 gap-y-3 sm:justify-end">
                    <div>
                      <dt className="text-[11px] font-medium text-white/40">Klant sinds</dt>
                      <dd className="mt-1 text-sm text-white/80">{formatNlDate(company.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] font-medium text-white/40">Laatste activiteit</dt>
                      <dd className="mt-1 text-sm text-white/80">{lastActivityValueNl(company.updatedAt)}</dd>
                    </div>
                  </dl>
                </div>
                <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/50">
                  {companyProfileDescription({
                    companyType: company.companyType,
                    portalStatus,
                  })}
                </p>
              </div>
            </div>
          </section>

          <section className={CARD} aria-labelledby="bedrijfsgegevens-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="bedrijfsgegevens-heading" className="flex items-center gap-2.5 text-lg font-semibold">
                <Building2 className="h-4 w-4 text-white/40" aria-hidden />
                Bedrijfsgegevens
              </h2>
              <button
                type="button"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 text-sm font-medium text-white/75 hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                onClick={onEditCompany}
                disabled={busy}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Bewerken
              </button>
            </div>
            <div className="mt-6 grid gap-x-12 gap-y-4 md:grid-cols-2">
              <div className="space-y-3.5">
                <InfoRow label="Bedrijfsnaam" value={company.legalName} />
                <InfoRow label="Klantnummer" value={company.externalCustomerId} />
                <InfoRow label="Externe ID" value={null} />
                <InfoRow label="KvK-nummer" value={company.kvkNumber} />
                <InfoRow label="BTW-nummer" value={company.vatNumber} />
                <InfoRow label="Contact e-mail" value={company.email} />
                <InfoRow label="Telefoonnummer" value={company.phone} />
              </div>
              <div className="space-y-3.5">
                <InfoRow label="Hoofdadres" value={headAddress} multiline />
                <InfoRow label="Factuuradres" value="Gelijk aan hoofdadres" />
                <InfoRow label="Facturatie toegestaan">
                  {company.invoiceAllowed ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="h-4 w-4 text-emerald-400" aria-hidden />
                      Ja
                    </span>
                  ) : (
                    "Nee"
                  )}
                </InfoRow>
                <InfoRow label="Registratiestatus">
                  <span className="inline-flex items-center gap-1.5">
                    <StatusDot tone={company.status === "active" ? "active" : company.status} />
                    {companyStatusLabelNl(company.status)}
                  </span>
                </InfoRow>
                <InfoRow label="Laatst gesynchroniseerd" value={lastActivityValueNl(company.updatedAt)} />
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-5">
          <section className={CARD} aria-labelledby="snelle-acties-heading">
            <h2 id="snelle-acties-heading" className="text-lg font-semibold">
              Snelle acties
            </h2>
            <ul className="mt-4 divide-y divide-white/[0.07]">
              <QuickAction
                icon={UserPlus}
                label="Gebruiker uitnodigen"
                onClick={onInviteUser}
                disabled={busy}
              />
              <QuickAction icon={Pencil} label="Bedrijf bewerken" onClick={onEditCompany} disabled={busy} />
              <QuickAction
                icon={Star}
                label="Favorieten beheren"
                onClick={() => {
                  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                  document
                    .getElementById("favoriete-producten")
                    ?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
                }}
              />
              <QuickAction
                icon={Shield}
                label="Portaalstatus wijzigen"
                onClick={onChangePortalStatus}
                disabled={busy}
              />
              <QuickAction
                icon={StickyNote}
                label="Notitie toevoegen"
                onClick={onAddNote}
                disabled={busy}
              />
            </ul>
          </section>

          <section className={CARD} aria-labelledby="notities-heading">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="notities-heading" className="flex items-center gap-2.5 text-lg font-semibold">
                <FileText className="h-4 w-4 text-white/40" aria-hidden />
                Notities
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
            {notes.length === 0 ? (
              <p className="mt-5 text-sm leading-relaxed text-white/45">Nog geen notities.</p>
            ) : (
              <ul className="mt-5 space-y-3">
                {notes.map((note) => (
                  <li key={note.id} className="rounded-2xl border border-white/[0.07] bg-black/20 px-4 py-3.5">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-white/40">
                          {note.at ? <time dateTime={note.at}>{note.dated}</time> : <span>{note.dated}</span>}
                          {note.author ? (
                            <span className="text-right font-medium text-white/50">{note.author}</span>
                          ) : null}
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/80">{note.body}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <button
                          type="button"
                          className="grid h-9 w-9 place-items-center rounded-lg text-white/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e88e5]/50 disabled:opacity-40"
                          aria-label="Notitie bewerken"
                          disabled={busy}
                          onClick={() => onEditNote(note)}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="grid h-9 w-9 place-items-center rounded-lg text-white/50 hover:bg-red-500/15 hover:text-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e88e5]/50 disabled:opacity-40"
                          aria-label="Notitie verwijderen"
                          disabled={busy}
                          onClick={() => onDeleteNote(note)}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <CompanyFavouriteProductsSection companyId={company.id} />

      <section id="gebruikers" className={CARD} aria-labelledby="gebruikers-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="gebruikers-heading" className="flex items-center gap-2.5 text-lg font-semibold">
            <Users className="h-4 w-4 text-white/40" aria-hidden />
            Gebruikers van dit bedrijf ({userCount})
          </h2>
          <button type="button" className="a-btn a-btn-primary" onClick={onInviteUser} disabled={busy}>
            <Plus className="h-4 w-4" aria-hidden />
            Gebruiker uitnodigen
          </button>
        </div>

        {userCount === 0 ? (
          <div className="mt-5">
            <div className="overflow-x-auto rounded-2xl border border-white/[0.07]">
              <table className="min-w-[64rem] w-full text-left text-sm">
                <caption className="sr-only">Gebruikers van {name}</caption>
                <UsersTableHead />
              </table>
            </div>
            <EmptyState
              title="Nog geen gebruikers"
              description="Nodig een gebruiker uit. Na activatie verschijnen ze in deze tabel."
            />
          </div>
        ) : (
          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/[0.07]">
            <table className="min-w-[64rem] w-full text-left text-sm">
              <caption className="sr-only">Gebruikers van {name}</caption>
              <UsersTableHead />
              <tbody className="divide-y divide-white/[0.05]">
                {members.map((member) => {
                  const status = memberStatusLabelNl(member);
                  const tone =
                    member.userStatus === "blocked"
                      ? "blocked"
                      : member.membershipStatus === "active"
                        ? "active"
                        : "invited";
                  return (
                    <tr key={member.userId} className="align-middle">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${memberAvatarTone(member.userId)}`}
                            aria-hidden
                          >
                            {memberAvatarInitials(member.fullName, member.email)}
                          </span>
                          <span className="font-medium text-white/90">{member.fullName || "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-white/65">{member.email}</td>
                      <td className="px-4 py-3.5 text-white/70">{memberRoleLabelNl(member.role)}</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 text-sm text-white/80">
                          <StatusDot tone={tone} />
                          {status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-white/60">
                        {lastActivityValueNl(company.updatedAt)}
                      </td>
                      <td className="px-4 py-3.5 tabular-nums text-white/70">
                        {displayOnlyOrderCount(member.userId)}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#8ec8f8] hover:bg-white/10 hover:text-white"
                            onClick={() => onViewMember(member)}
                          >
                            Bekijken
                          </button>
                          <button
                            type="button"
                            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#8ec8f8] hover:bg-white/10 hover:text-white"
                            onClick={() => onEditMember(member)}
                          >
                            Bewerken
                          </button>
                          <MemberMenu
                            name={member.fullName || member.email}
                            items={[
                              {
                                id: "membership",
                                label:
                                  member.membershipStatus === "active"
                                    ? "Lidmaatschap opschorten"
                                    : "Lidmaatschap heractiveren",
                                onSelect: () => onToggleMembership(member),
                                disabled: busy || member.role === "account_admin",
                              },
                              {
                                id: "block",
                                label:
                                  member.userStatus === "blocked" ? "Account deblokkeren" : "Account blokkeren",
                                onSelect: () => onToggleBlock(member),
                                disabled: busy,
                              },
                              ...(onTransferAdmin &&
                              member.role === "account_user" &&
                              member.membershipStatus === "active"
                                ? [
                                    {
                                      id: "transfer",
                                      label: "Beheer overdragen",
                                      onSelect: () => onTransferAdmin(member),
                                      disabled: busy,
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {pendingInvites.map((invite) => (
                  <tr key={`${invite.email}-${invite.intendedRole}`} className="align-middle">
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${memberAvatarTone(invite.email)}`}
                          aria-hidden
                        >
                          {memberAvatarInitials(null, invite.email)}
                        </span>
                        <span className="text-white/50">—</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-white/65">{invite.email}</td>
                    <td className="px-4 py-3.5 text-white/70">{memberRoleLabelNl(invite.intendedRole)}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-sm text-white/80">
                        <StatusDot tone="invited" />
                        Uitgenodigd
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-white/50">—</td>
                    <td className="px-4 py-3.5 tabular-nums text-white/50">0</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-[#8ec8f8] hover:bg-white/10 hover:text-white disabled:opacity-40"
                          disabled={busy}
                          onClick={() => onResendInvite(invite)}
                        >
                          Uitnodiging opnieuw sturen
                        </button>
                        <MemberMenu
                          name={invite.email}
                          items={[
                            {
                              id: "resend",
                              label: "Uitnodiging opnieuw versturen",
                              onSelect: () => onResendInvite(invite),
                              disabled: busy,
                            },
                          ]}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function UsersTableHead() {
  return (
    <thead className="border-b border-white/[0.07] text-[11px] font-medium text-white/40">
      <tr>
        <th className="px-4 py-3 font-medium">Naam</th>
        <th className="px-4 py-3 font-medium">E-mailadres</th>
        <th className="px-4 py-3 font-medium">Rol</th>
        <th className="px-4 py-3 font-medium">Status</th>
        <th className="px-4 py-3 font-medium">Laatste activiteit</th>
        <th className="px-4 py-3 font-medium">Bestellingen</th>
        <th className="px-4 py-3 text-right font-medium">Acties</th>
      </tr>
    </thead>
  );
}

function StatusPill({ label }: { label: string }) {
  return (
    <li>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs text-white/75">
        <StatusDot tone="active" />
        {label}
      </span>
    </li>
  );
}

function StatusDot({ tone }: { tone: string }) {
  const color =
    tone === "blocked" ? "bg-rose-400" : tone === "invited" || tone === "pending" ? "bg-amber-400" : "bg-emerald-400";
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${color}`} aria-hidden />;
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className="flex min-h-12 w-full items-center gap-3 px-0.5 py-2 text-left text-[15px] font-medium text-white/85 hover:text-white disabled:opacity-40"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-white/55">
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
  multiline,
  children,
}: {
  label: string;
  value?: string | null;
  multiline?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(7.75rem,9.5rem)_minmax(0,1fr)] items-start gap-x-4 gap-y-1">
      <p className="text-[11px] font-medium leading-5 tracking-[0.04em] text-white/42">{label}</p>
      <div className={`min-w-0 text-sm leading-5 text-white/88 ${multiline ? "whitespace-pre-line" : ""}`}>
        {children ?? (value && value.trim() ? value : "—")}
      </div>
    </div>
  );
}

function MemberMenu({
  name,
  items,
}: {
  name: string;
  items: Array<{ id: string; label: string; onSelect: () => void; disabled?: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        className="grid h-9 w-9 place-items-center rounded-lg text-white/55 hover:bg-white/10 hover:text-white"
        aria-label={`Meer acties voor ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[13rem] overflow-hidden rounded-xl border border-white/10 bg-[#0c1220] p-1.5 shadow-2xl"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white disabled:text-white/35"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}
