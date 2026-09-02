/**
 * Customer portal HttpOnly session cookies — namespaced separately from admin auth.
 */
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { ensureMonorepoEnvLoaded } from "./load-monorepo-env.server";

const CUSTOMER_SB_ACCESS = "mccoy_customer_sb_access_token";
const CUSTOMER_SB_REFRESH = "mccoy_customer_sb_refresh_token";

const SB_ACCESS_TTL_SEC = 60 * 60;
const SB_REFRESH_TTL_SEC = 60 * 60 * 24 * 7;

export class CustomerAuthError extends Error {
  readonly code: string;

  constructor(message: string, code = "customer_auth") {
    super(message);
    this.name = "CustomerAuthError";
    this.code = code;
  }
}

function cookieSecure(): boolean {
  ensureMonorepoEnvLoaded();
  if (process.env.NODE_ENV !== "production") return false;
  return process.env.COOKIE_SECURE !== "false";
}

export function issueCustomerAuthCookies(tokens: {
  accessToken: string;
  refreshToken: string;
}): void {
  const secure = cookieSecure();
  setCookie(CUSTOMER_SB_ACCESS, tokens.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SB_ACCESS_TTL_SEC,
    secure,
  });
  setCookie(CUSTOMER_SB_REFRESH, tokens.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SB_REFRESH_TTL_SEC,
    secure,
  });
}

export function clearCustomerAuthCookies(): void {
  try {
    deleteCookie(CUSTOMER_SB_ACCESS);
    deleteCookie(CUSTOMER_SB_REFRESH);
  } catch {
    // Outside an active HTTP request (tests, workers).
  }
}

export function readCustomerAccessToken(): string | null {
  return getCookie(CUSTOMER_SB_ACCESS) || null;
}

export function readCustomerRefreshToken(): string | null {
  return getCookie(CUSTOMER_SB_REFRESH) || null;
}

export const CUSTOMER_LOGIN_RATE = {
  windowMs: 15 * 60 * 1000,
  maxAttempts: 10,
  keyPrefix: "customer-login",
} as const;

export const CUSTOMER_FORGOT_PASSWORD_RATE = {
  windowMs: 60 * 60 * 1000,
  maxAttempts: 5,
  keyPrefix: "customer-forgot",
} as const;

export const CUSTOMER_ACTIVATION_RATE = {
  windowMs: 15 * 60 * 1000,
  maxAttempts: 15,
  keyPrefix: "customer-activate",
} as const;

export const CUSTOMER_INVITE_RATE = {
  windowMs: 60 * 60 * 1000,
  maxAttempts: 20,
  keyPrefix: "customer-invite",
} as const;
