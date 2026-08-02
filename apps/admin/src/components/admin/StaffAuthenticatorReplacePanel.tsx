import * as React from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { refreshAdminSessionClient } from "@/lib/admin-auth";
import { finalizeStaffAuthenticatorReplaceFn } from "@/lib/api/staff-settings.functions";
import { getAdminBrowserSupabase } from "@/lib/supabase-browser";

type Phase = "idle" | "enrolling" | "ready" | "submitting" | "success" | "error";

type Props = {
  aal: "aal1" | "aal2" | null | undefined;
  onRequireMfa: () => void;
};

export function StaffAuthenticatorReplacePanel({ aal, onRequireMfa }: Props) {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [factorId, setFactorId] = React.useState<string | null>(null);
  const [qrCode, setQrCode] = React.useState<string | null>(null);
  const [secret, setSecret] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [message, setMessage] = React.useState<string | null>(null);
  const enrollAttempted = React.useRef(false);

  const startReplace = async () => {
    if (aal !== "aal2") {
      onRequireMfa();
      return;
    }

    setPhase("enrolling");
    setMessage(null);
    setCode("");
    setFactorId(null);
    setQrCode(null);
    setSecret(null);
    enrollAttempted.current = false;

    const supabase = getAdminBrowserSupabase();
    if (!supabase) {
      setPhase("error");
      setMessage("Supabase browserconfig ontbreekt.");
      return;
    }

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
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName,
    });
    if (error || !data) {
      setPhase("error");
      setMessage(
        error?.message ||
          "QR-code kon niet worden aangemaakt. Probeer het opnieuw of vraag herstel aan een super admin.",
      );
      return;
    }

    enrollAttempted.current = true;
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setPhase("ready");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!factorId) return;

    setPhase("submitting");
    setMessage(null);

    const supabase = getAdminBrowserSupabase();
    if (!supabase) {
      setPhase("error");
      setMessage("Supabase browserconfig ontbreekt.");
      return;
    }

    const challenge = await supabase.auth.mfa.challenge({ factorId });
    if (challenge.error || !challenge.data) {
      setPhase("ready");
      setMessage(challenge.error?.message || "MFA-challenge mislukt.");
      return;
    }

    const verified = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.data.id,
      code: code.trim(),
    });
    if (verified.error) {
      setPhase("ready");
      setMessage("Ongeldige code. Probeer het opnieuw.");
      return;
    }

    const finalized = await finalizeStaffAuthenticatorReplaceFn({
      data: { keepFactorId: factorId },
    });
    if (!finalized.ok) {
      setPhase("ready");
      setMessage(finalized.error);
      return;
    }

    refreshAdminSessionClient();
    setPhase("success");
    setMessage("Je authenticator is opnieuw gekoppeld.");
    setCode("");
    setFactorId(null);
    setQrCode(null);
    setSecret(null);
    enrollAttempted.current = false;
  };

  const cancel = () => {
    setPhase("idle");
    setMessage(null);
    setCode("");
    setFactorId(null);
    setQrCode(null);
    setSecret(null);
    enrollAttempted.current = false;
  };

  if (phase === "idle") {
    return (
      <div className="space-y-3">
        <p className="text-[11px] leading-relaxed text-white/45">
          Koppel je authenticator opnieuw wanneer je de app opnieuw installeert. Je bent al
          ingelogd met 2FA — je hoeft geen oude code in te voeren.
        </p>
        <p className="text-[11px] leading-relaxed text-white/45">
          Authenticator kwijt en kun je niet inloggen? Vraag een super admin om{" "}
          <strong className="font-medium text-white/70">Herstel account</strong> via Instellingen →
          Medewerkers.
        </p>
        <button
          type="button"
          onClick={() => void startReplace()}
          className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
        >
          QR-code opnieuw koppelen
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {(phase === "enrolling" || (phase === "ready" && !qrCode)) && (
        <div className="flex items-center gap-3 py-4 text-sm text-white/60">
          <Loader2 className="h-4 w-4 animate-spin" />
          QR-code voorbereiden…
        </div>
      )}

      {qrCode && (
        <div className="flex flex-col items-center gap-3">
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
          <label className="block w-full max-w-xs" htmlFor="replace-mfa-code">
            <span className="mb-1.5 block text-xs font-medium text-white/70">
              Nieuwe authenticatiecode
            </span>
            <div className="relative">
              <ShieldCheck className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                id="replace-mfa-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
                maxLength={6}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-10 py-2.5 text-sm tracking-widest text-white outline-none transition focus:border-[#1e88e5] focus:ring-2 focus:ring-[#1e88e5]/30"
                placeholder="000000"
              />
            </div>
          </label>
        </div>
      )}

      {message && (
        <div
          role={phase === "success" ? "status" : "alert"}
          className={
            phase === "success"
              ? "rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100"
              : "rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300"
          }
        >
          {message}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {qrCode && (
          <button
            type="submit"
            disabled={phase === "submitting" || code.length !== 6}
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#1e88e5] to-[#7c3aed] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {phase === "submitting" ? "Bezig…" : "Nieuwe authenticator bevestigen"}
          </button>
        )}
        <button
          type="button"
          onClick={cancel}
          className="inline-flex items-center justify-center rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          Annuleren
        </button>
      </div>
    </form>
  );
}
