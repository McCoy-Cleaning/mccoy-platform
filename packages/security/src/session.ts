import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import process from "node:process";

import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { readServerEnv } from "./env";
import { ensureMonorepoEnvLoaded } from "./load-monorepo-env.server";
import { assertRateLimit, RateLimitError } from "./rate-limit";

const LEGACY_COOKIE_NAME = "mccoy_admin_session";
const SB_ACCESS_COOKIE = "mccoy_sb_access_token";
const SB_REFRESH_COOKIE = "mccoy_sb_refresh_token";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const SB_ACCESS_TTL_SEC = 60 * 60; // 1 hour (refresh extends via re-issue)
const SB_REFRESH_TTL_SEC = 60 * 60 * 24 * 7;

export type AdminAuthMode = "legacy" | "supabase";

export type AdminPrincipal = {
  /** Display / rate-limit key: staff email or legacy username. */
  username: string;
  loggedInAt: number;
  mode: AdminAuthMode;
  userId?: string;
  staffRole?: "super_admin" | "admin";
  aal?: "aal1" | "aal2";
  status?: "invited" | "active" | "blocked";
  /** True when password ok but MFA enrollment/challenge still required. */
  mfaRequired?: boolean;
};

function getSessionSecret(): string {
  const secret = readServerEnv("ADMIN_SESSION_SECRET");
  if (secret) return secret;
  // Dev-only fallback — set ADMIN_SESSION_SECRET in every real environment.
  return "mccoy-dev-admin-session-secret-change-me";
}

export function getAdminCredentials(): { username: string; password: string } {
  return {
    username: (readServerEnv("ADMIN_USERNAME") || "admin").toLowerCase(),
    password: readServerEnv("ADMIN_PASSWORD") || "mccoy2026",
  };
}

/**
 * True when server has URL + publishable + secret — enough for staff Auth cutover.
 * Missing secret keeps legacy available so admin is not locked out.
 */
export function hasSupabaseAdminEnvHints(): boolean {
  ensureMonorepoEnvLoaded();
  const url = readServerEnv("SUPABASE_URL") || readServerEnv("VITE_SUPABASE_URL");
  const publishable =
    readServerEnv("SUPABASE_PUBLISHABLE_KEY") ||
    readServerEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  const secret = readServerEnv("SUPABASE_SECRET_KEY");
  return Boolean(url && publishable && secret);
}

/** Legacy env login when Supabase staff auth is not fully configured, or ADMIN_LEGACY_AUTH=true. */
export function isLegacyAdminAuthEnabled(): boolean {
  return readServerEnv("ADMIN_LEGACY_AUTH") === "true" || !hasSupabaseAdminEnvHints();
}

/** Prefer Supabase staff auth when fully configured (URL + publishable + secret). */
export function preferSupabaseAdminAuth(): boolean {
  return hasSupabaseAdminEnvHints();
}

/** Booleans only — never include secret values. For admin login diagnostics. */
export function getSupabaseAdminEnvDiagnostics(): {
  hasUrl: boolean;
  hasPublishable: boolean;
  hasSecret: boolean;
  supabaseEnabled: boolean;
  legacyEnabled: boolean;
} {
  ensureMonorepoEnvLoaded();
  const hasUrl = Boolean(
    readServerEnv("SUPABASE_URL") || readServerEnv("VITE_SUPABASE_URL"),
  );
  const hasPublishable = Boolean(
    readServerEnv("SUPABASE_PUBLISHABLE_KEY") ||
      readServerEnv("VITE_SUPABASE_PUBLISHABLE_KEY"),
  );
  const hasSecret = Boolean(readServerEnv("SUPABASE_SECRET_KEY"));
  return {
    hasUrl,
    hasPublishable,
    hasSecret,
    supabaseEnabled: hasUrl && hasPublishable && hasSecret,
    legacyEnabled: isLegacyAdminAuthEnabled(),
  };
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function encodeSession(principal: AdminPrincipal): string {
  const body = Buffer.from(
    JSON.stringify({
      u: principal.username,
      i: principal.loggedInAt,
      e: principal.loggedInAt + SESSION_TTL_MS,
      m: principal.mode,
      n: randomBytes(8).toString("hex"),
    }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeSession(token: string): AdminPrincipal | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = sign(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      u?: string;
      i?: number;
      e?: number;
      m?: AdminAuthMode;
    };
    if (!parsed.u || typeof parsed.i !== "number" || typeof parsed.e !== "number") return null;
    if (Date.now() > parsed.e) return null;
    return {
      username: parsed.u,
      loggedInAt: parsed.i,
      mode: parsed.m === "supabase" ? "supabase" : "legacy",
    };
  } catch {
    return null;
  }
}

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

export function issueAdminSessionCookie(principal: AdminPrincipal): void {
  try {
    setCookie(LEGACY_COOKIE_NAME, encodeSession(principal), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_MS / 1000,
      secure: cookieSecure(),
    });
  } catch (error) {
    console.error("[admin-auth] failed to set session cookie", error);
    throw new AdminAuthError(
      "Kon de admin-sessiecookie niet zetten. Herstart de admin-devserver en probeer opnieuw.",
    );
  }
}

/** Cookie name for legacy admin sessions — used by CMS Playwright storage-state bootstrap. */
export const ADMIN_LEGACY_COOKIE_NAME = LEGACY_COOKIE_NAME;

/**
 * Mint a legacy session token for trusted E2E bootstrap only.
 * Callers must set ADMIN_SESSION_SECRET to the same value as the admin server.
 */
export function mintLegacyAdminSessionToken(username: string): string {
  ensureMonorepoEnvLoaded();
  return encodeSession({
    username: username.trim().toLowerCase() || "admin",
    loggedInAt: Date.now(),
    mode: "legacy",
  });
}

export function clearAdminSessionCookie(): void {
  deleteCookie(LEGACY_COOKIE_NAME);
}

export function readAdminSessionFromCookie(): AdminPrincipal | null {
  const token = getCookie(LEGACY_COOKIE_NAME);
  if (!token) return null;
  return decodeSession(token);
}

export function issueSupabaseAuthCookies(tokens: {
  accessToken: string;
  refreshToken: string;
}): void {
  try {
    const secure = cookieSecure();
    setCookie(SB_ACCESS_COOKIE, tokens.accessToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SB_ACCESS_TTL_SEC,
      secure,
    });
    setCookie(SB_REFRESH_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: SB_REFRESH_TTL_SEC,
      secure,
    });
  } catch (error) {
    console.error("[admin-auth] failed to set Supabase auth cookies", error);
    throw new AdminAuthError(
      "Kon de sessiecookies niet zetten. Herstart de admin-devserver en probeer opnieuw.",
    );
  }
}

export function clearSupabaseAuthCookies(): void {
  deleteCookie(SB_ACCESS_COOKIE);
  deleteCookie(SB_REFRESH_COOKIE);
}

export function readSupabaseAccessToken(): string | null {
  return getCookie(SB_ACCESS_COOKIE) || null;
}

export function readSupabaseRefreshToken(): string | null {
  return getCookie(SB_REFRESH_COOKIE) || null;
}

export function clearAllAdminAuthCookies(): void {
  clearAdminSessionCookie();
  clearSupabaseAuthCookies();
}

/**
 * Legacy-only synchronous gate. Prefer `requireAdminSession` from `@mccoy/database/server`
 * which enforces Supabase staff identity when configured.
 */
export function requireLegacyAdminSession(): AdminPrincipal {
  const session = readAdminSessionFromCookie();
  if (!session || session.mode === "supabase") {
    throw new AdminAuthError("Niet geautoriseerd. Log opnieuw in.");
  }
  return session;
}

/** @deprecated Use async requireAdminSession from @mccoy/database/server. */
export function requireAdminSession(): AdminPrincipal {
  return requireLegacyAdminSession();
}

export class AdminAuthError extends Error {
  readonly code = "unauthorized" as const;
  constructor(message = "Niet geautoriseerd. Log opnieuw in.") {
    super(message);
    this.name = "AdminAuthError";
  }
}

export function assertAdminLoginRateLimit(key: string, limit = 10, windowMs = 60_000): void {
  try {
    assertRateLimit(
      `admin-login:${key}`,
      limit,
      windowMs,
      "Te veel inlogpogingen. Wacht even en probeer opnieuw.",
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw new AdminAuthError(error.message);
    }
    throw error;
  }
}

export function assertReplyRateLimit(username: string, limit = 20, windowMs = 60_000): void {
  try {
    assertRateLimit(
      `admin-reply:${username}`,
      limit,
      windowMs,
      "Te veel antwoorden. Wacht even en probeer opnieuw.",
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw new AdminAuthError(error.message);
    }
    throw error;
  }
}

export function assertInboxFetchRateLimit(username: string, limit = 30, windowMs = 60_000): void {
  try {
    assertRateLimit(
      `admin-inbox-fetch:${username}`,
      limit,
      windowMs,
      "Te veel mailbox-verzoeken. Wacht even en probeer opnieuw.",
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw new AdminAuthError(error.message);
    }
    throw error;
  }
}

export function assertContentAiRateLimit(username: string, limit = 20, windowMs = 60_000): void {
  try {
    assertRateLimit(
      `admin-content-ai:${username}`,
      limit,
      windowMs,
      "Te veel AI-verzoeken. Wacht even en probeer opnieuw.",
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw new AdminAuthError(error.message);
    }
    throw error;
  }
}

/** Sensitive staff account changes (email / password / profile). */
export function assertStaffAccountChangeRateLimit(userKey: string, limit = 8, windowMs = 60_000): void {
  try {
    assertRateLimit(
      `admin-staff-account:${userKey}`,
      limit,
      windowMs,
      "Te veel accountwijzigingen. Wacht even en probeer opnieuw.",
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw new AdminAuthError(error.message);
    }
    throw error;
  }
}

/** Super-admin inviting another admin. */
export function assertStaffInviteRateLimit(actorKey: string, limit = 8, windowMs = 60 * 60_000): void {
  try {
    assertRateLimit(
      `admin-staff-invite:${actorKey}`,
      limit,
      windowMs,
      "Te veel uitnodigingen. Wacht even en probeer opnieuw.",
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw new AdminAuthError(error.message);
    }
    throw error;
  }
}

/** Super-admin MFA account recovery for staff who lost their authenticator. */
export function assertStaffRecoveryRateLimit(actorKey: string, limit = 5, windowMs = 60 * 60_000): void {
  try {
    assertRateLimit(
      `admin-staff-recovery:${actorKey}`,
      limit,
      windowMs,
      "Te veel accountherstel-pogingen. Wacht even en probeer opnieuw.",
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw new AdminAuthError(error.message);
    }
    throw error;
  }
}

/** Invitee completing registration (password / name) after Auth invite. */
export function assertStaffInviteAcceptRateLimit(userKey: string, limit = 10, windowMs = 15 * 60_000): void {
  try {
    assertRateLimit(
      `admin-staff-invite-accept:${userKey}`,
      limit,
      windowMs,
      "Te veel pogingen. Wacht even en probeer opnieuw.",
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw new AdminAuthError(error.message);
    }
    throw error;
  }
}

/** Self-service staff password reset (login page). */
export function assertStaffPasswordResetRateLimit(emailKey: string, limit = 5, windowMs = 60 * 60_000): void {
  try {
    assertRateLimit(
      `admin-staff-password-reset:${emailKey}`,
      limit,
      windowMs,
      "Te veel wachtwoordreset-verzoeken. Wacht even en probeer opnieuw.",
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw new AdminAuthError(error.message);
    }
    throw error;
  }
}
