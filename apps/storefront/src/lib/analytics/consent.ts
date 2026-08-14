/**
 * Analytics cookie consent — local preference only (not a first-party tracking cookie).
 * Google Analytics scripts must not load until consent === "granted".
 */

export const ANALYTICS_CONSENT_STORAGE_KEY = "mccoy-analytics-consent";

export type AnalyticsConsent = "granted" | "denied";

export function isAnalyticsConsent(value: unknown): value is AnalyticsConsent {
  return value === "granted" || value === "denied";
}

/** Read stored choice. Returns null when unset or unreadable. */
export function readAnalyticsConsent(): AnalyticsConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return isAnalyticsConsent(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function writeAnalyticsConsent(value: AnalyticsConsent): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, value);
  } catch {
    /* private mode / quota */
  }
}
