import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CustomerStatusBadge } from "@/components/account/AccountShell";
import {
  accountInviteUser,
  accountReactivateUser,
  accountSuspendUser,
  getAccountCompanyUsers,
} from "@/lib/api/account.functions";

export const Route = createFileRoute("/account/company/users")({
  beforeLoad: async () => {
    const res = await getAccountCompanyUsers();
    if (!res.ok) {
      throw redirect({ to: "/account" });
    }
    return {};
  },
  component: AccountCompanyUsersPage,
});

type MemberRow = {
  userId: string;
  email: string;
  fullName: string | null;
  role: string;
  membershipStatus: string;
};

type PendingRow = {
  email: string;
  intendedRole: string;
};

function AccountCompanyUsersPage() {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const reload = () => {
    void getAccountCompanyUsers().then((res) => {
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMembers(res.members as MemberRow[]);
      setPending(res.pending);
    });
  };

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Gebruikers</h1>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900">{m.fullName ?? m.email}</p>
              <p className="text-sm text-slate-500">{m.email}</p>
            </div>
            <div className="flex items-center gap-2">
              <CustomerStatusBadge
                label={m.role === "account_admin" ? "Accountbeheerder" : "Gebruiker"}
              />
              <CustomerStatusBadge label={m.membershipStatus === "active" ? "Actief" : "Opgeschort"} />
              {m.role !== "account_admin" && m.membershipStatus === "active" ? (
                <button
                  type="button"
                  className="text-sm text-slate-600 hover:underline"
                  onClick={() =>
                    void accountSuspendUser({ data: { userId: m.userId } }).then(reload)
                  }
                >
                  Blokkeren
                </button>
              ) : null}
              {m.membershipStatus === "suspended" ? (
                <button
                  type="button"
                  className="text-sm text-sky-700 hover:underline"
                  onClick={() =>
                    void accountReactivateUser({ data: { userId: m.userId } }).then(reload)
                  }
                >
                  Heractiveren
                </button>
              ) : null}
            </div>
          </li>
        ))}
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
