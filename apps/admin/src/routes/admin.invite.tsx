import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { ArrowRight, UserRound } from "lucide-react";
import { PasswordInput } from "@/components/admin/PasswordInput";
import {
  adminEstablishSession,
  fetchAdminSession,
  refreshAdminSessionClient,
  signOutAdmin,
  useAdminSession,
} from "@/lib/admin-auth";
import {
  completeStaffInviteRegistrationFn,
  getStaffInviteContextFn,
} from "@/lib/api/staff-identity.functions";
import { getAdminBrowserSupabase, hasBrowserSupabaseConfig } from "@/lib/supabase-browser";
import { clearStaffInviteAuthCallbackFromUrl } from "@/lib/staff-invite-callback";
import { establishBrowserSessionFromAuthCallback } from "@/lib/auth-callback-session";
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
};

type PagePhase =
  | "booting"
  | "ready"
  | "submitting"
  | "missing_session"
  | "error"
  | "already_complete";

function AdminInvitePage() {
  const navigate = useNavigate();
  const { session, ready: sessionReady } = useAdminSession();
  const [phase, setPhase] = React.useState<PagePhase>("booting");
  const [error, setError] = React.useState<string | null>(null);
  const [context, setContext] = React.useState<InviteContext | null>(null);
  const [fullName, setFullName] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const bootAttempted = React.useRef(false);

  const loadContext = React.useCallback(async () => {
    const result = await getStaffInviteContextFn();
    if (!result.ok) {
      setPhase("error");
      setError(result.error);
      return;
    }
    if (result.alreadyComplete) {
      setPhase("already_complete");
      navigate({ to: "/admin", replace: true });
      return;
    }
    if (result.registrationComplete) {
      navigate({ to: "/admin/mfa", replace: true });
      return;
    }
    setContext({
      email: result.email,
      fullName: result.fullName,
      needsFullName: result.needsFullName,
      expiresAt: result.expiresAt,
    });
    if (result.fullName) setFullName(result.fullName);
    setPhase("ready");
  }, [navigate]);

  React.useEffect(() => {
    if (!sessionReady || bootAttempted.current) return;
    bootAttempted.current = true;

    let cancelled = false;

    const boot = async () => {
      setPhase("booting");
      setError(null);

      if (!hasBrowserSupabaseConfig()) {
        if (!cancelled) {
          setPhase("error");
          setError("Supabase browserconfig ontbreekt. Neem contact op met McCoy.");
        }
        return;
      }

      const supabase = getAdminBrowserSupabase();
      if (!supabase) {
        if (!cancelled) {
          setPhase("error");
          setError("Supabase browserconfig ontbreekt. Neem contact op met McCoy.");
        }
        return;
      }

      // Invite emails redirect with hash tokens (implicit) or ?code= / ?token_hash=.
      // PKCE-default clients often miss the hash — parse explicitly.
      const fromLink = await establishBrowserSessionFromAuthCallback(supabase);
      if (fromLink.error && !fromLink.session) {
        if (!cancelled) {
          setPhase("missing_session");
          setError(fromLink.error);
        }
        return;
      }

      let session = fromLink.session;
      if (!session) {
        // Brief wait for detectSessionInUrl race on slow mobiles.
        await new Promise((resolve) => {
          const { data: sub } = supabase.auth.onAuthStateChange((event) => {
            if (event === "INITIAL_SESSION" || event === "SIGNED_IN") {
              sub.subscription.unsubscribe();
              resolve(undefined);
            }
          });
          window.setTimeout(() => {
            sub.subscription.unsubscribe();
            resolve(undefined);
          }, 1500);
        });
        session = (await supabase.auth.getSession()).data.session;
      }

      if (!session) {
        const existing = await fetchAdminSession().catch(() => null);
        if (existing?.userId) {
          if (!cancelled) await loadContext();
          return;
        }
        if (!cancelled) {
          setPhase("missing_session");
          setError(
            "Geen geldige uitnodigingssessie gevonden. Open de link opnieuw via de knop in je e-mail (bij voorkeur in Safari of Chrome, niet in de e-mail-app). Oude links werken niet meer — vraag zo nodig een nieuwe uitnodiging.",
          );
        }
        return;
      }

      const established = await adminEstablishSession({
        data: {
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          clientKey: session.user.email ?? undefined,
        },
      });

      // Prevent /admin/mfa ↔ /admin/invite loops when #access_token&type=invite lingers.
      clearStaffInviteAuthCallbackFromUrl();

      if (!established.ok) {
        if (!cancelled) {
          setPhase("error");
          setError(established.error);
        }
        return;
      }

      if (
        established.nextStep === "none" &&
        established.session.status === "active" &&
        established.session.aal === "aal2"
      ) {
        if (!cancelled) navigate({ to: "/admin", replace: true });
        return;
      }

      if (!cancelled) await loadContext();
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

    setPhase("submitting");

    try {
      const supabase = getAdminBrowserSupabase();
      if (!supabase) {
        setPhase("error");
        setError("Supabase browserconfig ontbreekt.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: {
          full_name: fullName.trim() || context?.fullName || null,
        },
      });
      if (updateError) {
        setPhase("ready");
        setError(
          updateError.message?.toLowerCase().includes("password")
            ? "Wachtwoord kon niet worden ingesteld. Kies een sterker wachtwoord."
            : "Account bijwerken mislukt. Probeer het opnieuw.",
        );
        return;
      }

      // Keep HttpOnly cookies aligned with the post-password browser session.
      const { data: refreshed } = await supabase.auth.getSession();
      if (refreshed.session) {
        await adminEstablishSession({
          data: {
            accessToken: refreshed.session.access_token,
            refreshToken: refreshed.session.refresh_token,
            clientKey: refreshed.session.user.email ?? undefined,
          },
        });
      }

      const completed = await completeStaffInviteRegistrationFn({
        data: {
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
            className="mb-5 h-14 w-auto object-contain drop-shadow-[0_0_24px_rgba(30,136,229,0.35)] sm:h-16"
            draggable={false}
          />
          <h1 className="text-2xl font-bold tracking-tight text-white">Account activeren</h1>
          <p className="mt-1 text-sm text-white/60">
            Stel je wachtwoord in en rond daarna tweestapsverificatie af.
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
              Uitnodiging voor{" "}
              <span className="font-medium text-white/85">{context.email}</span>
              {session?.staffRole === "admin" ? " · rol: beheerder" : null}
            </div>

            {(context.needsFullName || !context.fullName) && (
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

            <p className="mb-4 text-[11px] leading-relaxed text-white/45">
              Na deze stap stel je tweestapsverificatie (TOTP) in. Pas daarna heb je volledige
              toegang tot McCoy Admin.
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
              {phase === "submitting" ? "Bezig…" : "Doorgaan naar MFA"}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
