import { createFileRoute, useNavigate } from "@tanstack/react-router";
import * as React from "react";
import {
  fetchAdminSession,
  refreshAdminSessionClient,
  signOutAdmin,
  useAdminSession,
} from "@/lib/admin-auth";
import {
  adminExchangeAuthCallback,
  adminHydrateBrowserAuthFromCookies,
} from "@/lib/api/admin-auth.functions";
import { getStaffMfaRecoveryContextFn } from "@/lib/api/staff-identity.functions";
import { hydrateBrowserSupabaseSession } from "@/lib/hydrate-browser-supabase-session";
import {
  clearStaffInviteAuthCallbackFromUrl,
} from "@/lib/staff-invite-callback";
import {
  hasStaffAuthCallbackParams,
  parseStaffAuthCallbackParams,
} from "@/lib/staff-auth-callback-params";
import logoUrl from "@/assets/logo-mccoy.png";

export const Route = createFileRoute("/admin/recover-mfa")({
  head: () => ({
    meta: [
      { title: "Authenticator herstellen — McCoy Admin" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminRecoverMfaPage,
});

type PagePhase = "booting" | "ready" | "missing_session" | "error";

function AdminRecoverMfaPage() {
  const navigate = useNavigate();
  const { ready: sessionReady } = useAdminSession();
  const [phase, setPhase] = React.useState<PagePhase>("booting");
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState<string | null>(null);
  const bootAttempted = React.useRef(false);

  const proceedToMfaEnroll = React.useCallback(async () => {
    const context = await getStaffMfaRecoveryContextFn();
    if (!context.ok) {
      setPhase("error");
      setError(context.error);
      return;
    }
    setEmail(context.email);
    setPhase("ready");
    navigate({ to: "/admin/mfa", search: { recovery: "1" }, replace: true });
  }, [navigate]);

  React.useEffect(() => {
    if (!sessionReady || bootAttempted.current) return;
    bootAttempted.current = true;

    let cancelled = false;

    const boot = async () => {
      setPhase("booting");
      setError(null);

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

        clearStaffInviteAuthCallbackFromUrl();

        if (!exchanged.ok) {
          if (!cancelled) {
            setPhase("missing_session");
            setError(exchanged.error);
          }
          return;
        }

        if (exchanged.browserHydration) {
          await hydrateBrowserSupabaseSession(exchanged.browserHydration);
        }
        refreshAdminSessionClient();

        if (!cancelled) await proceedToMfaEnroll();
        return;
      }

      const existing = await fetchAdminSession().catch(() => null);
      if (existing?.userId) {
        const hydrated = await adminHydrateBrowserAuthFromCookies();
        if (hydrated.ok) {
          await hydrateBrowserSupabaseSession({
            accessToken: hydrated.accessToken,
            refreshToken: hydrated.refreshToken,
          });
        }
        refreshAdminSessionClient();
        if (!cancelled) await proceedToMfaEnroll();
        return;
      }

      if (!cancelled) {
        setPhase("missing_session");
        setError(
          "Geen geldige herstelsessie gevonden. Open de knop in je herstel-e-mail opnieuw (op de telefoon: kies “Open in Safari/Chrome”). De link is eenmalig; vraag zo nodig een super admin om opnieuw herstel.",
        );
      }
    };

    void boot();
    return () => {
      cancelled = true;
    };
  }, [sessionReady, proceedToMfaEnroll]);

  if (phase === "booting" || phase === "ready" || !sessionReady) {
    return (
      <div className="admin-shell flex min-h-screen items-center justify-center text-white/60">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/80" />
          <p className="text-sm">
            {phase === "ready" ? "Doorverwijzen naar authenticator…" : "Herstelsessie controleren…"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-[#1e88e5]/25 blur-[160px]" />
        <div className="absolute bottom-0 right-0 h-[30rem] w-[30rem] rounded-full bg-[#7c3aed]/20 blur-[140px]" />
      </div>

      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src={logoUrl}
            alt="McCoy Cleaning"
            className="mb-5 h-20 w-auto object-contain drop-shadow-[0_0_24px_rgba(30,136,229,0.35)] sm:h-24"
            draggable={false}
          />
          <h1 className="text-2xl font-bold tracking-tight text-white">Authenticator herstellen</h1>
          {email ? (
            <p className="mt-1 text-sm text-white/60">
              Herstel voor <span className="font-medium text-white/85">{email}</span>
            </p>
          ) : null}
        </div>

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
      </div>
    </div>
  );
}
