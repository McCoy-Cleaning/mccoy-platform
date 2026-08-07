import { getRequestHeader, getRequestUrl } from "@tanstack/react-start/server";

import { AdminAuthError } from "./session";

function normalizeOrigin(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return `${url.protocol}//${url.host}`.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * CSRF / same-origin gate for cookie-authenticated Admin mutations that return tokens.
 * Relies on Origin (preferred) or Sec-Fetch-Site; never trusts client-supplied booleans.
 */
export function assertAdminSameOriginMutation(): void {
  const originHeader = getRequestHeader("origin");
  const secFetchSite = (getRequestHeader("sec-fetch-site") || "").toLowerCase();

  if (secFetchSite === "cross-site") {
    throw new AdminAuthError("Ongeldige herkomst voor dit verzoek.");
  }

  if (originHeader) {
    const requestOrigin = normalizeOrigin(originHeader);
    if (!requestOrigin) {
      throw new AdminAuthError("Ongeldige herkomst voor dit verzoek.");
    }
    try {
      const expected = normalizeOrigin(getRequestUrl().origin);
      if (!expected || requestOrigin !== expected) {
        throw new AdminAuthError("Ongeldige herkomst voor dit verzoek.");
      }
    } catch (error) {
      if (error instanceof AdminAuthError) throw error;
      throw new AdminAuthError("Ongeldige herkomst voor dit verzoek.");
    }
    return;
  }

  // Same-origin XHR/fetch from some agents may omit Origin; allow same-origin Sec-Fetch-Site.
  if (secFetchSite === "same-origin" || secFetchSite === "same-site" || secFetchSite === "none") {
    return;
  }

  throw new AdminAuthError("Ongeldige herkomst voor dit verzoek.");
}
