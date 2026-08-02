import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { ShieldCheck } from "lucide-react";
import {
  adminEstablishSession,
  completeAdminMfa,
  refreshAdminSessionClient,
  signOutAdmin,
  useAdminSession,
} from "@/lib/admin-auth";
import { adminHydrateBrowserAuthFromCookies } from "@/lib/api/admin-auth.functions";
import { completeStaffMfaRecoveryFn } from "@/lib/api/staff-identity.functions";
import { hydrateBrowserSupabaseSession } from "@/lib/hydrate-browser-supabase-session";
import { getAdminBrowserSupabase } from "@/lib/supabase-browser";
import logoUrl from "@/assets/logo-mccoy.png";

type MfaSearch = {
  recovery?: string;
};

export const Route = createFileRoute("/admin/mfa")({
  validateSearch: (search: Record<string, unknown>): MfaSearch => ({
    recovery: typeof search.recovery === "string" ? search.recovery : undefined,
  }),
  head: () => ({
    meta: [
      { title: "MFA — McCoy Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminMfaPage,
});

function AdminMfaPage() {
  const navigate = useNavigate();
  const { recovery } = Route.useSearch();
  const isRecoveryFlow = recovery === "1";
  const { session, ready } = useAdminSession();
  const [factorId, setFactorId] = React.useState<string | null>(null);
  const [qrCode, setQrCode] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [enrollBusy, setEnrollBusy] = React.useState(false);
  const [mode, setMode] = React.useState<"enroll" | "verify">("enroll");
  const codeInputRef = React.useRef<HTMLInputElement>(null);
  const enrollAttemptedForUser = React.useRef<string | null>(null);

  const nextStep = session?.nextStep;
  const userId = session?.userId ?? session?.username ?? null;

  React.useEffect(() => {
    if (!ready) return;
    if (!session) {
      let cancelled = false;
      const recover = async () => {
        // Prefer HttpOnly cookies from server-side invite exchange (mobile-safe).
        const fromCookies = await adminHydrateBrowserAuthFromCookies();
        if (cancelled) return;
        if (fromCookies.ok) {
          await hydrateBrowserSupabaseSession({
            accessToken: fromCookies.accessToken,
            refreshToken: fromCookies.refreshToken,
          });
          refreshAdminSessionClient();
          return;
        }

        const supabase = getAdminBrowserSupabase();
        const browserSession = supabase
          ? (await supabase.auth.getSession()).data.session
          : null;
        if (cancelled) return;
        if (browserSession) {
          const established = await adminEstablishSession({
            data: {
              accessToken: browserSession.access_token,
              refreshToken: browserSession.refresh_token,
              clientKey: browserSession.user.email ?? undefined,
            },
          });
          if (cancelled) return;
          if (established.ok) {
            refreshAdminSessionClient();
            return;
          }
        }
        navigate({ to: "/admin/login", replace: true });
      };
      void recover();
      return () => {
        cancelled = true;
      };
    }
    if (!session.mfaRequired && session.nextStep === "none" && session.aal === "aal2") {
      navigate({ to: "/admin", replace: true });
    }
  }, [ready, session, navigate]);

  React.useEffect(() => {
    if (!ready || !session) return;
    const frame = window.requestAnimationFrame(() => {
      codeInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ready, session, mode]);

  React.useEffect(() => {
    if (!ready || !userId) return;

    const next = nextStep === "mfa_verify" ? "verify" : "enroll";
    setMode(next);
    if (next !== "enroll") return;

    // Only one enroll attempt per user on this page — re-running cancels in-flight
    // enroll and leaves orphan unverified factors (infinite spinner / disabled button).
    if (enrollAttemptedForUser.current === userId) return;
    enrollAttemptedForUser.current = userId;

    let cancelled = false;

    const startEnroll = async () => {
      setEnrollBusy(true);
      setError(null);
      const supabase = getAdminBrowserSupabase();
      if (!supabase) {
        setError("Supabase browserconfig ontbreekt.");
        setEnrollBusy(false);
        return;
      }

      // Invite exchange sets HttpOnly cookies; hydrate supabase-js for MFA enroll APIs.
      let { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const fromCookies = await adminHydrateBrowserAuthFromCookies();
        if (fromCookies.ok) {
          await hydrateBrowserSupabaseSession({
            accessToken: fromCookies.accessToken,
            refreshToken: fromCookies.refreshToken,
          });
          sessionData = (await supabase.auth.getSession()).data;
        }
      }
      if (!sessionData.session) {
        setError(
          "Sessie verlopen voor MFA. Log opnieuw in of open de uitnodigingslink opnieuw.",
        );
        setEnrollBusy(false);
        return;
      }

      // Remove incomplete enrollments so a fresh QR can be issued.
      const listed = await supabase.auth.mfa.listFactors();
      const pending = [
        ...(listed.data?.all ?? []),
        ...(listed.data?.totp ?? []),
      ].filter((factor, index, arr) => {
        const first = arr.findIndex((f) => f.id === factor.id);
        return first === index && factor.status !== "verified";
      });
      for (const factor of pending) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => undefined);
      }

      const friendlyName = `McCoy Admin ${Date.now().toString(36)}`;
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName,
      });
      if (cancelled) return;
      if (enrollError || !data) {
        enrollAttemptedForUser.current = null;
        setError(
          enrollError?.message ||
            "MFA-aanmelding mislukt. Vernieuw de pagina of log opnieuw in.",
        );
        setEnrollBusy(false);
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setEnrollBusy(false);
    };

    void startEnroll();
    return () => {
      cancelled = true;
      // React Strict Mode runs effect → cleanup → effect. Reset so the second
      // run can enroll; otherwise the first attempt is cancelled and never retried.
      if (enrollAttemptedForUser.current === userId) {
        enrollAttemptedForUser.current = null;
      }
    };
  }, [ready, userId, nextStep]);

  const syncCookiesFromBrowserSession = async () => {
    const supabase = getAdminBrowserSupabase();
    if (!supabase) return false;
    const { data } = await supabase.auth.getSession();
    if (!data.session) return false;
    const established = await adminEstablishSession({
      data: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        clientKey: session?.username,
      },
    });
    return established.ok && established.nextStep === "none";
  };

  const onVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = getAdminBrowserSupabase();
      if (!supabase) {
        setError("Supabase browserconfig ontbreekt.");
        setBusy(false);
        return;
      }

      let activeFactorId = factorId;
      if (mode === "verify" && !activeFactorId) {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        activeFactorId = factors?.totp.find((f) => f.status === "verified")?.id ?? null;
      }
      if (!activeFactorId) {
        setError("Geen MFA-factor gevonden. Probeer opnieuw in te loggen.");
        setBusy(false);
        return;
      }

      const challenge = await supabase.auth.mfa.challenge({ factorId: activeFactorId });
      if (challenge.error || !challenge.data) {
        setError(challenge.error?.message || "MFA-challenge mislukt.");
        setBusy(false);
        return;
      }

      const verified = await supabase.auth.mfa.verify({
        factorId: activeFactorId,
        challengeId: challenge.data.id,
        code: code.trim(),
      });
      if (verified.error) {
        setError("Ongeldige code. Probeer het opnieuw.");
        setBusy(false);
        return;
      }

      if (isRecoveryFlow) {
        const completed = await completeStaffMfaRecoveryFn();
        if (!completed.ok) {
          setError(completed.error);
          setBusy(false);
          return;
        }

        await signOutAdmin();
        refreshAdminSessionClient();
        navigate({ to: "/admin/login", search: { recovered: "1" }, replace: true });
        return;
      }

      const cookiesOk = await syncCookiesFromBrowserSession();
      if (!cookiesOk) {
        const completed = await completeAdminMfa();
        if (!completed.ok) {
          setError(completed.error);
          setBusy(false);
          return;
        }
      } else {
        await completeAdminMfa().catch(() => undefined);
      }

      refreshAdminSessionClient();
      navigate({ to: "/admin", replace: true });
    } catch {
      setError("MFA verifiëren mislukt.");
      setBusy(false);
    }
  };

  if (!ready || !session) {
    return (
      <div className="admin-shell flex min-h-screen items-center justify-center text-white/60">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          <p className="text-sm">Sessie laden…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logoUrl} alt="McCoy Cleaning" className="mb-5 h-20 w-auto object-contain sm:h-24" />
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {isRecoveryFlow ? "Nieuwe authenticator koppelen" : "Tweestapsverificatie"}
          </h1>
          <p className="mt-1 text-sm text-white/60">
            {mode === "enroll"
              ? isRecoveryFlow
                ? "Scan de QR-code met je authenticator-app en voer de code in. Daarna log je opnieuw in met je bestaande wachtwoord."
                : "Scan de QR-code met je authenticator-app en voer de code in."
              : "Voer de code uit je authenticator-app in."}
          </p>
        </div>

        <form
          onSubmit={onVerify}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl"
        >
          {mode === "enroll" && enrollBusy && !qrCode && (
            <div className="mb-4 flex flex-col items-center gap-3 py-6 text-sm text-white/60">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
              <p>QR-code voorbereiden…</p>
            </div>
          )}

          {mode === "enroll" && qrCode ? (
            <div className="mb-4 flex flex-col items-center gap-3">
              <img
                src={qrCode}
                alt="TOTP QR-code voor McCoy Admin MFA"
                className="h-48 w-48 rounded-xl bg-white p-2"
              />
              {secret && (
                <p className="break-all text-center text-[11px] text-white/50">
                  Handmatige sleutel: <code className="text-white/80">{secret}</code>
                </p>
              )}
              <label className="block w-full max-w-xs" htmlFor="mfa-code">
                <span className="mb-1.5 block text-xs font-medium text-white/70">
                  Authenticatiecode
                </span>
                <div className="relative">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    ref={codeInputRef}
                    id="mfa-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    autoFocus
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    maxLength={12}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-10 py-2.5 text-sm tracking-widest text-white outline-none transition focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30"
                    placeholder="000000"
                  />
                </div>
              </label>
            </div>
          ) : (
            <label className="mb-4 block" htmlFor="mfa-code">
              <span className="mb-1.5 block text-xs font-medium text-white/70">Authenticatiecode</span>
              <div className="relative">
                <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <input
                  ref={codeInputRef}
                  id="mfa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  maxLength={12}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-10 py-2.5 text-sm tracking-widest text-white outline-none transition focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30"
                  placeholder="000000"
                />
              </div>
            </label>
          )}

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
            disabled={busy || (mode === "enroll" && !factorId)}
            className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#1e88e5] to-[#7c3aed] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Bezig..." : mode === "enroll" && !factorId ? "Even geduld…" : "Bevestigen"}
          </button>

          {mode === "verify" && (
            <p className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-100/90">
              Authenticator kwijt? Je kunt je 2FA niet zelf resetten zonder de huidige code.
              Vraag een super admin om <strong className="font-semibold">Herstel account</strong>{" "}
              via Instellingen → Medewerkers.
            </p>
          )}

          <button
            type="button"
            className="mt-3 w-full text-center text-xs text-white/50 underline-offset-2 hover:text-white/80 hover:underline"
            onClick={() => {
              void signOutAdmin().then(() => navigate({ to: "/admin/login", replace: true }));
            }}
          >
            Uitloggen en opnieuw beginnen
          </button>
        </form>
      </div>
    </div>
  );
}
