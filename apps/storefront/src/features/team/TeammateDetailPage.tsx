import { useEffect, useState } from "react";
import {
  accountReactivateUser,
  accountRequestTeammatePasswordReset,
  accountResendInvitation,
  accountSuspendUser,
  getAccountTeammateDetail,
} from "@/lib/api/account.functions";

import { TeammateDetailLayout } from "./TeammateDetailLayout";
import type { TeammateDetailView } from "./teammate-detail-view";

type PageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; detail: TeammateDetailView; isAccountAdmin: boolean };

export function TeammateDetailPage({ userId }: { userId: string }) {
  const [page, setPage] = useState<PageState>({ status: "loading" });
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<
    null | "edit" | "reset" | "deactivate" | "resend"
  >(null);

  function reload() {
    setPage({ status: "loading" });
    void getAccountTeammateDetail({ data: { userId } }).then((res) => {
      if (!res.ok) {
        setPage({ status: "error", message: res.error });
        return;
      }
      setPage({
        status: "ok",
        detail: res.detail,
        isAccountAdmin: res.role === "account_admin",
      });
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (page.status === "loading") {
    return <p className="text-sm text-slate-500">Gebruikersdetails laden…</p>;
  }
  if (page.status === "error") {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">Gebruiker niet geladen</p>
        <p className="mt-1">{page.message}</p>
        <button type="button" className="mt-3 text-sm font-medium text-sky-700 hover:underline" onClick={reload}>
          Opnieuw proberen
        </button>
      </div>
    );
  }

  const { detail, isAccountAdmin } = page;

  async function runConfirmed() {
    if (!confirm || busy) return;
    if (confirm === "edit") {
      setConfirm(null);
      setFlash("Gegevens bewerken gebeurt via McCoy-beheer.");
      return;
    }
    if (!isAccountAdmin) {
      setConfirm(null);
      setFlash("Alleen een accountbeheerder kan deze actie uitvoeren.");
      return;
    }
    setBusy(true);
    if (confirm === "reset") {
      const res = await accountRequestTeammatePasswordReset({ data: { userId } });
      setBusy(false);
      setConfirm(null);
      setFlash(res.ok ? "Wachtwoordreset verstuurd." : res.error);
      return;
    }
    if (confirm === "deactivate" && detail.userId) {
      const res = detail.blocked
        ? await accountReactivateUser({ data: { userId: detail.userId } })
        : await accountSuspendUser({ data: { userId: detail.userId } });
      setBusy(false);
      setConfirm(null);
      if (!res.ok) {
        setFlash(res.error);
        return;
      }
      setFlash(detail.blocked ? "Gebruiker geactiveerd." : "Gebruiker gedeactiveerd.");
      reload();
      return;
    }
    if (confirm === "resend") {
      const res = await accountResendInvitation({
        data: { email: detail.email, intendedRole: detail.role },
      });
      setBusy(false);
      setConfirm(null);
      setFlash(res.ok ? "Uitnodiging opnieuw verstuurd." : res.error);
      return;
    }
    setBusy(false);
    setConfirm(null);
  }

  return (
    <div>
      {flash ? (
        <p className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" role="status">
          {flash}
        </p>
      ) : null}
      <TeammateDetailLayout
        detail={detail}
        busy={busy}
        onEdit={() => setConfirm("edit")}
        onResetPassword={() => setConfirm("reset")}
        onDeactivate={() => setConfirm("deactivate")}
        onResendInvite={() => setConfirm("resend")}
      />
      {confirm ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="teammate-confirm-title"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="teammate-confirm-title" className="text-lg font-semibold text-slate-900">
              {confirm === "edit"
                ? "Gegevens bewerken"
                : confirm === "reset"
                  ? "Wachtwoord opnieuw instellen?"
                  : confirm === "resend"
                    ? "Uitnodiging opnieuw versturen?"
                    : detail.blocked
                      ? "Gebruiker activeren?"
                      : "Gebruiker deactiveren?"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {confirm === "edit"
                ? "Naam en telefoon wijzigen gebeurt via McCoy-beheer."
                : confirm === "reset"
                  ? `Er wordt een resetmail gestuurd naar ${detail.email}.`
                  : confirm === "resend"
                    ? `Er wordt een nieuwe uitnodiging gestuurd naar ${detail.email}.`
                    : `${detail.fullName} ${detail.blocked ? "krijgt weer" : "verliest"} toegang tot het klantportaal.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-200 px-3 py-2 text-sm"
                disabled={busy}
                onClick={() => setConfirm(null)}
              >
                Annuleren
              </button>
              <button
                type="button"
                className="rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-40"
                disabled={busy}
                onClick={() => void runConfirmed()}
              >
                Bevestigen
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
