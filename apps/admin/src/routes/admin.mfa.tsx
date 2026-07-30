import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import { ShieldCheck } from "lucide-react";
import {
  adminEstablishSession,
  completeAdminMfa,
  signOutAdmin,
  useAdminSession,
} from "@/lib/admin-auth";
import { getAdminBrowserSupabase } from "@/lib/supabase-browser";
import logoUrl from "@/assets/logo-mccoy.png";

export const Route = createFileRoute("/admin/mfa")({
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
  const { session, ready } = useAdminSession();
  const [factorId, setFactorId] = React.useState<string | null>(null);
  const [qrCode, setQrCode] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [mode, setMode] = React.useState<"enroll" | "verify">("enroll");
  const codeInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!ready) return;
    if (!session) {
      navigate({ to: "/admin/login", replace: true });
      return;
    }
    if (!session.mfaRequired && session.nextStep === "none" && session.aal === "aal2") {
      navigate({ to: "/admin", replace: true });
    }
  }, [ready, session, navigate]);

  // autoFocus alone can miss when the field mounts after the loading shell.
  React.useEffect(() => {
    if (!ready || !session) return;
    const frame = window.requestAnimationFrame(() => {
      codeInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [ready, session, mode]);

  React.useEffect(() => {
    if (!ready || !session) return;
    const next = session.nextStep === "mfa_verify" ? "verify" : "enroll";
    setMode(next);

    if (next !== "enroll") return;

    let cancelled = false;
    const startEnroll = async () => {
      const supabase = getAdminBrowserSupabase();
      if (!supabase) {
        setError("Supabase browserconfig ontbreekt.");
        return;
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "McCoy Admin",
      });
      if (cancelled) return;
      if (enrollError || !data) {
        setError(enrollError?.message || "MFA-aanmelding mislukt.");
        return;
      }
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
    };
    void startEnroll();
    return () => {
      cancelled = true;
    };
  }, [ready, session]);

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

      navigate({ to: "/admin", replace: true });
    } catch {
      setError("MFA verifiëren mislukt.");
      setBusy(false);
    }
  };

  if (!ready || !session) {
    return (
      <div className="admin-shell flex min-h-screen items-center justify-center text-white/60">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src={logoUrl} alt="McCoy Cleaning" className="mb-5 h-14 w-auto object-contain sm:h-16" />
          <h1 className="text-2xl font-bold tracking-tight text-white">Tweestapsverificatie</h1>
          <p className="mt-1 text-sm text-white/60">
            {mode === "enroll"
              ? "Scan de QR-code met je authenticator-app en voer de code in."
              : "Voer de code uit je authenticator-app in."}
          </p>
        </div>

        <form
          onSubmit={onVerify}
          className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl backdrop-blur-xl"
        >
          {mode === "enroll" && qrCode && (
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
            </div>
          )}

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
            {busy ? "Bezig..." : "Bevestigen"}
          </button>

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
