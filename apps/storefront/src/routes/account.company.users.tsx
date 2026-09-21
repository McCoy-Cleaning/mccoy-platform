import { createFileRoute, Link, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { CustomerStatusBadge } from "@/components/account/AccountShell";
import {
  accountInviteUser,
  accountReactivateUser,
  accountSuspendUser,
  getAccountCompanyUsers,
} from "@/lib/api/account.functions";
import {
  canSubmitInvite,
  teamMemberActions,
  teamMemberDisplayName,
  teamMemberRoleLabel,
  teamMemberStatusLabel,
  type TeamMemberRow,
} from "@/lib/account/company-users-view";

const GENERIC_ERROR = "Er ging iets mis. Probeer het opnieuw.";

export const Route = createFileRoute("/account/company/users")({
  beforeLoad: async ({ location }) => {
    if (location.pathname !== "/account/company/users") {
      return {};
    }
    const res = await getAccountCompanyUsers();
    if (!res.ok) {
      throw redirect({ to: "/account" });
    }
    return {};
  },
  component: AccountCompanyUsersPage,
});

type MemberRow = TeamMemberRow;

type PendingRow = {
  email: string;
  intendedRole: string;
};

function AccountCompanyUsersPage() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (pathname !== "/account/company/users") {
    return <Outlet />;
  }

  return <CompanyUsersList />;
}

function CompanyUsersList() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** The member whose access change has not settled yet. */
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    try {
      const res = await getAccountCompanyUsers();
      if (!alive.current) return;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setMembers(res.members as MemberRow[]);
      setPending(res.pending);
    } catch {
      if (alive.current) setError(GENERIC_ERROR);
    } finally {
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /**
   * Membership changes are access control, so the row waits for the server
   * rather than rendering the new state optimistically.
   */
  async function changeAccess(member: MemberRow, action: "suspend" | "reactivate") {
    if (pendingUserId) return;
    setPendingUserId(member.userId);
    setError(null);
    setNotice(null);
    const name = teamMemberDisplayName(member);
    try {
      const res =
        action === "suspend"
          ? await accountSuspendUser({ data: { userId: member.userId } })
          : await accountReactivateUser({ data: { userId: member.userId } });
      if (!alive.current) return;
      if (!res.ok) {
        setError(`${name} is niet bijgewerkt. ${res.error}`);
        return;
      }
      setNotice(action === "suspend" ? `${name} is geblokkeerd.` : `${name} is weer actief.`);
      await reload();
    } catch {
      if (alive.current) setError(`${name} is niet bijgewerkt. ${GENERIC_ERROR}`);
    } finally {
      if (alive.current) setPendingUserId(null);
    }
  }

  async function submitInvite() {
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await accountInviteUser({
        data: { firstName, lastName, email, phone: phone || null },
      });
      if (!alive.current) return;
      if (!res.ok) {
        // Keep the typed values so the invite can be corrected and retried.
        setError(res.error);
        return;
      }
      setNotice(`Uitnodiging verstuurd naar ${email}.`);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      await reload();
    } catch {
      if (alive.current) setError(GENERIC_ERROR);
    } finally {
      if (alive.current) setSubmitting(false);
    }
  }

  const inviteEnabled = canSubmitInvite({ firstName, lastName, email, submitting });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Gebruikers</h1>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {/* Reserved height: an outcome message must not push the list down. */}
      <p role="status" aria-live="polite" className="min-h-5 text-sm text-slate-600">
        {notice ?? ""}
      </p>

      {loading ? (
        <div
          role="status"
          aria-busy="true"
          className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white"
        >
          <span className="sr-only">Gebruikers laden…</span>
          {[0, 1, 2].map((index) => (
            <div key={index} className="flex items-center justify-between gap-2 px-4 py-3" aria-hidden>
              <div className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200 motion-reduce:animate-none" />
                <div className="h-3 w-56 animate-pulse rounded bg-slate-100 motion-reduce:animate-none" />
              </div>
              <div className="h-6 w-24 animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none" />
            </div>
          ))}
        </div>
      ) : members.length === 0 && pending.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-6 text-sm text-slate-600">
          Er zijn nog geen gebruikers. Nodig hieronder een collega uit.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
          {members.map((m) => {
            const actions = teamMemberActions(m, pendingUserId);
            const name = teamMemberDisplayName(m);
            return (
              <li
                key={m.userId}
                aria-busy={actions.pending || undefined}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{name}</p>
                  <p className="text-sm text-slate-500">{m.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to="/account/company/users/$userId"
                    params={{ userId: m.userId }}
                    className="px-1 py-1 text-sm font-medium text-sky-700 hover:underline"
                  >
                    Bekijk details
                  </Link>
                  <CustomerStatusBadge label={teamMemberRoleLabel(m)} />
                  <CustomerStatusBadge label={teamMemberStatusLabel(m)} />
                  {actions.canSuspend ? (
                    <button
                      type="button"
                      className="px-1 py-1 text-sm text-slate-600 hover:underline disabled:opacity-40"
                      disabled={pendingUserId !== null}
                      onClick={() => void changeAccess(m, "suspend")}
                    >
                      Blokkeren
                    </button>
                  ) : null}
                  {actions.canReactivate ? (
                    <button
                      type="button"
                      className="px-1 py-1 text-sm text-sky-700 hover:underline disabled:opacity-40"
                      disabled={pendingUserId !== null}
                      onClick={() => void changeAccess(m, "reactivate")}
                    >
                      Heractiveren
                    </button>
                  ) : null}
                  {actions.pending ? (
                    <span className="text-sm text-slate-500">Bijwerken…</span>
                  ) : null}
                </div>
              </li>
            );
          })}
          {pending.map((p) => (
            <li key={p.email} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium text-slate-900">{p.email}</p>
                <p className="text-sm text-slate-500">Uitnodiging verstuurd</p>
              </div>
              <CustomerStatusBadge label="Uitnodiging verstuurd" />
            </li>
          ))}
        </ul>
      )}

      <form
        className="rounded-xl border border-slate-200 bg-white p-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void accountInviteUser({
            data: { firstName, lastName, email, phone: phone || null },
          }).then((res) => {
            if (!res.ok) {
              setError(res.error);
              return;
            }
            setFirstName("");
            setLastName("");
            setEmail("");
            setPhone("");
            reload();
          });
        }}
      >
        <h2 className="text-sm font-semibold text-slate-900">Gebruiker toevoegen</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            placeholder="Voornaam"
            required
            className="rounded-md border border-slate-300 px-3 py-2"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <input
            placeholder="Achternaam"
            required
            className="rounded-md border border-slate-300 px-3 py-2"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
          <input
            type="email"
            placeholder="E-mailadres"
            required
            className="rounded-md border border-slate-300 px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="tel"
            placeholder="Telefoonnummer"
            className="rounded-md border border-slate-300 px-3 py-2"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
        >
          Gebruiker uitnodigen
        </button>
      </form>
    </div>
  );
}
