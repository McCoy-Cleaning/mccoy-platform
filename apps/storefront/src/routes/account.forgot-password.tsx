import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { accountForgotPassword } from "@/lib/api/account.functions";

export const Route = createFileRoute("/account/forgot-password")({
  component: AccountForgotPasswordPage,
});

function AccountForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Wachtwoord vergeten</h1>
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setBusy(true);
            void accountForgotPassword({
              data: { email, clientKey: email.trim().toLowerCase() || "forgot" },
            }).then((res) => {
              setBusy(false);
              if (res.ok) setMessage(res.message);
            });
          }}
        >
          <label className="block text-sm font-medium text-slate-700">
            E-mailadres
            <input
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {message ? <p className="text-sm text-slate-600">{message}</p> : null}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Versturen
          </button>
        </form>
      </div>
    </div>
  );
}
