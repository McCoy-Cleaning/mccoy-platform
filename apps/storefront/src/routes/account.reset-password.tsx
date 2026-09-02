import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { accountCompletePasswordReset } from "@/lib/api/account.functions";

function parseRecoveryParams(): {
  accessToken?: string;
  refreshToken?: string;
  tokenHash?: string;
  code?: string;
} {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  const hashParams = new URLSearchParams(hash);
  const searchParams = new URLSearchParams(window.location.search);

  return {
    accessToken: hashParams.get("access_token") || undefined,
    refreshToken: hashParams.get("refresh_token") || undefined,
    tokenHash: hashParams.get("token_hash") || searchParams.get("token_hash") || undefined,
    code: searchParams.get("code") || undefined,
  };
}

/** Survives React Strict Mode remount so hash tokens are not wiped twice. */
let recoveryParamsTaken: ReturnType<typeof parseRecoveryParams> | null | undefined;

function takeRecoveryParams(): ReturnType<typeof parseRecoveryParams> | null {
  if (recoveryParamsTaken !== undefined) return recoveryParamsTaken;
  const params = parseRecoveryParams();
  const hasToken =
    Boolean(params.accessToken) ||
    Boolean(params.refreshToken) ||
    Boolean(params.tokenHash) ||
    Boolean(params.code);
  if (hasToken) {
    window.history.replaceState(null, "", window.location.pathname);
    recoveryParamsTaken = params;
    return params;
  }
  recoveryParamsTaken = null;
  return null;
}

export const Route = createFileRoute("/account/reset-password")({
  component: AccountResetPasswordPage,
});

function AccountResetPasswordPage() {
  const [recovery, setRecovery] = useState<ReturnType<typeof parseRecoveryParams> | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = takeRecoveryParams();
    if (!params) {
      setLinkError("Geen geldige resetlink. Vraag een nieuwe aan via wachtwoord vergeten.");
      return;
    }
    setRecovery(params);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Nieuw wachtwoord</h1>
        <p className="mt-1 text-sm text-slate-600">McCoy klantenportaal</p>

        {success ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-slate-700">Uw wachtwoord is gewijzigd. U kunt nu inloggen.</p>
            <Link
              to="/account/login"
              className="inline-flex w-full justify-center rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700"
            >
              Naar inloggen
            </Link>
          </div>
        ) : linkError ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {linkError}
          </p>
        ) : (
          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!recovery) return;
              if (password !== confirm) {
                setError("Wachtwoorden komen niet overeen.");
                return;
              }
              setBusy(true);
              setError(null);
              void accountCompletePasswordReset({
                data: {
                  password,
                  clientKey:
                    recovery.code ||
                    recovery.tokenHash ||
                    `reset-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  accessToken: recovery.accessToken,
                  refreshToken: recovery.refreshToken,
                  tokenHash: recovery.tokenHash,
                  code: recovery.code,
                },
              }).then((res) => {
                setBusy(false);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                setSuccess(true);
              });
            }}
          >
            <label className="block text-sm font-medium text-slate-700">
              Nieuw wachtwoord
              <input
                type="password"
                required
                minLength={12}
                autoComplete="new-password"
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
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
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-base"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            {error ? (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy || !recovery}
              className="w-full rounded-md bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
            >
              Wachtwoord opslaan
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
