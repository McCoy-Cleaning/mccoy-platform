import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { AppDialog } from "@/components/admin/AppDialog";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { EmptyState } from "@/components/admin/EmptyState";
import { ErrorState } from "@/components/admin/ErrorState";
import { Button } from "@/components/ui/button";
import {
  getAdminCompanyPortalDetail,
  resendAdminPortalInvitation,
  setAdminCustomerBlocked,
  updateAdminCustomer,
} from "@/lib/api/admin-customers.functions";
import {
  getAdminPortalUserDetail,
  requestAdminPortalUserPasswordReset,
} from "@/lib/api/admin-users.functions";

import { UserDetailLayout } from "./components/UserDetailLayout";
import { toAdminUserDetailView, type UserDetailNote, type UserDetailView } from "./lib/user-detail-view";
import { formatNlDateTime } from "./lib/users-view";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; detail: UserDetailView };

export function UserDetailPage({ userId }: { userId: string }) {
  const [page, setPage] = useState<PageState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [resendOpen, setResendOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const [localNotes, setLocalNotes] = useState<UserDetailNote[]>([]);

  function reload() {
    setPage({ status: "loading" });
    void getAdminPortalUserDetail({ data: { userId } }).then(async (res) => {
      if (!res.ok) {
        setPage({ status: "error", message: res.error });
        return;
      }
      const companyRes = await getAdminCompanyPortalDetail({
        data: { companyId: res.detail.companyId },
      });
      const detail = toAdminUserDetailView(
        res.detail,
        companyRes.ok
          ? {
              companyType: companyRes.company.companyType,
              kvkNumber: companyRes.company.kvkNumber,
              vatNumber: companyRes.company.vatNumber,
              invoiceAllowed: companyRes.company.invoiceAllowed,
              members: companyRes.members,
              invitations: companyRes.invitations,
            }
          : null,
      );
      setPage({ status: "ok", detail });
      setFirstName(detail.firstName);
      setLastName(detail.lastName);
      setPhone(detail.phone ?? "");
      setLocalNotes([]);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (page.status === "loading") {
    return (
      <div className="flex items-center gap-3 p-10 text-white/60" aria-busy="true">
        <Loader2 className="h-5 w-5 animate-spin" />
        Gebruikersdetails laden…
      </div>
    );
  }
  if (page.status === "error") {
    return <ErrorState title="Gebruiker niet geladen" message={page.message} onRetry={reload} />;
  }

  const detail: UserDetailView = {
    ...page.detail,
    notes: [...localNotes, ...page.detail.notes],
  };

  async function saveProfile() {
    if (!detail.userId || busy) return;
    setBusy(true);
    setEditError(null);
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ") || null;
    const res = await updateAdminCustomer({
      data: { customerId: detail.userId, fullName, phone: phone.trim() || null },
    });
    setBusy(false);
    if (!res.ok) {
      setEditError(res.error);
      return;
    }
    setEditOpen(false);
    setFlash("Gegevens opgeslagen.");
    reload();
  }

  async function confirmReset() {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    const res = await requestAdminPortalUserPasswordReset({ data: { userId } });
    setBusy(false);
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    setResetOpen(false);
    setFlash("Wachtwoordreset verstuurd naar het e-mailadres van deze gebruiker.");
  }

  async function confirmDeactivate() {
    if (!detail.userId || busy) return;
    setBusy(true);
    setActionError(null);
    const res = await setAdminCustomerBlocked({
      data: { customerId: detail.userId, blocked: !detail.blocked },
    });
    setBusy(false);
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    setDeactivateOpen(false);
    setFlash(detail.blocked ? "Gebruiker gedeblokkeerd." : "Gebruiker geblokkeerd.");
    reload();
  }

  async function confirmResend() {
    if (busy) return;
    setBusy(true);
    setActionError(null);
    const res = await resendAdminPortalInvitation({
      data: {
        companyId: detail.companyId,
        email: detail.email,
        intendedRole: detail.role,
      },
    });
    setBusy(false);
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    setResendOpen(false);
    setFlash("Uitnodiging opnieuw verstuurd.");
    reload();
  }

  function addLocalNote() {
    const body = noteDraft.trim();
    if (!body) return;
    const at = new Date().toISOString();
    setLocalNotes((current) => [
      {
        id: `local-${at}`,
        author: "McCoy",
        dated: formatNlDateTime(at),
        at,
        body,
      },
      ...current,
    ]);
    setNoteDraft("");
    setNoteOpen(false);
    setFlash("Notitie toegevoegd. Deze notitie blijft op dit scherm tot u de pagina vernieuwt.");
  }

  return (
    <>
      {flash ? (
        <p className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80" role="status">
          {flash}
        </p>
      ) : null}
      <UserDetailLayout
        detail={detail}
        busy={busy}
        onEdit={() => {
          setEditError(null);
          setEditOpen(true);
        }}
        onResetPassword={() => {
          setActionError(null);
          setResetOpen(true);
        }}
        onDeactivate={() => {
          setActionError(null);
          setDeactivateOpen(true);
        }}
        onResendInvite={() => {
          setActionError(null);
          setResendOpen(true);
        }}
        onAddNote={() => {
          setNoteDraft("");
          setNoteOpen(true);
        }}
      />

      <AppDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        title="Gegevens bewerken"
        description="E-mail wijzigen gebeurt via Auth, niet via dit formulier."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>
              Annuleren
            </Button>
            <Button type="button" loading={busy} onClick={() => void saveProfile()}>
              Opslaan
            </Button>
          </>
        }
      >
        {detail.userId ? (
          <div className="grid gap-3">
            <label className="block text-sm">
              Voornaam
              <input className="a-input mt-1 w-full" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </label>
            <label className="block text-sm">
              Achternaam
              <input className="a-input mt-1 w-full" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </label>
            <label className="block text-sm">
              Telefoonnummer
              <input className="a-input mt-1 w-full" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            {editError ? (
              <p role="alert" className="text-sm text-red-300">
                {editError}
              </p>
            ) : null}
          </div>
        ) : (
          <EmptyState title="Nog geen account" description="Deze uitnodiging heeft nog geen profiel om te bewerken." />
        )}
      </AppDialog>

      <AppDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        title="Notitie toevoegen"
        description="Interne notitie voor dit gebruikersscherm. Er is nog geen persistente gebruikersnotitie-opslag."
        footer={
          <>
            <Button type="button" variant="outline" onClick={() => setNoteOpen(false)}>
              Annuleren
            </Button>
            <Button type="button" onClick={addLocalNote} disabled={!noteDraft.trim()}>
              Toevoegen
            </Button>
          </>
        }
      >
        <label className="block text-sm">
          Notitie
          <textarea
            className="a-input mt-1 min-h-28 w-full"
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
          />
        </label>
      </AppDialog>

      <ConfirmationDialog
        open={resetOpen}
        title="Wachtwoord reset mail sturen?"
        description={`Er wordt een resetmail gestuurd naar ${detail.email}.`}
        confirmLabel="Versturen"
        pending={busy}
        error={actionError}
        onConfirm={() => void confirmReset()}
        onCancel={() => setResetOpen(false)}
      />
      <ConfirmationDialog
        open={deactivateOpen}
        title={detail.blocked ? "Gebruiker deblokkeren?" : "Gebruiker blokkeren?"}
        description={
          detail.blocked
            ? `${detail.fullName} krijgt weer toegang tot het klantportaal.`
            : `${detail.fullName} verliest toegang tot het klantportaal.`
        }
        confirmLabel={detail.blocked ? "Deblokkeren" : "Blokkeren"}
        tone="destructive"
        pending={busy}
        error={actionError}
        onConfirm={() => void confirmDeactivate()}
        onCancel={() => setDeactivateOpen(false)}
      />
      <ConfirmationDialog
        open={resendOpen}
        title="Uitnodiging opnieuw versturen?"
        description={`Er wordt een nieuwe uitnodiging gestuurd naar ${detail.email}.`}
        confirmLabel="Versturen"
        pending={busy}
        error={actionError}
        onConfirm={() => void confirmResend()}
        onCancel={() => setResendOpen(false)}
      />
    </>
  );
}
