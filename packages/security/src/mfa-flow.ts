import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import process from "node:process";

import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { readServerEnv } from "./env";
import { ensureMonorepoEnvLoaded } from "./load-monorepo-env.server";

/** Explicit MFA browser purposes — never accept arbitrary strings. */
export const ADMIN_MFA_BROWSER_PURPOSES = [
  "mfa_setup",
  "mfa_challenge",
  "authenticator_replace",
] as const;

export type AdminMfaBrowserPurpose = (typeof ADMIN_MFA_BROWSER_PURPOSES)[number];

export const MFA_FLOW_COOKIE_NAME = "mccoy_admin_mfa_flow";
const MFA_FLOW_TTL_SEC = 10 * 60;

export type AdminMfaFlowCapability = {
  userId: string;
  sessionId: string | null;
  purpose: AdminMfaBrowserPurpose;
  expiresAt: number;
  nonce: string;
};

function getSessionSecret(): string {
  ensureMonorepoEnvLoaded();
  const secret = readServerEnv("ADMIN_SESSION_SECRET");
  if (secret) return secret;
  return "mccoy-dev-admin-session-secret-change-me";
}

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production";
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function isAdminMfaBrowserPurpose(value: unknown): value is AdminMfaBrowserPurpose {
  return (
    typeof value === "string" &&
    (ADMIN_MFA_BROWSER_PURPOSES as readonly string[]).includes(value)
  );
}

function encodeFlow(capability: AdminMfaFlowCapability): string {
  const body = Buffer.from(
    JSON.stringify({
      u: capability.userId,
      s: capability.sessionId,
      p: capability.purpose,
      e: capability.expiresAt,
      n: capability.nonce,
    }),
  ).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeFlow(token: string): AdminMfaFlowCapability | null {
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
      s?: string | null;
      p?: string;
      e?: number;
      n?: string;
    };
    if (!parsed.u || typeof parsed.e !== "number" || !parsed.n) return null;
    if (!isAdminMfaBrowserPurpose(parsed.p)) return null;
    if (Date.now() > parsed.e) return null;
    return {
      userId: parsed.u,
      sessionId: typeof parsed.s === "string" && parsed.s ? parsed.s : null,
      purpose: parsed.p,
      expiresAt: parsed.e,
      nonce: parsed.n,
    };
  } catch {
    return null;
  }
}

/** Issue short-lived HttpOnly MFA-flow capability (never embeds Supabase refresh token). */
export function issueAdminMfaFlowCookie(input: {
  userId: string;
  sessionId?: string | null;
  purpose: AdminMfaBrowserPurpose;
}): AdminMfaFlowCapability {
  if (!isAdminMfaBrowserPurpose(input.purpose)) {
    throw new Error("Ongeldig MFA-doel.");
  }
  const capability: AdminMfaFlowCapability = {
    userId: input.userId,
    sessionId: input.sessionId ?? null,
    purpose: input.purpose,
    expiresAt: Date.now() + MFA_FLOW_TTL_SEC * 1000,
    nonce: randomBytes(12).toString("hex"),
  };
  setCookie(MFA_FLOW_COOKIE_NAME, encodeFlow(capability), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MFA_FLOW_TTL_SEC,
    secure: cookieSecure(),
  });
  return capability;
}

export function readAdminMfaFlowCookie(): AdminMfaFlowCapability | null {
  const raw = getCookie(MFA_FLOW_COOKIE_NAME);
  if (!raw) return null;
  return decodeFlow(raw);
}

export function clearAdminMfaFlowCookie(): void {
  deleteCookie(MFA_FLOW_COOKIE_NAME);
}

/** Cookie attribute contract for security tests (no live Set-Cookie parsing). */
export function getAdminAuthCookieAttributeContract(): {
  accessToken: {
    name: string;
    httpOnly: true;
    sameSite: "lax";
    path: "/";
    secureInProduction: true;
  };
  refreshToken: {
    name: string;
    httpOnly: true;
    sameSite: "lax";
    path: "/";
    secureInProduction: true;
  };
  mfaFlow: {
    name: string;
    httpOnly: true;
    sameSite: "lax";
    path: "/";
    secureInProduction: true;
    maxAgeSec: number;
  };
} {
  return {
    accessToken: {
      name: "mccoy_sb_access_token",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secureInProduction: true,
    },
    refreshToken: {
      name: "mccoy_sb_refresh_token",
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secureInProduction: true,
    },
    mfaFlow: {
      name: MFA_FLOW_COOKIE_NAME,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secureInProduction: true,
      maxAgeSec: MFA_FLOW_TTL_SEC,
    },
  };
}
