import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { ArrowRight, ShieldCheck, UserRound } from "lucide-react";
import { PasswordInput } from "@/components/admin/PasswordInput";
import {
  fetchAdminSession,
  refreshAdminSessionClient,
  signOutAdmin,
  useAdminSession,
} from "@/lib/admin-auth";
import { adminExchangeAuthCallback } from "@/lib/api/admin-auth.functions";
import {
  completeStaffInviteRegistrationFn,
  completeStaffPasswordRecoveryFn,
  getStaffInviteContextFn,
  getStaffMfaRecoveryContextFn,
  getStaffPasswordRecoveryContextFn,
} from "@/lib/api/staff-identity.functions";
import {
  clearStaffInviteAuthCallbackFromUrl,
  readStaffAuthCallbackTypeFromLocation,
} from "@/lib/staff-invite-callback";
import {
  hasStaffAuthCallbackParams,
  parseStaffAuthCallbackParams,
} from "@/lib/staff-auth-callback-params";
import logoUrl from "@/assets/logo-mccoy.png";
import { staffPasswordStrengthError } from "@mccoy/domain";

export const Route = createFileRoute("/admin/invite")({
  head: () => ({
    meta: [
      { title: "Uitnodiging — McCoy Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminInvitePage,
});

type InviteContext = {
  email: string;
  fullName: string | null;
  needsFullName: boolean;
  expiresAt: string | null;
  requiresMfaCode?: boolean;
};

type PagePhase =
  | "booting"
  | "ready"
  | "submitting"
  | "missing_session"
  | "error"
  | "already_complete"
  | "recovery_complete";

type FlowMode = "invite" | "recovery";

function AdminInvitePage() {
  const navigate = useNavigate();
  const { session, ready: sessionReady } = useAdminSession();
  const [phase, setPhase] = React.useState<PagePhase>("booting");
  const [flowMode, setFlowMode] = React.useState<FlowMode>("invite");
  const [error, setError] = React.useState<string | null>(null);
  const [context, setContext] = React.useState<InviteContext | null>(null);
  const [fullName, setFullName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [totpCode, setTotpCode] = React.useState("");
  const bootAttempted = React.useRef(false);

  const loadContext = React.useCallback(async () => {
    const callbackType = readStaffAuthCallbackTypeFromLocation(window.location);
    const inviteLinkTypes = new Set(["invite", "signup", "magiclink"]);

    const result = await getStaffInviteContextFn();
    if (result.ok) {
      if (result.alreadyComplete) {
        setPhase("already_complete");
        navigate({ to: "/admin", replace: true });
        return;
      }
      if (result.registrationComplete) {
        navigate({ to: "/admin/mfa", replace: true });
        return;
      }
      setFlowMode("invite");
      setContext({
        email: result.email,
        fullName: result.fullName,
        needsFullName: result.needsFullName,
        expiresAt: result.expiresAt,
      });
      if (result.fullName) setFullName(result.fullName);
      setPhase("ready");
      return;
    }

    const mfaRecovery = await getStaffMfaRecoveryContextFn();
    if (mfaRecovery.ok) {
      navigate({ to: "/admin/recover-mfa", replace: true });
      return;
    }

    const recovery = await getStaffPasswordRecoveryContextFn();
    if (recovery.ok) {
      // Never show password-reset UI for invitation links (recovery token fallback is OK).
      if (inviteLinkTypes.has(callbackType ?? "")) {
        setPhase("error");
        setError(result.error);
        return;
      }
      setFlowMode("recovery");
      setContext({
        email: recovery.email,
        fullName: recovery.fullName,
        needsFullName: false,
        expiresAt: null,
        requiresMfaCode: recovery.requiresMfaCode,
      });
      if (recovery.fullName) setFullName(recovery.fullName);
      setPhase("ready");
      return;
    }

    setPhase("error");
    setError(result.error);
  }, [navigate]);

  React.useEffect(() => {
    if (!sessionReady || bootAttempted.current) return;
    bootAttempted.current = true;

    let cancelled = false;

    const boot = async () => {
      setPhase("booting");
      setError(null);

      // Read callback params into memory only — never sessionStorage.
      const callbackParams = parseStaffAuthCallbackParams();

      if (hasStaffAuthCallbackParams(callbackParams) && callbackParams) {
        const exchanged = await adminExchangeAuthCallback({
          data: {
            tokenHash: callbackParams.tokenHash,
            type: callbackParams.type,
            code: callbackParams.code,
            accessToken: callbackParams.accessToken,
            refreshToken: callbackParams.refreshToken,
            clientKey: callbackParams.tokenHash?.slice(0, 32) || callbackParams.code?.slice(0, 32),
          },
        });

        // Strip secrets from the URL as soon as the server has them (or failed).
        clearStaffInviteAuthCallbackFromUrl();

        if (!exchanged.ok) {
          if (!cancelled) {
            setPhase("missing_session");
            setError(exchanged.error);
          }
          return;
        }

        // Durable HttpOnly cookies are authoritative; MFA page purpose-gates browser tokens.
        refreshAdminSessionClient();

        if (
          exchanged.nextStep === "none" &&
          exchanged.session.status === "active" &&
          exchanged.session.aal === "aal2"
        ) {
          if (!cancelled) navigate({ to: "/admin", replace: true });
          return;
        }

        if (!cancelled) await loadContext();
        return;
      }

      // Clean URL / reload: recover from HttpOnly cookies (mobile-safe).
      const existing = await fetchAdminSession().catch(() => null);
      if (existing?.userId) {
        refreshAdminSessionClient();
        if (!cancelled) await loadContext();
        return;
      }

      if (!cancelled) {
        setPhase("missing_session");
        setError(
          "Geen geldige uitnodigingssessie gevonden. Open de knop in je e-mail opnieuw (op de telefoon: kies “Open in Safari/Chrome”). De link is eenmalig; vraag zo nodig een nieuwe uitnodiging.",
        );
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [sessionReady, loadContext, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const passwordError = staffPasswordStrengthError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Wachtwoorden komen niet overeen.");
      return;
    }
    if (context?.needsFullName && !fullName.trim()) {
      setError("Vul je volledige naam in.");
      return;
    }
    if (flowMode === "recovery" && context?.requiresMfaCode && !/^\d{6}$/.test(totpCode.trim())) {
      setError("Voer de 6-cijferige MFA-code in.");
      return;
    }

    setPhase("submitting");

    try {
      if (flowMode === "recovery") {
        const completed = await completeStaffPasswordRecoveryFn({
          data: {
            newPassword: password,
            totpCode: context?.requiresMfaCode ? totpCode.trim() : undefined,
          },
        });

        if (!completed.ok) {
          setPhase("ready");
          setError(completed.error);
          return;
        }

        if (completed.nextStep === "mfa_enroll") {
          refreshAdminSessionClient();
          clearStaffInviteAuthCallbackFromUrl();
          navigate({ to: "/admin/mfa", replace: true });
          return;
        }

        await signOutAdmin();
        setPhase("recovery_complete");
        setError(null);
        navigate({ to: "/admin/login", replace: true });
        return;
      }

      const completed = await completeStaffInviteRegistrationFn({
        data: {
          newPassword: password,
          fullName: fullName.trim() || undefined,
        },
      });

      if (!completed.ok) {
        setPhase("ready");
        setError(completed.error);
        return;
      }

      refreshAdminSessionClient();
      clearStaffInviteAuthCallbackFromUrl();
      navigate({ to: "/admin/mfa", replace: true });
    } catch {
      setPhase("ready");
      setError("Registratie mislukt. Probeer het opnieuw.");
    }
  };

  if (phase === "booting" || !sessionReady) {
    return (
      <div className="admin-shell flex min-h-screen items-center justify-center text-white/60">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          <p className="text-sm">Uitnodiging controleren…</p>
        </div>
      </div>
    );
  }

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
            className="mb-5 h-20 w-auto object-contain drop-shadow-[0_0_24px_rgba(30,136,229,0.35)] sm:h-24"
            draggable={false}
          />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {flowMode === "recovery" ? "Nieuw wachtwoord" : "Account activeren"}
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {flowMode === "recovery"
              ? "Stel een nieuw wachtwoord in voor je McCoy Admin-account."
              : "Stel je wachtwoord in en rond daarna tweestapsverificatie af."}
          </p>
        </div>

        {(phase === "missing_session" || phase === "error") && (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-100"
          >
            <p>{error ?? "Er ging iets mis."}</p>
            <button
              type="button"
              className="mt-4 text-xs text-white/70 underline-offset-2 hover:text-white hover:underline"
              onClick={() => {
                void signOutAdmin().then(() => navigate({ to: "/admin/login", replace: true }));
              }}
            >
              Naar inloggen
            </button>
          </div>
        )}

        {(phase === "ready" || phase === "submitting") && context && (
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-4 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/60">
              {flowMode === "recovery" ? "Reset voor" : "Uitnodiging voor"}{" "}
              <span className="font-medium text-white/85">{context.email}</span>
              {flowMode === "invite" && session?.staffRole === "admin" ? " · rol: beheerder" : null}
            </div>

            {flowMode === "invite" && (context.needsFullName || !context.fullName) && (
              <label className="mb-4 block">
                <span className="mb-1.5 block text-xs font-medium text-white/70">Volledige naam</span>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={context.needsFullName}
                    autoComplete="name"
                    maxLength={200}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-10 py-2.5 text-sm text-white outline-none transition focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30"
                    placeholder="Voor- en achternaam"
                  />
                </div>
              </label>
            )}

            <label className="mb-4 block">
              <span className="mb-1.5 block text-xs font-medium text-white/70">Wachtwoord</span>
              <PasswordInput
                showLockIcon
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={10}
                autoComplete="new-password"
                className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 text-sm text-white outline-none transition focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30"
                placeholder="Min. 10 tekens, hoofdletter + cijfer"
              />
            </label>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-xs font-medium text-white/70">
                Wachtwoord bevestigen
              </span>
              <PasswordInput
                showLockIcon
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={10}
                autoComplete="new-password"
                className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 text-sm text-white outline-none transition focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30"
                placeholder="Herhaal wachtwoord"
              />
            </label>

            {flowMode === "recovery" && context.requiresMfaCode && (
              <label className="mb-4 block" htmlFor="recovery-mfa-code">
                <span className="mb-1.5 block text-xs font-medium text-white/70">
                  Authenticatiecode
                </span>
                <div className="relative">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    id="recovery-mfa-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    value={totpCode}
                    onChange={(e) => setTotpCode(e.target.value)}
                    required
                    maxLength={12}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-10 py-2.5 text-sm tracking-widest text-white outline-none transition focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30"
                    placeholder="000000"
                  />
                </div>
              </label>
            )}

            <p className="mb-4 text-[11px] leading-relaxed text-white/45">
              {flowMode === "recovery"
                ? context.requiresMfaCode
                  ? "Voer de code uit je authenticator-app in om je identiteit te bevestigen. Daarna kun je opnieuw inloggen met je nieuwe wachtwoord."
                  : "Na het opslaan stel je tweestapsverificatie in. Daarna kun je inloggen met je nieuwe wachtwoord."
                : "Na deze stap stel je tweestapsverificatie (TOTP) in. Pas daarna heb je volledige toegang tot McCoy Admin."}
            </p>

            {error && (
              <div
                role="alert"
                className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={phase === "submitting"}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1e88e5] to-[#7c3aed] px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#1e88e5]/30 transition hover:shadow-[#1e88e5]/50 disabled:opacity-60"
            >
              {phase === "submitting"
                ? "Bezig…"
                : flowMode === "recovery"
                  ? "Wachtwoord opslaan"
                  : "Doorgaan naar MFA"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
