import * as React from "react";

import {
  adminCompleteMfa,
  adminEstablishSession,
  adminSignIn,
  adminSignInWithEmail,
  adminSignOut,
  getAdminAuthMode,
  getAdminSession,
} from "@/lib/api/admin-auth.functions";
import { disposeAllAdminNotificationServices } from "@/lib/notifications/notification-service";
import { getAdminBrowserSupabase, hasBrowserSupabaseConfig } from "@/lib/supabase-browser";

export { adminEstablishSession };

export type AdminSession = {
  username: string;
  loggedInAt: number;
  mode?: "legacy" | "supabase";
  userId?: string;
  staffRole?: "super_admin" | "admin";
  aal?: "aal1" | "aal2";
  status?: "invited" | "active" | "blocked";
  mfaRequired?: boolean;
  nextStep?: "none" | "mfa_enroll" | "mfa_verify";
} | null;

export type AdminSignInResult =
  | { ok: true; session: NonNullable<AdminSession>; nextStep: NonNullable<AdminSession>["nextStep"] }
  | { ok: false; error: string };

const EVENT = "mccoy-admin-auth";

function notify() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}

/** Re-fetch server session in all `useAdminSession` subscribers. */
export function refreshAdminSessionClient(): void {
  notify();
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  return fallback;
}

export async function fetchAdminAuthMode(): Promise<{
  supabaseEnabled: boolean;
  legacyEnabled: boolean;
  hasUrl: boolean;
  hasPublishable: boolean;
  hasSecret: boolean;
}> {
  return getAdminAuthMode();
}

/**
 * Prefer server-side Supabase email/password (sets HttpOnly cookies in one hop).
 * Browser sign-in is a fallback when the server path is unavailable.
 */
export async function signInAdmin(identifier: string, password: string): Promise<AdminSignInResult> {
  const trimmed = identifier.trim();
  const looksLikeEmail = trimmed.includes("@");

  try {
    const mode = await fetchAdminAuthMode().catch(() => null);

    if (looksLikeEmail && mode?.supabaseEnabled) {
      if (!mode.hasSecret) {
        return {
          ok: false,
          error:
            "Server mist SUPABASE_SECRET_KEY — zet deze in de root .env en herstart npm run dev:admin.",
        };
      }

      const established = await adminSignInWithEmail({
        data: {
          email: trimmed.toLowerCase(),
          password,
          clientKey: trimmed.toLowerCase(),
        },
      });
      notify();
      if (!established.ok) {
        return { ok: false, error: established.error };
      }

      // Keep browser client in sync for MFA enroll/verify APIs.
      const browserSupabase = getAdminBrowserSupabase();
      if (browserSupabase) {
        await browserSupabase.auth
          .signInWithPassword({
            email: trimmed.toLowerCase(),
            password,
          })
          .catch(() => undefined);
      }

      return {
        ok: true,
        session: established.session,
        nextStep: established.nextStep,
      };
    }

    if (browserPathAvailable(looksLikeEmail)) {
      return signInViaBrowserThenEstablish(trimmed, password, mode);
    }

    const legacy = await adminSignIn({
      data: { username: trimmed.toLowerCase(), password },
    });
    notify();
    if (!legacy.ok) {
      return { ok: false, error: legacy.error };
    }
    return { ok: true, session: legacy.session, nextStep: legacy.nextStep };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error, "Inloggen mislukt. Probeer het opnieuw."),
    };
  }
}

function browserPathAvailable(looksLikeEmail: boolean): boolean {
  return Boolean(getAdminBrowserSupabase() && hasBrowserSupabaseConfig() && looksLikeEmail);
}

async function signInViaBrowserThenEstablish(
  trimmed: string,
  password: string,
  mode: Awaited<ReturnType<typeof fetchAdminAuthMode>> | null,
): Promise<AdminSignInResult> {
  if (mode && !mode.hasSecret) {
    return {
      ok: false,
      error:
        "Server mist SUPABASE_SECRET_KEY — zet deze in de root .env en herstart npm run dev:admin.",
    };
  }

  const browserSupabase = getAdminBrowserSupabase();
  if (!browserSupabase) {
    return { ok: false, error: "Supabase browserconfig ontbreekt." };
  }

  const { data, error } = await browserSupabase.auth.signInWithPassword({
    email: trimmed.toLowerCase(),
    password,
  });

  if (error || !data.session) {
    return { ok: false, error: "Onjuiste e-mail of wachtwoord." };
  }

  const established = await adminEstablishSession({
    data: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      clientKey: trimmed.toLowerCase(),
    },
  });

  notify();

  if (!established.ok) {
    await browserSupabase.auth.signOut().catch(() => undefined);
    return { ok: false, error: established.error };
  }

  return {
    ok: true,
    session: established.session,
    nextStep: established.nextStep,
  };
}

export async function completeAdminMfa(): Promise<AdminSignInResult> {
  try {
    const result = await adminCompleteMfa();
    notify();
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true, session: result.session, nextStep: result.nextStep };
  } catch (error) {
    return { ok: false, error: errorMessage(error, "MFA afronden mislukt.") };
  }
}

export async function signOutAdmin(): Promise<void> {
  disposeAllAdminNotificationServices();
  const browserSupabase = getAdminBrowserSupabase();
  if (browserSupabase) {
    await browserSupabase.auth.signOut().catch(() => undefined);
  }
  await adminSignOut();
  notify();
}

export async function fetchAdminSession(): Promise<AdminSession> {
  const result = await getAdminSession();
  return result.session;
}

export function useAdminSession(): { session: AdminSession; ready: boolean } {
  const [session, setSession] = React.useState<AdminSession>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      try {
        const next = await fetchAdminSession();
        if (!cancelled) {
          setSession(next);
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setSession(null);
          setReady(true);
        }
      }
    };
    void sync();
    const onEvent = () => {
      void sync();
    };
    window.addEventListener(EVENT, onEvent);
    window.addEventListener("focus", onEvent);
    return () => {
      cancelled = true;
      window.removeEventListener(EVENT, onEvent);
      window.removeEventListener("focus", onEvent);
    };
  }, []);

  return { session, ready };
}

/** Shown only when legacy demo auth is the active path. */
export const ADMIN_DEMO_CREDENTIALS = { username: "admin", password: "mccoy2026" };
