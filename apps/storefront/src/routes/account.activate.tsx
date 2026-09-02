import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { accountActivate, accountPeekActivation } from "@/lib/api/account.functions";

export const Route = createFileRoute("/account/activate")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  component: AccountActivatePage,
});

function AccountActivatePage() {
  const { token } = useSearch({ from: "/account/activate" });
  const [peek, setPeek] = useState<{ email: string; companyName: string } | null>(null);
  const [peekError, setPeekError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setPeekError("Geen geldige uitnodigingslink.");
      return;
    }
    void accountPeekActivation({ data: { token } }).then((res) => {
      if (!res.ok) {
        setPeekError("Deze uitnodigingslink is ongeldig of verlopen.");
        return;
      }
      setPeek({ email: res.email, companyName: res.companyName });
    });
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Welkom bij McCoy</h1>
        {peek ? (
          <p className="mt-2 text-sm text-slate-600">
            {peek.companyName} — {peek.email} bevestigd via uitnodiging
          </p>
        ) : null}
        {peekError ? (
          <p className="mt-4 text-sm text-red-600" role="alert">{peekError}</p>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (password !== confirm) {
                setError("Wachtwoorden komen niet overeen.");
                return;
              }
              setBusy(true);
              setError(null);
              void accountActivate({
                data: {
                  token,
                  firstName,
                  lastName,
                  phone: phone || null,
                  password,
                  clientKey: peek?.email ?? token.slice(0, 16),
                },
              }).then((res) => {
                setBusy(false);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                window.location.href = "/account/login";
              });
            }}
          >
            <label className="block text-sm font-medium text-slate-700">
              Voornaam
              <input
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Achternaam
              <input
                required
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Telefoonnummer
              <input
                type="tel"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Nieuw wachtwoord
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Bevestig wachtwoord
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
            <button
              type="submit"
              disabled={busy || !peek}
              className="w-full rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              Account activeren
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
