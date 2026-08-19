/**
 * Analytics cookie consent — first-party preference (cookie + localStorage).
 * Google Analytics scripts must not load until consent === "granted".
 */

export const ANALYTICS_CONSENT_STORAGE_KEY = "mccoy-analytics-consent";
export const ANALYTICS_CONSENT_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 365;

export type AnalyticsConsent = "granted" | "denied";

export function isAnalyticsConsent(value: unknown): value is AnalyticsConsent {
  return value === "granted" || value === "denied";
}

export function parseAnalyticsConsentFromCookie(cookieHeader: string | undefined | null): AnalyticsConsent | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const name = trimmed.slice(0, eq).trim();
    if (name !== ANALYTICS_CONSENT_STORAGE_KEY) continue;
    const raw = decodeCookieValue(trimmed.slice(eq + 1).trim());
    return isAnalyticsConsent(raw) ? raw : null;
  }
  return null;
}

function decodeCookieValue(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function readConsentFromLocalStorage(): AnalyticsConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return isAnalyticsConsent(raw) ? raw : null;
  } catch {
    return null;
  }
}

function readConsentFromDocumentCookie(): AnalyticsConsent | null {
  if (typeof document === "undefined") return null;
  try {
    return parseAnalyticsConsentFromCookie(document.cookie);
  } catch {
    return null;
  }
}

/** Read stored choice. localStorage first, then first-party cookie. */
export function readAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") return readConsentFromDocumentCookie();
  return readConsentFromLocalStorage() ?? readConsentFromDocumentCookie();
}

export function writeAnalyticsConsent(value: AnalyticsConsent): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, value);
  } catch {
    /* private mode / quota */
  }
  try {
    const secure =
      typeof window.location !== "undefined" && window.location.protocol === "https:"
        ? "; Secure"
        : "";
    document.cookie = `${ANALYTICS_CONSENT_STORAGE_KEY}=${value}; Path=/; Max-Age=${ANALYTICS_CONSENT_COOKIE_MAX_AGE_SEC}; SameSite=Lax${secure}`;
  } catch {
    /* cookie blocked */
  }
}

/**
 * Client remount/effect: keep an explicit Accept/Reject. Only adopt storage
 * when still undecided. A stale SSR isomorphic snapshot (`null`) must not
 * reopen the banner after the visitor chose.
 */
export function retainExplicitAnalyticsConsent(
  prev: AnalyticsConsent | null,
  stored: AnalyticsConsent | null,
): AnalyticsConsent | null {
  return prev ?? stored;
}

/** Banner is offered only until a choice exists (and the route is ready / not exempt). */
export function isCookieConsentBannerOpen(input: {
  exempt: boolean;
  ready: boolean;
  consent: AnalyticsConsent | null;
}): boolean {
  return !input.exempt && input.ready && input.consent === null;
}
