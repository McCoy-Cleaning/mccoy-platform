import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import type { CompanyPartyType, CustomerPortalStatus } from "@mccoy/domain";

import { EmptyState } from "@/components/admin/EmptyState";
import { ErrorState } from "@/components/admin/ErrorState";
import { AppDialog } from "@/components/admin/AppDialog";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { Button } from "@/components/ui/button";
import { useAdminSession } from "@/lib/admin-auth";
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
import {
  CompanyProfileLayout,
  type CompanyProfileCompany,
  type CompanyProfileInvitation,
  type CompanyProfileMember,
} from "./components/CompanyProfileLayout";
import {
  companyNoteIndex,
  formatStaffNoteAuthor,
  prependCompanyNote,
  removeCompanyNote,
  replaceCompanyNote,
  type ProfileNote,
} from "./lib/company-profile";

type DetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ok";
      company: CompanyProfileCompany;
      portalStatus: CustomerPortalStatus;
      members: CompanyProfileMember[];
      invitations: CompanyProfileInvitation[];
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

function companyToForm(company: CompanyProfileCompany): CompanyForm {
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

function mapCompany(res: {
  id: string;
  legalName: string;
  displayName: string | null;
  companyType: string;
  partyType: string;
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
  externalCustomerId?: string | null;
  createdAt: string;
  updatedAt: string;
}): CompanyProfileCompany {
  return {
    id: res.id,
    legalName: res.legalName,
    displayName: res.displayName,
    companyType: res.companyType,
    partyType: res.partyType === "private_person" ? "private_person" : "company",
    status: res.status,
    invoiceAllowed: res.invoiceAllowed,
    email: res.email,
    phone: res.phone,
    kvkNumber: res.kvkNumber,
    vatNumber: res.vatNumber,
    contactPersonName: res.contactPersonName,
    addressStreet: res.addressStreet,
    addressHouseNumber: res.addressHouseNumber,
    addressHouseSuffix: res.addressHouseSuffix,
    addressPostalCode: res.addressPostalCode,
    addressCity: res.addressCity,
    addressCountry: res.addressCountry,
    notes: res.notes,
    externalCustomerId: res.externalCustomerId ?? null,
    createdAt: res.createdAt,
    updatedAt: res.updatedAt,
  };
}

export function CompanyPortalDetailPage({ companyId }: { companyId: string }) {
  const navigate = useNavigate();
  const [state, setState] = useState<DetailState>({ status: "loading" });
  const [form, setForm] = useState<CompanyForm | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<"account_admin" | "account_user">("account_user");
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [editNote, setEditNote] = useState<ProfileNote | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [deleteNote, setDeleteNote] = useState<ProfileNote | null>(null);
  const [portalConfirmOpen, setPortalConfirmOpen] = useState(false);
  const [memberEdit, setMemberEdit] = useState<CompanyProfileMember | null>(null);
  const [transferUserId, setTransferUserId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [invitePhone, setInvitePhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { session } = useAdminSession();

  const reload = () => {
    setState({ status: "loading" });
    void getAdminCompanyPortalDetail({ data: { companyId } }).then((res) => {
      if (!res.ok) {
        setState({ status: "error", message: res.error });
        return;
      }
      const company = mapCompany(res.company);
      setState({
        status: "ok",
        company,
        portalStatus: res.portalStatus,
        members: res.members.map((member) => ({
          userId: member.userId,
          email: member.email,
          fullName: member.fullName,
          phone: member.phone,
          role: member.role,
          membershipStatus: member.membershipStatus,
          userStatus: member.userStatus,
        })),
        invitations: res.invitations.map((invite) => ({
          email: invite.email,
          intendedRole: invite.intendedRole,
          status: invite.status,
          expiresAt: invite.expiresAt,
          reminderCount: invite.reminderCount,
        })),
      });
      setForm(companyToForm(company));
    });
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId]);

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-3 p-10 text-white/60" aria-busy="true">
        <Loader2 className="h-5 w-5 animate-spin" />
        Bedrijfsprofiel laden…
      </div>
    );
  }
  if (state.status === "error") {
    return <ErrorState title="Klant niet geladen" message={state.message} onRetry={reload} />;
  }
  if (!form) {
    return <EmptyState title="Klantgegevens ontbreken" description="Probeer de pagina opnieuw te laden." />;
  }

  const { company, portalStatus, members, invitations } = state;
  const isPrivate = form.partyType === "private_person";

  function patchForm<K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaveError(null);
  }

  async function saveCompany(next?: Partial<CompanyForm>) {
    if (!form) return false;
    const payload = { ...form, ...next };
    setBusy(true);
    setSaveError(null);
    const res = await updateAdminCompany({
      data: {
        companyId: company.id,
        legalName: payload.legalName.trim(),
        displayName: payload.displayName.trim() || null,
        partyType: payload.partyType,
        email: payload.email.trim() || null,
        phone: payload.phone.trim() || null,
        kvkNumber: payload.partyType === "private_person" ? null : payload.kvkNumber.trim() || null,
        vatNumber:
          payload.partyType === "private_person"
            ? null
            : payload.vatNumber.trim()
              ? payload.vatNumber.trim().toUpperCase()
              : null,
        contactPersonName: payload.contactPersonName.trim() || null,
        addressStreet: payload.addressStreet.trim() || null,
        addressHouseNumber: payload.addressHouseNumber.trim() || null,
        addressHouseSuffix: payload.addressHouseSuffix.trim() || null,
        addressPostalCode: payload.addressPostalCode.trim() || null,
        addressCity: payload.addressCity.trim() || null,
        addressCountry: payload.addressCountry.trim() || null,
        invoiceAllowed: payload.invoiceAllowed,
        notes: payload.notes.trim() || null,
        status: payload.status,
      },
    });
    setBusy(false);
    if (!res.ok) {
      setSaveError(res.error);
      setFlash(res.error);
      return false;
    }
    return true;
  }

  return (
    <>
      <CompanyProfileLayout
        company={company}
        portalStatus={portalStatus}
        members={members}
        invitations={invitations}
        flash={flash}
        busy={busy}
        onInviteUser={() => {
          setInviteRole("account_user");
          setInviteOpen(true);
        }}
        onEditCompany={() => {
          setForm(companyToForm(company));
          setSaveError(null);
          setEditOpen(true);
        }}
        onChangePortalStatus={() => setPortalConfirmOpen(true)}
        onAddNote={() => {
          setNoteDraft("");
          setNoteOpen(true);
        }}
        onEditNote={(note) => {
          setEditNote(note);
          setEditDraft(note.body);
          setSaveError(null);
        }}
        onDeleteNote={setDeleteNote}
        onViewMember={(member) => {
          void navigate({
            to: "/users/$userId",
            // Composite directory id keeps the company scope; a bare user id would let the
            // detail page resolve a different company for multi-company members.
            params: { userId: `m:${companyId}:${member.userId}` },
            search: { q: "", companyId: undefined, userId: undefined, page: 1 },
          });
        }}
        onEditMember={setMemberEdit}
        onToggleMembership={(member) => {
          void (async () => {
            setBusy(true);
            const next = member.membershipStatus === "active" ? "suspended" : "active";
            const res = await setAdminPortalMembershipStatus({
              data: { companyId: company.id, userId: member.userId, status: next },
            });
            setBusy(false);
            if (!res.ok) setFlash(res.error);
            else {
              setFlash(next === "suspended" ? "Lidmaatschap opgeschort." : "Lidmaatschap hersteld.");
              reload();
            }
          })();
        }}
        onToggleBlock={(member) => {
          void (async () => {
            setBusy(true);
            const blocked = member.userStatus !== "blocked";
            const res = await setAdminCustomerBlocked({
              data: { customerId: member.userId, blocked },
            });
            setBusy(false);
            if (!res.ok) setFlash(res.error);
            else {
              setFlash(blocked ? "Gebruikersaccount geblokkeerd." : "Gebruikersaccount gedeblokkeerd.");
              reload();
            }
          })();
        }}
        onTransferAdmin={(member) => setTransferUserId(member.userId)}
        onResendInvite={(invite) => {
          void (async () => {
            setBusy(true);
            const res = await resendAdminPortalInvitation({
              data: {
                companyId: company.id,
                email: invite.email,
                intendedRole: invite.intendedRole === "account_admin" ? "account_admin" : "account_user",
              },
            });
            setBusy(false);
            if (!res.ok) setFlash(res.error);
            else {
              setFlash("Uitnodiging opnieuw verstuurd.");
              reload();
            }
          })();
        }}
      />

      <AppDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Bedrijf bewerken"
        description="Wijzigingen worden server-side opgeslagen. Facturatie toegestaan blijft alleen een weergave- en beleidsvlag."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>
              Annuleren
            </Button>
            <Button
              type="button"
              loading={busy}
              onClick={() => {
                void saveCompany().then((ok) => {
                  if (!ok) return;
                  setEditOpen(false);
                  setFlash("Klantgegevens opgeslagen.");
                  reload();
                });
              }}
            >
              Opslaan
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Klantsoort">
            <select
              className="a-input w-full"
              value={form.partyType}
              onChange={(event) => patchForm("partyType", event.target.value as CompanyPartyType)}
            >
              <option value="company">Bedrijf</option>
              <option value="private_person">Particulier</option>
            </select>
          </Field>
          <Field label="Registratiestatus">
            <select
              className="a-input w-full"
              value={form.status}
              onChange={(event) => patchForm("status", event.target.value as CompanyForm["status"])}
            >
              <option value="active">Actief</option>
              <option value="pending">In afwachting</option>
              <option value="blocked">Geblokkeerd / portaal opgeschort</option>
            </select>
          </Field>
          <Field label="Bedrijfsnaam (juridisch)" className="sm:col-span-2">
            <input
              className="a-input w-full"
              value={form.legalName}
              onChange={(event) => patchForm("legalName", event.target.value)}
            />
          </Field>
          <Field label="Handelsnaam">
            <input
              className="a-input w-full"
              value={form.displayName}
              onChange={(event) => patchForm("displayName", event.target.value)}
            />
          </Field>
          <Field label="Contactpersoon">
            <input
              className="a-input w-full"
              value={form.contactPersonName}
              onChange={(event) => patchForm("contactPersonName", event.target.value)}
            />
          </Field>
          <Field label="Contact e-mail">
            <input
              className="a-input w-full"
              type="email"
              value={form.email}
              onChange={(event) => patchForm("email", event.target.value)}
            />
          </Field>
          <Field label="Telefoonnummer">
            <input
              className="a-input w-full"
              value={form.phone}
              onChange={(event) => patchForm("phone", event.target.value)}
            />
          </Field>
          <Field label="KvK-nummer">
            <input
              className="a-input w-full"
              inputMode="numeric"
              maxLength={8}
              value={form.kvkNumber}
              onChange={(event) =>
                patchForm("kvkNumber", event.target.value.replace(/\D/g, "").slice(0, 8))
              }
              disabled={isPrivate}
            />
          </Field>
          <Field label="BTW-nummer">
            <input
              className="a-input w-full"
              value={form.vatNumber}
              onChange={(event) => patchForm("vatNumber", event.target.value)}
              disabled={isPrivate}
            />
          </Field>
          <Field label="Straat">
            <input
              className="a-input w-full"
              value={form.addressStreet}
              onChange={(event) => patchForm("addressStreet", event.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Huisnr.">
              <input
                className="a-input w-full"
                value={form.addressHouseNumber}
                onChange={(event) => patchForm("addressHouseNumber", event.target.value)}
              />
            </Field>
            <Field label="Toev.">
              <input
                className="a-input w-full"
                value={form.addressHouseSuffix}
                onChange={(event) => patchForm("addressHouseSuffix", event.target.value)}
              />
            </Field>
          </div>
          <Field label="Postcode">
            <input
              className="a-input w-full"
              value={form.addressPostalCode}
              onChange={(event) => patchForm("addressPostalCode", event.target.value)}
            />
          </Field>
          <Field label="Plaats">
            <input
              className="a-input w-full"
              value={form.addressCity}
              onChange={(event) => patchForm("addressCity", event.target.value)}
            />
          </Field>
          <Field label="Land">
            <input
              className="a-input w-full"
              value={form.addressCountry}
              onChange={(event) => patchForm("addressCountry", event.target.value)}
            />
          </Field>
          <Field label="Facturatie toegestaan">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-white/20"
                checked={form.invoiceAllowed}
                onChange={(event) => patchForm("invoiceAllowed", event.target.checked)}
              />
              <span className="text-sm text-white/75">Bestaande invoice_allowed vlag</span>
            </label>
          </Field>
        </div>
        {saveError ? <p className="mt-3 text-sm text-red-300">{saveError}</p> : null}
      </AppDialog>

      <AppDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        title="Notitie toevoegen"
        description="De notitie wordt toegevoegd aan het bestaande interne notitieveld van dit bedrijf."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setNoteOpen(false)} disabled={busy}>
              Annuleren
            </Button>
            <Button
              type="button"
              loading={busy}
              onClick={() => {
                void saveCompany({
                  notes: prependCompanyNote(company.notes, noteDraft, {
                    author: formatStaffNoteAuthor(session?.username ?? ""),
                  }),
                }).then((ok) => {
                  if (!ok) return;
                  setNoteOpen(false);
                  setFlash("Notitie toegevoegd.");
                  reload();
                });
              }}
            >
              Toevoegen
            </Button>
          </>
        }
      >
        <label className="block text-sm text-white/80">
          Notitie
          <textarea
            className="a-input mt-1 min-h-[120px] w-full"
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
          />
        </label>
      </AppDialog>

      <AppDialog
        open={Boolean(editNote)}
        onOpenChange={(open) => {
          if (!open && !busy) setEditNote(null);
        }}
        title="Notitie bewerken"
        description="Alleen de tekst van deze notitie wordt aangepast. Datum en auteur blijven hetzelfde."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditNote(null)} disabled={busy}>
              Annuleren
            </Button>
            <Button
              type="button"
              loading={busy}
              disabled={busy || !editDraft.trim()}
              onClick={() => {
                if (!editNote || busy) return;
                void saveCompany({
                  notes: replaceCompanyNote(company.notes, companyNoteIndex(editNote.id), editDraft),
                }).then((ok) => {
                  if (!ok) return;
                  setEditNote(null);
                  setFlash("Notitie bijgewerkt.");
                  reload();
                });
              }}
            >
              Opslaan
            </Button>
          </>
        }
      >
        <label className="block text-sm text-white/80">
          Notitie
          <textarea
            className="a-input mt-1 min-h-[120px] w-full"
            value={editDraft}
            onChange={(event) => setEditDraft(event.target.value)}
            disabled={busy}
          />
        </label>
      </AppDialog>

      <ConfirmationDialog
        open={Boolean(deleteNote)}
        title="Notitie verwijderen?"
        description={
          deleteNote
            ? `Deze notitie wordt verwijderd van het bedrijfsprofiel.\n\n${
                deleteNote.body.length > 200 ? `${deleteNote.body.slice(0, 200)}…` : deleteNote.body
              }`
            : "Deze notitie wordt verwijderd van het bedrijfsprofiel."
        }
        confirmLabel="Verwijderen"
        tone="destructive"
        pending={busy}
        onCancel={() => {
          if (!busy) setDeleteNote(null);
        }}
        onConfirm={async () => {
          if (!deleteNote || busy) return;
          const ok = await saveCompany({
            notes: removeCompanyNote(company.notes, companyNoteIndex(deleteNote.id)),
          });
          if (!ok) return;
          setDeleteNote(null);
          setFlash("Notitie verwijderd.");
          reload();
        }}
      />

      <AppDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        title={inviteRole === "account_admin" ? "Accountbeheerder uitnodigen" : "Gebruiker uitnodigen"}
        description="De uitgenodigde activeert het account en stelt zelf een wachtwoord in."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setInviteOpen(false)} disabled={busy}>
              Annuleren
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() =>
                setInviteRole((current) =>
                  current === "account_admin" ? "account_user" : "account_admin",
                )
              }
            >
              {inviteRole === "account_admin" ? "Wissel naar gebruiker" : "Wissel naar accountbeheerder"}
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
                    reload();
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
              onChange={(event) => setInviteEmail(event.target.value)}
            />
          </label>
          <label className="block text-sm text-white/80">
            Voornaam
            <input
              className="a-input mt-1 w-full"
              value={inviteFirstName}
              onChange={(event) => setInviteFirstName(event.target.value)}
            />
          </label>
          <label className="block text-sm text-white/80">
            Achternaam
            <input
              className="a-input mt-1 w-full"
              value={inviteLastName}
              onChange={(event) => setInviteLastName(event.target.value)}
            />
          </label>
          {inviteRole === "account_user" ? (
            <label className="block text-sm text-white/80">
              Telefoon (optioneel)
              <input
                className="a-input mt-1 w-full"
                value={invitePhone}
                onChange={(event) => setInvitePhone(event.target.value)}
              />
            </label>
          ) : null}
        </div>
      </AppDialog>

      <ConfirmationDialog
        open={portalConfirmOpen}
        title={
          portalStatus === "suspended" || company.status === "blocked"
            ? "Portaal heropenen?"
            : "Portaalstatus wijzigen?"
        }
        description={
          portalStatus === "suspended" || company.status === "blocked"
            ? "Het bedrijf krijgt weer portaaltoegang wanneer de status actief is."
            : "Opschorten zet de bedrijfsstatus op geblokkeerd. Gebruikers kunnen het portaal dan niet gebruiken."
        }
        confirmLabel={
          portalStatus === "suspended" || company.status === "blocked" ? "Portaal heropenen" : "Portaal opschorten"
        }
        tone={portalStatus === "suspended" || company.status === "blocked" ? "default" : "warning"}
        pending={busy}
        onCancel={() => setPortalConfirmOpen(false)}
        onConfirm={async () => {
          const blocked = company.status !== "blocked";
          const res = await updateAdminCompany({
            data: { companyId: company.id, status: blocked ? "blocked" : "active" },
          });
          setPortalConfirmOpen(false);
          if (!res.ok) setFlash(res.error);
          else {
            setFlash(blocked ? "Portaaltoegang opgeschort." : "Portaaltoegang hersteld.");
            reload();
          }
        }}
      />

      <AppDialog
        open={Boolean(transferUserId)}
        onOpenChange={(open) => {
          if (!open) setTransferUserId(null);
        }}
        title="Accountbeheer overdragen"
        description="Deze gebruiker wordt accountbeheerder van het bedrijf."
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTransferUserId(null)}
              disabled={busy}
            >
              Annuleren
            </Button>
            <Button
              type="button"
              loading={busy}
              onClick={() => {
                if (!transferUserId) return;
                void (async () => {
                  setBusy(true);
                  const res = await transferAdminAccountAdmin({
                    data: { companyId: company.id, newUserId: transferUserId },
                  });
                  setBusy(false);
                  if (!res.ok) setFlash(res.error);
                  else {
                    setTransferUserId(null);
                    setFlash("Accountbeheer overgedragen.");
                    reload();
                  }
                })();
              }}
            >
              Overdragen
            </Button>
          </>
        }
      >
        <p className="text-sm text-white/70">
          {members.find((member) => member.userId === transferUserId)?.fullName ||
            members.find((member) => member.userId === transferUserId)?.email ||
            "Geselecteerde gebruiker"}{" "}
          wordt de nieuwe accountbeheerder.
        </p>
      </AppDialog>

      <AppDialog
        open={Boolean(memberEdit)}
        onOpenChange={(open) => {
          if (!open) setMemberEdit(null);
        }}
        title="Gebruiker bewerken"
        description="E-mail wijzigen gebeurt via Auth, niet via dit formulier."
        footer={
          memberEdit ? (
            <EditMemberFooter
              member={memberEdit}
              onCancel={() => setMemberEdit(null)}
              onDone={() => {
                setMemberEdit(null);
                setFlash("Gebruikersprofiel bijgewerkt.");
                reload();
              }}
            />
          ) : null
        }
      >
        {memberEdit ? (
          <p className="text-sm text-white/55">Pas naam en telefoon aan. E-mail blijft {memberEdit.email}.</p>
        ) : null}
      </AppDialog>
    </>
  );
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

function EditMemberFooter({
  member,
  onDone,
  onCancel,
}: {
  member: CompanyProfileMember;
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
            onChange={(event) => setFullName(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          Telefoon
          <input
            className="a-input mt-1 w-full"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
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
