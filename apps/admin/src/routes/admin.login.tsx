import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { Mail, ArrowRight } from "lucide-react";
import { PasswordInput } from "@/components/admin/PasswordInput";
import {
  ADMIN_DEMO_CREDENTIALS,
  fetchAdminAuthMode,
  signInAdmin,
  useAdminSession,
} from "@/lib/admin-auth";
import { hasBrowserSupabaseConfig } from "@/lib/supabase-browser";
import { redirectStaffInviteAuthCallbackIfNeeded } from "@/lib/staff-invite-callback";
import logoUrl from "@/assets/logo-mccoy.png";

export const Route = createFileRoute("/admin/login")({
  head: () => ({
    meta: [
      { title: "Inloggen — McCoy Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const { session, ready } = useAdminSession();
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [authMode, setAuthMode] = React.useState<{
    supabaseEnabled: boolean;
    legacyEnabled: boolean;
    hasUrl: boolean;
    hasPublishable: boolean;
    hasSecret: boolean;
  } | null>(null);

  React.useEffect(() => {
    if (redirectStaffInviteAuthCallbackIfNeeded()) return;
  }, []);

  React.useEffect(() => {
    void fetchAdminAuthMode()
      .then(setAuthMode)
      .catch(() =>
        setAuthMode({
          supabaseEnabled: false,
          legacyEnabled: true,
          hasUrl: false,
          hasPublishable: false,
          hasSecret: false,
        }),
      );
  }, []);

  React.useEffect(() => {
    if (!ready || !session) return;
    if (redirectStaffInviteAuthCallbackIfNeeded()) return;
    if (session.mfaRequired || session.nextStep === "mfa_enroll" || session.nextStep === "mfa_verify") {
      navigate({ to: "/admin/mfa", replace: true });
      return;
    }
    // Invited staff must finish /admin/invite before the main shell.
    if (session.status === "invited") {
      navigate({ to: "/admin/invite", replace: true });
      return;
    }
    navigate({ to: "/admin", replace: true });
  }, [ready, session, navigate]);

  const useSupabaseUi = Boolean(authMode?.supabaseEnabled) || hasBrowserSupabaseConfig();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await signInAdmin(identifier, password);
      if (!result.ok) {
        setError(result.error);
        setBusy(false);
        return;
      }
      if (result.nextStep === "mfa_enroll" || result.nextStep === "mfa_verify") {
        navigate({ to: "/admin/mfa", replace: true });
        return;
      }
      navigate({ to: "/admin", replace: true });
    } catch (error) {
      setError(
        error instanceof Error && error.message.trim()
          ? error.message
          : "Inloggen mislukt. Probeer het opnieuw.",
      );
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[#1e88e5]/25 blur-[160px]" />
        <div className="absolute bottom-0 right-0 h-[30rem] w-[30rem] rounded-full bg-[#7c3aed]/20 blur-[140px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.06)_1px,transparent_0)] [background-size:32px_32px] opacity-30" />
      </div>

      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={logoUrl}
            alt="McCoy Cleaning"
            className="mb-6 h-16 w-auto object-contain drop-shadow-[0_0_24px_rgba(30,136,229,0.35)] sm:h-20"
            draggable={false}
          />
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">McCoy Beheer</h1>
          <p className="mt-2 text-base text-white/60">
            {useSupabaseUi
              ? "Log in met je staff e-mailadres en wachtwoord"
              : "Log in om het beheer te openen"}
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-3xl border border-white/10 bg-white/[0.05] p-7 shadow-2xl backdrop-blur-xl"
        >
          <label className="mb-5 block">
            <span className="a-label">
              {useSupabaseUi ? "E-mailadres" : "Gebruikersnaam"}
            </span>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
              <input
                type={useSupabaseUi ? "email" : "text"}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
                autoComplete={useSupabaseUi ? "username" : "username"}
                className="w-full rounded-xl border border-white/15 bg-black/30 py-3.5 pl-12 pr-4 text-base text-white outline-none transition placeholder:text-white/35 focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30"
                placeholder={useSupabaseUi ? "naam@bedrijf.nl" : "admin"}
              />
            </div>
          </label>

          <label className="mb-5 block">
            <span className="a-label">Wachtwoord</span>
            <PasswordInput
              showLockIcon
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-white/15 bg-black/30 py-3.5 text-base text-white outline-none transition focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="group flex min-h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-[#2f9ff0] to-[#1e88e5] px-5 text-lg font-semibold text-white shadow-lg shadow-[#1e88e5]/30 transition hover:shadow-[#1e88e5]/50 hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Bezig..." : "Inloggen"}
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
          </button>

          {authMode && !authMode.supabaseEnabled && authMode.legacyEnabled && (
            <div className="mt-6 rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-4 text-sm leading-relaxed text-white/55">
              <span className="font-semibold text-white/75">Demo credentials:</span>{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/85">
                {ADMIN_DEMO_CREDENTIALS.username}
              </code>
              {" / "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-white/85">
                {ADMIN_DEMO_CREDENTIALS.password}
              </code>
            </div>
          )}

          {authMode && !authMode.hasSecret && (authMode.hasUrl || hasBrowserSupabaseConfig()) && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/90"
            >
              Server mist <code className="text-amber-50">SUPABASE_SECRET_KEY</code> — zet deze in
              de root <code className="text-amber-50">.env</code> en herstart{" "}
              <code className="text-amber-50">npm run dev:admin</code>. Zonder secret kan de server
              geen staff-sessie vastleggen.
            </div>
          )}

          {authMode?.supabaseEnabled && !hasBrowserSupabaseConfig() && (
            <div
              role="status"
              className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100/90"
            >
              Server heeft Supabase, maar <code className="text-amber-50">VITE_SUPABASE_URL</code> /{" "}
              <code className="text-amber-50">VITE_SUPABASE_PUBLISHABLE_KEY</code> ontbreken in de
              browser. Zet dezelfde waarden als de server publishable config in de root{" "}
              <code className="text-amber-50">.env</code> en herstart admin.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
