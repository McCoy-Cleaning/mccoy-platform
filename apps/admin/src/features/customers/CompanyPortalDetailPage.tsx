import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  Loader2,
  Save,
  UserPlus,
  Users,
} from "lucide-react";
import {
  partyTypeLabelNl,
  portalStatusLabelNl,
  type CompanyPartyType,
  type CustomerPortalStatus,
} from "@mccoy/domain";

import { PageHeader } from "@/components/admin/AdminBits";
import { EmptyState } from "@/components/admin/EmptyState";
import { ErrorState } from "@/components/admin/ErrorState";
import { AppDialog } from "@/components/admin/AppDialog";
import { Button } from "@/components/ui/button";
import {
  getAdminCompanyPortalDetail,
  inviteAdminPortalAccountAdmin,
  inviteAdminPortalAccountUser,
  resendAdminPortalInvitation,
  setAdminCustomerBlocked,
  setAdminPortalMembershipStatus,
  transferAdminAccountAdmin,
  updateAdminCompany,
  updateAdminCustomer,
} from "@/lib/api/admin-customers.functions";

type CompanyDetail = {
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

type Member = {
  userId: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  role: string;
  membershipStatus: string;
  userStatus: string;
};

type Invitation = {
  email: string;
  intendedRole: string;
  status: string;
  expiresAt: string;
  reminderCount: number;
};

type DetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      company: CompanyDetail;
      portalStatus: CustomerPortalStatus;
      members: Member[];
      invitations: Invitation[];
    };

type CompanyForm = {
  legalName: string;
  displayName: string;
  partyType: CompanyPartyType;
  email: string;
  phone: string;
  kvkNumber: string;
  vatNumber: string;
  contactPersonName: string;
  addressStreet: string;
  addressHouseNumber: string;
  addressHouseSuffix: string;
  addressPostalCode: string;
  addressCity: string;
  addressCountry: string;
  invoiceAllowed: boolean;
  notes: string;
  status: "pending" | "active" | "blocked";
};

function companyToForm(company: CompanyDetail): CompanyForm {
  return {
    legalName: company.legalName,
    displayName: company.displayName ?? "",
    partyType: company.partyType === "private_person" ? "private_person" : "company",
    email: company.email ?? "",
    phone: company.phone ?? "",
    kvkNumber: company.kvkNumber ?? "",
    vatNumber: company.vatNumber ?? "",
    contactPersonName: company.contactPersonName ?? "",
    addressStreet: company.addressStreet ?? "",
    addressHouseNumber: company.addressHouseNumber ?? "",
    addressHouseSuffix: company.addressHouseSuffix ?? "",
    addressPostalCode: company.addressPostalCode ?? "",
    addressCity: company.addressCity ?? "",
    addressCountry: company.addressCountry ?? "",
    invoiceAllowed: company.invoiceAllowed,
    notes: company.notes ?? "",
    status:
      company.status === "pending" || company.status === "blocked" ? company.status : "active",
  };
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block text-sm text-white/80 ${className ?? ""}`}>
      <span className="text-white/55">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export function CompanyPortalDetailPage({ companyId }: { companyId: string }) {
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [form, setForm] = useState<CompanyForm | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<"account_admin" | "account_user">("account_admin");
  const [transferOpen, setTransferOpen] = useState(false);
  const [memberEdit, setMemberEdit] = useState<Member | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [transferUserId, setTransferUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const reload = (opts?: { keepForm?: boolean }) => {
    setState({ status: "loading" });
    void getAdminCompanyPortalDetail({ data: { companyId } }).then((res) => {
      if (!res.ok) {
        setState({ status: "error", message: res.error });
        return;
      }
      const company: CompanyDetail = {
        id: res.company.id,
        legalName: res.company.legalName,
        displayName: res.company.displayName,
        companyType: res.company.companyType,
        partyType: res.company.partyType === "private_person" ? "private_person" : "company",
        status: res.company.status,
        invoiceAllowed: res.company.invoiceAllowed,
        email: res.company.email,
        phone: res.company.phone,
        kvkNumber: res.company.kvkNumber,
        vatNumber: res.company.vatNumber,
        contactPersonName: res.company.contactPersonName,
        addressStreet: res.company.addressStreet,
        addressHouseNumber: res.company.addressHouseNumber,
        addressHouseSuffix: res.company.addressHouseSuffix,
        addressPostalCode: res.company.addressPostalCode,
        addressCity: res.company.addressCity,
        addressCountry: res.company.addressCountry,
        notes: res.company.notes,
        externalCustomerId: res.company.externalCustomerId ?? null,
        createdAt: res.company.createdAt,
        updatedAt: res.company.updatedAt,
      };
      setState({
        status: "ok",
        company,
        portalStatus: res.portalStatus,
        members: res.members.map((m) => ({
          userId: m.userId,
          email: m.email,
          fullName: m.fullName,
          phone: m.phone,
          role: m.role,
          membershipStatus: m.membershipStatus,
          userStatus: m.userStatus,
        })),
        invitations: res.invitations.map((i) => ({
          email: i.email,
          intendedRole: i.intendedRole,
          status: i.status,
          expiresAt: i.expiresAt,
          reminderCount: i.reminderCount,
        })),
      });
      if (!opts?.keepForm) setForm(companyToForm(company));
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  const baseline = state.status === "ok" ? companyToForm(state.company) : null;
  const dirty = useMemo(() => {
    if (!form || !baseline) return false;
    return JSON.stringify(form) !== JSON.stringify(baseline);
  }, [form, baseline]);

  if (state.status === "loading" || !form) {
    return (
      <div className="flex items-center gap-3 p-10 text-white/60" aria-busy="true">
        <Loader2 className="h-5 w-5 animate-spin" /> Portaal laden…
      </div>
    );
  }
  if (state.status === "error") {
    return <ErrorState title="Klant niet geladen" message={state.message} />;
  }

  const { company, portalStatus, members, invitations } = state;
  const admin = members.find((m) => m.role === "account_admin" && m.membershipStatus === "active");
  const accountUsers = members.filter((m) => m.role === "account_user");
  const pendingInvites = invitations.filter((i) => i.status === "pending");
  const selectedMember = members.find((m) => m.userId === selectedMemberId) ?? null;
  const isPrivate = form.partyType === "private_person";

  function patchForm<K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaveError(null);
  }

  async function saveCompany() {
    if (!form) return;
    setBusy(true);
    setSaveError(null);
    const res = await updateAdminCompany({
      data: {
        companyId: company.id,
        legalName: form.legalName.trim(),
        displayName: form.displayName.trim() || null,
        partyType: form.partyType,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        kvkNumber:
          form.partyType === "private_person" ? null : (form.kvkNumber.trim() || null),
        vatNumber:
          form.partyType === "private_person"
            ? null
            : form.vatNumber.trim()
              ? form.vatNumber.trim().toUpperCase()
              : null,
        contactPersonName: form.contactPersonName.trim() || null,
        addressStreet: form.addressStreet.trim() || null,
        addressHouseNumber: form.addressHouseNumber.trim() || null,
        addressHouseSuffix: form.addressHouseSuffix.trim() || null,
        addressPostalCode: form.addressPostalCode.trim() || null,
        addressCity: form.addressCity.trim() || null,
        addressCountry: form.addressCountry.trim() || null,
        invoiceAllowed: form.invoiceAllowed,
        notes: form.notes.trim() || null,
        status: form.status,
      },
    });
    setBusy(false);
    if (!res.ok) {
      setSaveError(res.error);
      setFlash(res.error);
      return;
    }
    setFlash("Klantgegevens opgeslagen.");
    reload();
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <Link
        to="/customers"
        search={{ tab: "portal", q: "", status: "all", portalStatus: "all", page: 1 }}
        className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar serviceklanten
      </Link>

      <PageHeader
        icon={Building2}
        accent="#22c55e"
        title={company.displayName || company.legalName}
        subtitle={`${partyTypeLabelNl(company.partyType)} · ${portalStatusLabelNl(portalStatus)}`}
        actions={[
          {
            label: "Gebruiker uitnodigen",
            icon: UserPlus,
            onClick: () => {
              setInviteRole("account_user");
              setInviteOpen(true);
            },
          },
          {
            label: "Accountbeheerder uitnodigen",
            icon: Building2,
            onClick: () => {
              setInviteRole("account_admin");
              setInviteOpen(true);
            },
          },
        ]}
      />

      {flash ? (
        <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm" role="status">
          {flash}
        </p>
      ) : null}

      {dirty ? (
        <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-[#0b1a12]/95 px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-sm text-emerald-100/90">Je hebt niet-opgeslagen wijzigingen.</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                setForm(companyToForm(company));
                setSaveError(null);
              }}
            >
              Ongedaan maken
            </Button>
            <Button type="button" loading={busy} onClick={() => void saveCompany()}>
              <Save className="mr-2 h-4 w-4" aria-hidden />
              Opslaan
            </Button>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Klantgegevens</h2>
              <p className="mt-1 text-sm text-white/50">
                Bewerk alle velden hieronder. Extern klantnummer blijft vast (import-identiteit).
              </p>
            </div>
            <Button type="button" loading={busy} disabled={!dirty} onClick={() => void saveCompany()}>
              <Save className="mr-2 h-4 w-4" aria-hidden />
              Opslaan
            </Button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Klantsoort">
              <select
                className="a-input w-full"
                value={form.partyType}
                onChange={(e) =>
                  patchForm("partyType", e.target.value as CompanyPartyType)
                }
              >
                <option value="company">Bedrijf</option>
                <option value="private_person">Particulier</option>
              </select>
            </Field>
            <Field label="Operationele status">
              <select
                className="a-input w-full"
                value={form.status}
                onChange={(e) =>
                  patchForm("status", e.target.value as CompanyForm["status"])
                }
              >
                <option value="active">Actief</option>
                <option value="pending">In afwachting</option>
                <option value="blocked">Geblokkeerd / portaal opgeschort</option>
              </select>
            </Field>
            <Field label={isPrivate ? "Naam (juridisch / volledig)" : "Bedrijfsnaam (juridisch)"} className="sm:col-span-2">
              <input
                className="a-input w-full"
                value={form.legalName}
                onChange={(e) => patchForm("legalName", e.target.value)}
              />
            </Field>
            <Field label={isPrivate ? "Weergavenaam (optioneel)" : "Handelsnaam"}>
              <input
                className="a-input w-full"
                value={form.displayName}
                onChange={(e) => patchForm("displayName", e.target.value)}
              />
            </Field>
            <Field label="Contactpersoon">
              <input
                className="a-input w-full"
                value={form.contactPersonName}
                onChange={(e) => patchForm("contactPersonName", e.target.value)}
              />
            </Field>
            <Field label="E-mail">
              <input
                className="a-input w-full"
                type="email"
                value={form.email}
                onChange={(e) => patchForm("email", e.target.value)}
              />
            </Field>
            <Field label="Telefoon">
              <input
                className="a-input w-full"
                value={form.phone}
                onChange={(e) => patchForm("phone", e.target.value)}
              />
            </Field>
            <Field label="KVK (8 cijfers)">
              <input
                className="a-input w-full"
                inputMode="numeric"
                maxLength={8}
                value={form.kvkNumber}
                onChange={(e) => patchForm("kvkNumber", e.target.value.replace(/\D/g, "").slice(0, 8))}
                disabled={isPrivate}
                placeholder={isPrivate ? "N.v.t. voor particulier" : ""}
              />
            </Field>
            <Field label="BTW-nummer">
              <input
                className="a-input w-full"
                value={form.vatNumber}
                onChange={(e) => patchForm("vatNumber", e.target.value)}
                disabled={isPrivate}
                placeholder={isPrivate ? "N.v.t. voor particulier" : ""}
              />
            </Field>
            <Field label="Straat">
              <input
                className="a-input w-full"
                value={form.addressStreet}
                onChange={(e) => patchForm("addressStreet", e.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Huisnr.">
                <input
                  className="a-input w-full"
                  value={form.addressHouseNumber}
                  onChange={(e) => patchForm("addressHouseNumber", e.target.value)}
                />
              </Field>
              <Field label="Toev.">
                <input
                  className="a-input w-full"
                  value={form.addressHouseSuffix}
                  onChange={(e) => patchForm("addressHouseSuffix", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Postcode">
              <input
                className="a-input w-full"
                value={form.addressPostalCode}
                onChange={(e) => patchForm("addressPostalCode", e.target.value)}
              />
            </Field>
            <Field label="Plaats">
              <input
                className="a-input w-full"
                value={form.addressCity}
                onChange={(e) => patchForm("addressCity", e.target.value)}
              />
            </Field>
            <Field label="Land">
              <input
                className="a-input w-full"
                value={form.addressCountry}
                onChange={(e) => patchForm("addressCountry", e.target.value)}
              />
            </Field>
            <Field label="Factuur toegestaan">
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-white/20"
                  checked={form.invoiceAllowed}
                  onChange={(e) => patchForm("invoiceAllowed", e.target.checked)}
                />
                <span className="text-sm text-white/75">Server-side factuurrechten</span>
              </label>
            </Field>
            <Field label="Notities (intern)" className="sm:col-span-2">
              <textarea
                className="a-input min-h-[96px] w-full"
                value={form.notes}
                onChange={(e) => patchForm("notes", e.target.value)}
              />
            </Field>
          </div>
          {saveError ? <p className="mt-3 text-sm text-red-300">{saveError}</p> : null}
        </section>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm">
            <h2 className="text-lg font-semibold">Portaal</h2>
            <dl className="mt-4 space-y-3">
              <div>
                <dt className="text-white/45">Portaalstatus</dt>
                <dd className="mt-1">
                  <span className="rounded-full border border-white/10 px-2.5 py-0.5 text-xs text-white/80">
                    {portalStatusLabelNl(portalStatus)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-white/45">Extern klantnummer</dt>
                <dd className="mt-1 font-mono text-white/85">{company.externalCustomerId || "—"}</dd>
              </div>
              <div>
                <dt className="text-white/45">Accountbeheerder</dt>
                <dd className="mt-1 text-white/85">
                  {admin ? `${admin.fullName || admin.email} (${admin.email})` : "Nog geen"}
                </dd>
              </div>
              <div>
                <dt className="text-white/45">Aangemaakt</dt>
                <dd className="mt-1 text-white/70">
                  {new Date(company.createdAt).toLocaleString("nl-NL")}
                </dd>
              </div>
              <div>
                <dt className="text-white/45">Laatst bijgewerkt</dt>
                <dd className="mt-1 text-white/70">
                  {new Date(company.updatedAt).toLocaleString("nl-NL")}
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    const blocked = company.status !== "blocked";
                    const res = await updateAdminCompany({
                      data: {
                        companyId: company.id,
                        status: blocked ? "blocked" : "active",
                      },
                    });
                    setBusy(false);
                    if (!res.ok) setFlash(res.error);
                    else {
                      setFlash(blocked ? "Portaaltoegang opgeschort." : "Portaaltoegang hersteld.");
                      reload();
                    }
                  })();
                }}
              >
                {portalStatus === "suspended" || company.status === "blocked"
                  ? "Portaal heropenen"
                  : "Portaal opschorten"}
              </Button>
              {admin && accountUsers.some((u) => u.membershipStatus === "active") ? (
                <Button type="button" variant="outline" onClick={() => setTransferOpen(true)}>
                  Beheer overdragen
                </Button>
              ) : null}
            </div>
          </section>
        </aside>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Gebruikers onder deze klant</h2>
            <p className="mt-1 text-sm text-white/50">
              Portaalaccounts die bij dit {isPrivate ? "particulier profiel" : "bedrijf"} horen.
              Klik een rij voor details en acties.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setInviteRole("account_user");
              setInviteOpen(true);
            }}
          >
            <UserPlus className="mr-2 h-4 w-4" aria-hidden />
            Uitnodigen
          </Button>
        </div>

        {members.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Users}
              title="Nog geen geregistreerde gebruikers"
              description="Nodig een accountbeheerder of gebruiker uit. Na activatie verschijnen ze hier."
            />
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(260px,0.8fr)]">
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/45">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Naam</th>
                    <th className="px-3 py-2.5 font-medium">E-mail</th>
                    <th className="px-3 py-2.5 font-medium">Rol</th>
                    <th className="px-3 py-2.5 font-medium">Lidmaatschap</th>
                    <th className="px-3 py-2.5 font-medium">Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {members.map((m) => {
                    const selected = selectedMemberId === m.userId;
                    return (
                      <tr
                        key={m.userId}
                        className={
                          selected
                            ? "cursor-pointer bg-emerald-500/10"
                            : "cursor-pointer hover:bg-white/[0.03]"
                        }
                        onClick={() => setSelectedMemberId(m.userId)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedMemberId(m.userId);
                          }
                        }}
                        tabIndex={0}
                        aria-selected={selected}
                      >
                        <td className="px-3 py-3 font-medium text-white/90">
                          {m.fullName || "—"}
                        </td>
                        <td className="px-3 py-3 text-white/70">{m.email}</td>
                        <td className="px-3 py-3 text-white/70">
                          {m.role === "account_admin" ? "Accountbeheerder" : "Gebruiker"}
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/75">
                            {m.membershipStatus === "active" ? "Actief" : "Opgeschort"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs text-white/75">
                            {m.userStatus === "blocked" ? "Geblokkeerd" : "Actief"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              {selectedMember ? (
                <div className="space-y-3 text-sm">
                  <h3 className="text-base font-semibold text-white/90">
                    {selectedMember.fullName || selectedMember.email}
                  </h3>
                  <dl className="space-y-2">
                    <div>
                      <dt className="text-white/45">E-mail</dt>
                      <dd className="text-white/85">{selectedMember.email}</dd>
                    </div>
                    <div>
                      <dt className="text-white/45">Telefoon</dt>
                      <dd className="text-white/85">{selectedMember.phone || "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-white/45">Rol</dt>
                      <dd className="text-white/85">
                        {selectedMember.role === "account_admin"
                          ? "Accountbeheerder"
                          : "Gebruiker"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-white/45">Lidmaatschap</dt>
                      <dd className="text-white/85">
                        {selectedMember.membershipStatus === "active" ? "Actief" : "Opgeschort"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-white/45">Accountstatus</dt>
                      <dd className="text-white/85">
                        {selectedMember.userStatus === "blocked" ? "Geblokkeerd" : "Actief"}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex flex-col gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setMemberEdit(selectedMember)}
                    >
                      Profiel bewerken
                    </Button>
                    {selectedMember.role !== "account_admin" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        onClick={() => {
                          void (async () => {
                            setBusy(true);
                            const next =
                              selectedMember.membershipStatus === "active"
                                ? "suspended"
                                : "active";
                            const res = await setAdminPortalMembershipStatus({
                              data: {
                                companyId: company.id,
                                userId: selectedMember.userId,
                                status: next,
                              },
                            });
                            setBusy(false);
                            if (!res.ok) setFlash(res.error);
                            else {
                              setFlash(
                                next === "suspended"
                                  ? "Lidmaatschap opgeschort."
                                  : "Lidmaatschap hersteld.",
                              );
                              reload({ keepForm: true });
                            }
                          })();
                        }}
                      >
                        {selectedMember.membershipStatus === "active"
                          ? "Lidmaatschap opschorten"
                          : "Lidmaatschap heractiveren"}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-red-500/30 text-red-200 hover:bg-red-500/10"
                      disabled={busy}
                      onClick={() => {
                        void (async () => {
                          setBusy(true);
                          const blocked = selectedMember.userStatus !== "blocked";
                          const res = await setAdminCustomerBlocked({
                            data: {
                              customerId: selectedMember.userId,
                              blocked,
                            },
                          });
                          setBusy(false);
                          if (!res.ok) setFlash(res.error);
                          else {
                            setFlash(blocked ? "Gebruikersaccount geblokkeerd." : "Gebruikersaccount gedeblokkeerd.");
                            reload({ keepForm: true });
                          }
                        })();
                      }}
                    >
                      {selectedMember.userStatus === "blocked"
                        ? "Account deblokkeren"
                        : "Account blokkeren"}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-white/55">
                  Selecteer een gebruiker in de tabel om details en acties te zien.
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-lg font-semibold">Uitnodigingen</h2>
        {pendingInvites.length === 0 ? (
          <p className="mt-3 text-sm text-white/55">Geen openstaande uitnodigingen.</p>
        ) : (
          <ul className="mt-4 divide-y divide-white/5 text-sm">
            {pendingInvites.map((inv) => (
              <li
                key={`${inv.email}-${inv.intendedRole}`}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <span className="text-white/85">{inv.email}</span>
                  <span className="ml-2 text-white/45">
                    {inv.intendedRole === "account_admin" ? "Accountbeheerder" : "Gebruiker"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50">
                    Verloopt {new Date(inv.expiresAt).toLocaleString("nl-NL")}
                    {inv.reminderCount > 0 ? ` · ${inv.reminderCount} herinnering(en)` : ""}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      void (async () => {
                        setBusy(true);
                        const res = await resendAdminPortalInvitation({
                          data: {
                            companyId: company.id,
                            email: inv.email,
                            intendedRole:
                              inv.intendedRole === "account_admin"
                                ? "account_admin"
                                : "account_user",
                          },
                        });
                        setBusy(false);
                        if (!res.ok) setFlash(res.error);
                        else {
                          setFlash("Uitnodiging opnieuw verstuurd.");
                          reload({ keepForm: true });
                        }
                      })();
                    }}
                  >
                    Opnieuw versturen
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AppDialog
        open={inviteOpen}
        onOpenChange={(v) => {
          if (!v) setInviteOpen(false);
        }}
        title={
          inviteRole === "account_admin"
            ? "Accountbeheerder uitnodigen"
            : "Gebruiker uitnodigen"
        }
        description="De uitgenodigde activeert het account en stelt zelf een wachtwoord in."
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setInviteOpen(false)}
              disabled={busy}
            >
              Annuleren
            </Button>
            <Button
              type="button"
              loading={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  const payload = {
                    companyId: company.id,
                    email: inviteEmail,
                    firstName: inviteFirstName || null,
                    lastName: inviteLastName || null,
                  };
                  const res =
                    inviteRole === "account_admin"
                      ? await inviteAdminPortalAccountAdmin({ data: payload })
                      : await inviteAdminPortalAccountUser({
                          data: { ...payload, phone: invitePhone || null },
                        });
                  setBusy(false);
                  if (!res.ok) setFlash(res.error);
                  else {
                    setInviteOpen(false);
                    setInviteEmail("");
                    setInviteFirstName("");
                    setInviteLastName("");
                    setInvitePhone("");
                    setFlash("Uitnodiging verstuurd.");
                    reload({ keepForm: true });
                  }
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
            <input
              className="a-input mt-1 w-full"
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm text-white/80">
            Voornaam
            <input
              className="a-input mt-1 w-full"
              value={inviteFirstName}
              onChange={(e) => setInviteFirstName(e.target.value)}
            />
          </label>
          <label className="block text-sm text-white/80">
            Achternaam
            <input
              className="a-input mt-1 w-full"
              value={inviteLastName}
              onChange={(e) => setInviteLastName(e.target.value)}
            />
          </label>
          {inviteRole === "account_user" ? (
            <label className="block text-sm text-white/80">
              Telefoon (optioneel)
              <input
                className="a-input mt-1 w-full"
                value={invitePhone}
                onChange={(e) => setInvitePhone(e.target.value)}
              />
            </label>
          ) : null}
        </div>
      </AppDialog>

      <AppDialog
        open={transferOpen}
        onOpenChange={(v) => {
          if (!v) setTransferOpen(false);
        }}
        title="Accountbeheer overdragen"
        description="Selecteer een actieve gebruiker die accountbeheerder wordt."
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTransferOpen(false)}
              disabled={busy}
            >
              Annuleren
            </Button>
            <Button
              type="button"
              loading={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  const res = await transferAdminAccountAdmin({
                    data: { companyId: company.id, newUserId: transferUserId },
                  });
                  setBusy(false);
                  if (!res.ok) setFlash(res.error);
                  else {
                    setTransferOpen(false);
                    setFlash("Accountbeheer overgedragen.");
                    reload({ keepForm: true });
                  }
                })();
              }}
            >
              Overdragen
            </Button>
          </>
        }
      >
        <label className="block text-sm text-white/80">
          Nieuwe accountbeheerder
          <select
            className="a-input mt-1 w-full"
            value={transferUserId}
            onChange={(e) => setTransferUserId(e.target.value)}
          >
            <option value="">Selecteer…</option>
            {accountUsers
              .filter((u) => u.membershipStatus === "active")
              .map((u) => (
                <option key={u.userId} value={u.userId}>
                  {u.fullName || u.email}
                </option>
              ))}
          </select>
        </label>
      </AppDialog>

      <AppDialog
        open={Boolean(memberEdit)}
        onOpenChange={(v) => {
          if (!v) setMemberEdit(null);
        }}
        title="Gebruikersprofiel bewerken"
        description="E-mail wijzigen gebeurt via Auth, niet via dit formulier."
        footer={
          memberEdit ? (
            <EditMemberFooter
              member={memberEdit}
              onCancel={() => setMemberEdit(null)}
              onDone={() => {
                setMemberEdit(null);
                setFlash("Gebruikersprofiel bijgewerkt.");
                reload({ keepForm: true });
              }}
            />
          ) : null
        }
      >
        {memberEdit ? (
          <p className="text-sm text-white/55">
            Pas naam en telefoon aan. E-mail blijft {memberEdit.email}.
          </p>
        ) : null}
      </AppDialog>
    </div>
  );
}

function EditMemberFooter({
  member,
  onDone,
  onCancel,
}: {
  member: Member;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [fullName, setFullName] = useState(member.fullName ?? "");
  const [phone, setPhone] = useState(member.phone ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <div className="mb-4 w-full space-y-3 text-left">
        <label className="block text-sm">
          Naam
          <input
            className="a-input mt-1 w-full"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Telefoon
          <input
            className="a-input mt-1 w-full"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
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
                customerId: member.userId,
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
