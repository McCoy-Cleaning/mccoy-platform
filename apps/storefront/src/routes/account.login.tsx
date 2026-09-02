import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { accountLogin } from "@/lib/api/account.functions";

export const Route = createFileRoute("/account/login")({
  component: AccountLoginPage,
});

function AccountLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Inloggen</h1>
        <p className="mt-1 text-sm text-slate-600">McCoy klantenportaal</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            void accountLogin({
              data: {
                email,
                password,
                clientKey: email.trim().toLowerCase() || "login",
              },
            }).then((res) => {
              setBusy(false);
              if (!res.ok) {
                setError(res.error);
                return;
              }
              window.location.href = "/account";
            });
          }}
        >
          <label className="block text-sm font-medium text-slate-700">
            E-mailadres
            <input
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Wachtwoord
            <input
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-red-600" role="alert">{error}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
          >
            Inloggen
          </button>
        </form>
        <p className="mt-4 text-sm">
          <Link to="/account/forgot-password" className="text-sky-700 hover:underline">
            Wachtwoord vergeten
          </Link>
        </p>
      </div>
    </div>
  );
}
