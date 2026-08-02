import { createClient } from "@supabase/supabase-js";

import type { StaffRole, StaffUserProfile, UserStatus } from "@mccoy/domain";
import { isStaffRole } from "@mccoy/domain";
import {
  AdminAuthError,
  assertAdminLoginRateLimit,
  clearAllAdminAuthCookies,
  clearSupabaseAuthCookies,
  getAdminCredentials,
  isLegacyAdminAuthEnabled,
  issueAdminSessionCookie,
  issueSupabaseAuthCookies,
  preferSupabaseAdminAuth,
  readAdminSessionFromCookie,
  readSupabaseAccessToken,
  readSupabaseRefreshToken,
  type AdminPrincipal,
} from "@mccoy/security";

import {
  activateStaffUser,
  getStaffInvitationForAuthUser,
  getStaffUserById,
  shouldDeferStaffActivationForMfaRecovery,
  writeStaffAudit,
} from "./staff";
import { assertStaffProfileAllowsAdminSession } from "./staff-policy";
import {
  createSupabaseServiceClient,
  getSupabasePublicConfig,
  hasSupabasePublicConfig,
  hasSupabaseServiceConfig,
} from "./supabase";

export type AdminSessionOptions = {
  /** Allow aal1 sessions that still need MFA enrollment/challenge (login + MFA routes). */
  allowMfaEnrollment?: boolean;
};

export type StaffAuthNextStep = "none" | "mfa_enroll" | "mfa_verify";

export type AdminSessionView = {
  username: string;
  loggedInAt: number;
  mode: AdminPrincipal["mode"];
  userId?: string;
  staffRole?: StaffRole;
  aal?: "aal1" | "aal2";
  status?: UserStatus;
  mfaRequired?: boolean;
  nextStep?: StaffAuthNextStep;
};

export type EstablishStaffSessionResult =
  | {
      ok: true;
      session: AdminSessionView;
      nextStep: StaffAuthNextStep;
    }
  | {
      ok: false;
      error: string;
      code?:
        | "invalid_credentials"
        | "not_staff"
        | "blocked"
        | "rate_limited"
        | "config"
        | "unknown";
    };

function isSupabaseStaffAuthReady(): boolean {
  return preferSupabaseAdminAuth() && hasSupabasePublicConfig() && hasSupabaseServiceConfig();
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split(".");
  if (parts.length < 2 || !parts[1]) return null;
  try {
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readAal(accessToken: string): "aal1" | "aal2" {
  const payload = decodeJwtPayload(accessToken);
  const aal = payload?.aal;
  return aal === "aal2" ? "aal2" : "aal1";
}

function createUserScopedClient(accessToken: string) {
  const { url, publishableKey } = getSupabasePublicConfig();
  return createClient(url, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

/** Verified TOTP factor count for the given access token (0 when unavailable). */
export async function countVerifiedTotpFactorsForAccessToken(
  accessToken: string,
): Promise<number> {
  const client = createUserScopedClient(accessToken);
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) return 0;
  const totp = data?.totp ?? [];
  return totp.filter((f) => f.status === "verified").length;
}

async function listVerifiedTotpFactorCount(accessToken: string): Promise<number> {
  return countVerifiedTotpFactorsForAccessToken(accessToken);
}

async function resolveNextStep(
  accessToken: string,
  aal: "aal1" | "aal2",
): Promise<StaffAuthNextStep> {
  if (aal === "aal2") return "none";
  const verified = await listVerifiedTotpFactorCount(accessToken);
  return verified > 0 ? "mfa_verify" : "mfa_enroll";
}

function toSessionView(
  principal: AdminPrincipal,
  nextStep: StaffAuthNextStep = "none",
): AdminSessionView {
  return {
    username: principal.username,
    loggedInAt: principal.loggedInAt,
    mode: principal.mode,
    userId: principal.userId,
    staffRole: principal.staffRole,
    aal: principal.aal,
    status: principal.status,
    mfaRequired: principal.mfaRequired,
    nextStep,
  };
}

/** Access token for the current HttpOnly staff session (refreshes when needed). */
export async function getStaffAccessToken(): Promise<string | null> {
  return refreshAccessTokenIfNeeded();
}

async function refreshAccessTokenIfNeeded(): Promise<string | null> {
  let access = readSupabaseAccessToken();
  if (access) return access;

  const refresh = readSupabaseRefreshToken();
  if (!refresh) return null;

  const { url, publishableKey } = getSupabasePublicConfig();
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.refreshSession({ refresh_token: refresh });
  if (error || !data.session) {
    clearSupabaseAuthCookies();
    return null;
  }
  issueSupabaseAuthCookies({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
  });
  return data.session.access_token;
}

async function resolveSupabasePrincipal(
  accessToken: string,
  options: AdminSessionOptions,
): Promise<{ principal: AdminPrincipal; nextStep: StaffAuthNextStep }> {
  const service = createSupabaseServiceClient();
  const { data, error } = await service.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new AdminAuthError("Niet geautoriseerd. Log opnieuw in.");
  }

  const profile = await getStaffUserById(data.user.id);
  if (!profile) {
    throw new AdminAuthError("Niet geautoriseerd. Log opnieuw in.");
  }

  assertStaffProfileAllowsAdminSession(profile);
  if (!isStaffRole(profile.staffRole)) {
    throw new AdminAuthError("Geen toegang tot de admin.");
  }

  const aal = readAal(accessToken);
  const nextStep = await resolveNextStep(accessToken, aal);
  const mfaRequired = nextStep !== "none";

  if (aal === "aal2" && profile.status === "invited") {
    const invitation = await getStaffInvitationForAuthUser(profile.id);
    if (!shouldDeferStaffActivationForMfaRecovery(invitation)) {
      try {
        const activated = await activateStaffUser(profile.id);
        if (activated) {
          try {
            await writeStaffAudit({
              actorUserId: profile.id,
              action: "staff.mfa_onboarding_completed",
              targetType: "user",
              targetId: profile.id,
              before: { status: "invited" },
              after: { status: "active" },
            });
          } catch {
            // Private schema exposure must not block login.
          }
          profile.status = "active";
        }
      } catch {
        // Do not block aal2 access solely on activation write failure.
      }
    }
  }

  if (mfaRequired && !options.allowMfaEnrollment) {
    throw new AdminAuthError("MFA is vereist voordat je verder kunt.");
  }

  if (profile.status === "invited") {
    // aal2 may proceed even if activation write failed (retried above / on next request).
    const onboardingOk = aal === "aal2" || (mfaRequired && options.allowMfaEnrollment === true);
    if (!onboardingOk) {
      throw new AdminAuthError("Rond MFA-onboarding af om toegang te krijgen.");
    }
  } else if (profile.status !== "active") {
    throw new AdminAuthError("Geen toegang tot de admin.");
  }

  const principal: AdminPrincipal = {
    username: profile.email,
    loggedInAt: Date.now(),
    mode: "supabase",
    userId: profile.id,
    staffRole: profile.staffRole ?? undefined,
    aal,
    status: profile.status,
    mfaRequired,
  };

  return { principal, nextStep };
}

/**
 * Authoritative admin gate. Uses Supabase staff identity when configured;
 * otherwise legacy ADMIN_* cookie (or when ADMIN_LEGACY_AUTH=true as fallback).
 */
export async function requireAdminSession(
  options: AdminSessionOptions = {},
): Promise<AdminPrincipal> {
  if (isSupabaseStaffAuthReady()) {
    const access = await refreshAccessTokenIfNeeded();
    if (access) {
      const { principal } = await resolveSupabasePrincipal(access, options);
      return principal;
    }
    if (!isLegacyAdminAuthEnabled()) {
      throw new AdminAuthError("Niet geautoriseerd. Log opnieuw in.");
    }
  }

  if (!isLegacyAdminAuthEnabled() && preferSupabaseAdminAuth()) {
    throw new AdminAuthError("Niet geautoriseerd. Log opnieuw in.");
  }

  const legacy = readAdminSessionFromCookie();
  if (!legacy || legacy.mode === "supabase") {
    throw new AdminAuthError("Niet geautoriseerd. Log opnieuw in.");
  }
  return { ...legacy, mode: "legacy" };
}

export async function readAdminSession(
  options: AdminSessionOptions = { allowMfaEnrollment: true },
): Promise<AdminSessionView | null> {
  try {
    if (isSupabaseStaffAuthReady()) {
      const access = await refreshAccessTokenIfNeeded();
      if (access) {
        const { principal, nextStep } = await resolveSupabasePrincipal(access, {
          allowMfaEnrollment: true,
          ...options,
        });
        return toSessionView(principal, nextStep);
      }
      if (!isLegacyAdminAuthEnabled()) return null;
    }

    const legacy = readAdminSessionFromCookie();
    if (!legacy || legacy.mode === "supabase") return null;
    return toSessionView({ ...legacy, mode: "legacy" }, "none");
  } catch (error) {
    if (error instanceof AdminAuthError) return null;
    throw error;
  }
}

/**
 * Server-side email/password sign-in (publishable key). Used when the browser
 * cannot call Supabase directly (missing VITE_*) but the server is configured.
 */
export async function establishStaffSessionWithPassword(input: {
  email: string;
  password: string;
  clientKey?: string;
}): Promise<EstablishStaffSessionResult> {
  if (!isSupabaseStaffAuthReady()) {
    return { ok: false, error: "Supabase is niet geconfigureerd op de server.", code: "config" };
  }

  const email = input.email.trim().toLowerCase();
  const rateKey = (input.clientKey || email || "unknown").slice(0, 80);
  try {
    assertAdminLoginRateLimit(rateKey);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message, code: "rate_limited" };
    }
    throw error;
  }

  const { url, publishableKey } = getSupabasePublicConfig();
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (error || !data.session) {
    return { ok: false, error: "Onjuiste e-mail of wachtwoord.", code: "invalid_credentials" };
  }

  return establishStaffSessionFromTokens({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    clientKey: email,
    // Password path already rate-limited above.
    skipRateLimit: true,
  });
}

export type StaffSessionBrowserHydration = {
  accessToken: string;
  refreshToken: string;
};

/**
 * After Admin API password set invalidates invite/recovery link tokens, sign in with the
 * new password and re-issue HttpOnly cookies so MFA enrollment continues in the same flow.
 */
export async function reestablishStaffSessionAfterPasswordSet(input: {
  email: string;
  password: string;
  clientKey?: string;
}): Promise<
  EstablishStaffSessionResult & { browserHydration?: StaffSessionBrowserHydration }
> {
  if (!isSupabaseStaffAuthReady()) {
    return { ok: false, error: "Supabase is niet geconfigureerd.", code: "config" };
  }

  const email = input.email.trim().toLowerCase();
  const { url, publishableKey } = getSupabasePublicConfig();
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: input.password,
  });
  if (error || !data.session) {
    return {
      ok: false,
      error:
        "Sessie kon niet worden vernieuwd na het instellen van je wachtwoord. Probeer opnieuw in te loggen.",
      code: "unknown",
    };
  }

  const established = await establishStaffSessionFromTokens({
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    clientKey: input.clientKey ?? email,
    skipRateLimit: true,
  });
  if (!established.ok) return established;

  return {
    ...established,
    browserHydration: {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
    },
  };
}

export type EstablishStaffSessionFromCallbackResult =
  | {
      ok: true;
      session: AdminSessionView;
      nextStep: StaffAuthNextStep;
      /**
       * One-shot tokens so supabase-js can run MFA enroll in the browser.
       * McCoy does not store these in sessionStorage; client hydrates then discards.
       * Durable mobile recovery is the HttpOnly cookies set by this call.
       */
      browserHydration: { accessToken: string; refreshToken: string };
    }
  | {
      ok: false;
      error: string;
      code?:
        | "invalid_credentials"
        | "not_staff"
        | "blocked"
        | "rate_limited"
        | "config"
        | "unknown";
    };

/**
 * Verify invite/recovery Auth callback on the server and set HttpOnly cookies.
 * Preferred over browser verifyOtp + sessionStorage handoff (XSS / WebView safe).
 */
export async function establishStaffSessionFromEmailAuthCallback(input: {
  tokenHash?: string;
  type?: "invite" | "recovery" | "signup" | "magiclink" | "email";
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  clientKey?: string;
}): Promise<EstablishStaffSessionFromCallbackResult> {
  if (!isSupabaseStaffAuthReady()) {
    return {
      ok: false,
      error:
        "Supabase is niet geconfigureerd op de server (controleer SUPABASE_URL, publishable key en SUPABASE_SECRET_KEY).",
      code: "config",
    };
  }

  const rateKey = (input.clientKey || input.tokenHash || input.code || "auth-callback").slice(0, 80);
  try {
    assertAdminLoginRateLimit(rateKey);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message, code: "rate_limited" };
    }
    throw error;
  }

  try {
    let accessToken = input.accessToken?.trim() || "";
    let refreshToken = input.refreshToken?.trim() || "";

    if ((!accessToken || !refreshToken) && (input.code || input.tokenHash)) {
      const { url, publishableKey } = getSupabasePublicConfig();
      const authClient = createClient(url, publishableKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      if (input.code) {
        const exchanged = await authClient.auth.exchangeCodeForSession(input.code);
        if (exchanged.error || !exchanged.data.session) {
          return {
            ok: false,
            error:
              exchanged.error?.message ||
              "Uitnodigingslink is ongeldig of verlopen. Vraag een nieuwe uitnodiging aan.",
            code: "invalid_credentials",
          };
        }
        accessToken = exchanged.data.session.access_token;
        refreshToken = exchanged.data.session.refresh_token;
      } else if (input.tokenHash && input.type) {
        const verified = await authClient.auth.verifyOtp({
          token_hash: input.tokenHash,
          type: input.type,
        });
        if (verified.error || !verified.data.session) {
          return {
            ok: false,
            error:
              verified.error?.message ||
              "Uitnodigingslink is ongeldig of verlopen. Vraag een nieuwe uitnodiging aan.",
            code: "invalid_credentials",
          };
        }
        accessToken = verified.data.session.access_token;
        refreshToken = verified.data.session.refresh_token;
      }
    }

    if (!accessToken || !refreshToken) {
      return {
        ok: false,
        error: "Ongeldige of incomplete uitnodigingslink.",
        code: "invalid_credentials",
      };
    }

    const established = await establishStaffSessionFromTokens({
      accessToken,
      refreshToken,
      clientKey: input.clientKey,
      skipRateLimit: true,
    });
    if (!established.ok) return established;

    return {
      ok: true,
      session: established.session,
      nextStep: established.nextStep,
      browserHydration: { accessToken, refreshToken },
    };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message, code: "unknown" };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Uitnodigingssessie mislukt.",
      code: "unknown",
    };
  }
}

/**
 * Re-hydrate supabase-js from HttpOnly cookies after a clean reload (no URL tokens).
 * Used for MFA enroll when the invite page already exchanged the link server-side.
 */
export async function hydrateBrowserStaffAuthFromCookies(): Promise<
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; error: string; code?: "missing_session" | "unauthorized" | "unknown" }
> {
  try {
    const accessToken = readSupabaseAccessToken();
    const refreshToken = readSupabaseRefreshToken();
    if (!accessToken || !refreshToken) {
      return {
        ok: false,
        error: "Geen geldige sessie. Open de uitnodigingslink opnieuw.",
        code: "missing_session",
      };
    }
    // Ensure cookies belong to a staff invite/MFA-capable principal.
    await resolveSupabasePrincipal(accessToken, { allowMfaEnrollment: true });
    return { ok: true, accessToken, refreshToken };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message, code: "unauthorized" };
    }
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Sessie kon niet worden hersteld.",
      code: "unknown",
    };
  }
}

export async function establishStaffSessionFromTokens(input: {
  accessToken: string;
  refreshToken: string;
  clientKey?: string;
  /** When true, skip login rate-limit (caller already limited). */
  skipRateLimit?: boolean;
}): Promise<EstablishStaffSessionResult> {
  if (!isSupabaseStaffAuthReady()) {
    return {
      ok: false,
      error:
        "Supabase is niet geconfigureerd op de server (controleer SUPABASE_URL, publishable key en SUPABASE_SECRET_KEY; herstart admin na .env-wijzigingen).",
      code: "config",
    };
  }

  if (!input.skipRateLimit) {
    const rateKey = (input.clientKey || "unknown").slice(0, 80);
    try {
      assertAdminLoginRateLimit(rateKey);
    } catch (error) {
      if (error instanceof AdminAuthError) {
        return { ok: false, error: error.message, code: "rate_limited" };
      }
      throw error;
    }
  }

  try {
    const { principal, nextStep } = await resolveSupabasePrincipal(input.accessToken, {
      allowMfaEnrollment: true,
    });

    clearAllAdminAuthCookies();
    issueSupabaseAuthCookies({
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
    });
    // Lightweight signed marker for mode detection / TTL UX (not the auth source of truth).
    issueAdminSessionCookie({
      username: principal.username,
      loggedInAt: principal.loggedInAt,
      mode: "supabase",
      userId: principal.userId,
      staffRole: principal.staffRole,
      aal: principal.aal,
      status: principal.status,
      mfaRequired: principal.mfaRequired,
    });

    return {
      ok: true,
      session: toSessionView(principal, nextStep),
      nextStep,
    };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      const message = error.message;
      if (message.includes("geblokkeerd")) {
        return { ok: false, error: message, code: "blocked" };
      }
      if (message.includes("Geen toegang") || message.includes("Niet geautoriseerd")) {
        return {
          ok: false,
          error: message.includes("Geen toegang")
            ? "Geen toegang tot de admin. Dit account is geen staff-gebruiker."
            : "Geen staff-profiel gevonden of sessie ongeldig. Draai bootstrap/migraties als dit het eerste account is.",
          code: "not_staff",
        };
      }
      if (message.includes("MFA") || message.includes("onboarding")) {
        return { ok: false, error: message, code: "unknown" };
      }
      // Surface real Auth errors (do not collapse to generic invalid credentials).
      return { ok: false, error: message, code: "unknown" };
    }
    if (error instanceof Error) {
      const msg = error.message;
      if (/getStaffUserById|Missing SUPABASE|SupabaseConfig|schema cache|relation .* does not exist/i.test(msg)) {
        return {
          ok: false,
          error:
            "Server kan staff-profiel niet laden. Controleer of identity-migraties zijn toegepast en SUPABASE_SECRET_KEY geladen is (herstart admin).",
          code: "config",
        };
      }
    }
    return { ok: false, error: "Inloggen mislukt.", code: "unknown" };
  }
}

export async function establishLegacyAdminSession(input: {
  username: string;
  password: string;
}): Promise<EstablishStaffSessionResult> {
  if (!isLegacyAdminAuthEnabled()) {
    return {
      ok: false,
      error: "Legacy admin login is uitgeschakeld. Gebruik je Supabase e-mailadres.",
      code: "config",
    };
  }

  try {
    assertAdminLoginRateLimit(input.username.trim().toLowerCase() || "legacy");
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message, code: "rate_limited" };
    }
    throw error;
  }

  const creds = getAdminCredentials();
  const username = input.username.trim().toLowerCase();
  if (username !== creds.username || input.password !== creds.password) {
    return {
      ok: false,
      error: "Onjuiste inloggegevens.",
      code: "invalid_credentials",
    };
  }

  clearSupabaseAuthCookies();
  const principal: AdminPrincipal = {
    username: creds.username,
    loggedInAt: Date.now(),
    mode: "legacy",
  };
  issueAdminSessionCookie(principal);
  return {
    ok: true,
    session: toSessionView(principal, "none"),
    nextStep: "none",
  };
}

export async function completeStaffMfaOnboarding(): Promise<EstablishStaffSessionResult> {
  if (!isSupabaseStaffAuthReady()) {
    return { ok: false, error: "Supabase is niet geconfigureerd.", code: "config" };
  }

  const access = await refreshAccessTokenIfNeeded();
  if (!access) {
    return { ok: false, error: "Niet geautoriseerd. Log opnieuw in.", code: "invalid_credentials" };
  }

  try {
    const { principal, nextStep } = await resolveSupabasePrincipal(access, {
      allowMfaEnrollment: true,
    });

    if (nextStep !== "none" || principal.aal !== "aal2") {
      return {
        ok: false,
        error: "Rond MFA eerst af (aal2) voordat je doorgaat.",
        code: "unknown",
      };
    }

    if (principal.userId && principal.status === "invited") {
      try {
        await activateStaffUser(principal.userId);
        principal.status = "active";
        principal.mfaRequired = false;
      } catch {
        // ignore
      }
    }

    issueAdminSessionCookie({
      ...principal,
      mfaRequired: false,
      status: "active",
    });

    return {
      ok: true,
      session: toSessionView({ ...principal, mfaRequired: false, status: "active" }, "none"),
      nextStep: "none",
    };
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return { ok: false, error: error.message, code: "not_staff" };
    }
    return { ok: false, error: "MFA afronden mislukt.", code: "unknown" };
  }
}

export function signOutAdminSessions(): void {
  clearAllAdminAuthCookies();
}

export function isStaffSupabaseAuthEnabled(): boolean {
  return isSupabaseStaffAuthReady();
}
