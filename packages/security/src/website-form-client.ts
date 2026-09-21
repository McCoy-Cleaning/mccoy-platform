import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { getRequestHeader } from "@tanstack/react-start/server";

import { isProductionRuntime, readServerEnv } from "./env";

const DEV_ABUSE_SECRET = "mccoy-dev-website-form-abuse-key";

function firstForwardedAddress(raw: string | undefined): string {
  return (raw ?? "").split(",", 1)[0]?.trim() ?? "";
}

/** Return only a syntactically valid IP address; never persist raw header data. */
export function normalizeWebsiteFormClientIp(raw: string | undefined): string | null {
  const candidate = firstForwardedAddress(raw).replace(/^\[|\]$/g, "");
  return isIP(candidate) ? candidate.toLowerCase() : null;
}

function websiteFormAbuseSecret(): string {
  const dedicatedSecret = readServerEnv("WEBSITE_FORM_ABUSE_SECRET");
  if (dedicatedSecret.length >= 32) return dedicatedSecret;
  if (isProductionRuntime()) {
    throw new Error("Website form abuse-protection secret is missing or too short.");
  }
  return readServerEnv("ADMIN_SESSION_SECRET") || DEV_ABUSE_SECRET;
}

/** HMACs the client address so abuse tables never contain raw IP addresses. */
export function hashWebsiteFormClientKey(rawClientAddress: string): string {
  return createHmac("sha256", websiteFormAbuseSecret())
    .update(`website-form:${rawClientAddress}`, "utf8")
    .digest("hex");
}

/**
 * Vercel overwrites x-vercel-forwarded-for, making it the trusted production
 * source. Other production proxies must opt in explicitly after being audited.
 */
export function getWebsiteFormClientKeyHash(): string {
  const onVercel = Boolean(readServerEnv("VERCEL") || getRequestHeader("x-vercel-id"));
  const trustProxy = readServerEnv("MCCOY_TRUST_PROXY_IP_HEADERS") === "true";
  const raw = onVercel
    ? getRequestHeader("x-vercel-forwarded-for")
    : !isProductionRuntime() || trustProxy
      ? getRequestHeader("x-real-ip") || getRequestHeader("x-forwarded-for")
      : undefined;
  const address = normalizeWebsiteFormClientIp(raw) ?? "unidentified-client";
  return hashWebsiteFormClientKey(address);
}
