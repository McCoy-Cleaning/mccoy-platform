/**
 * Google Analytics 4 (gtag) configuration helpers.
 * Measurement ID is public-ish but still supplied via env — never hardcode production IDs.
 */

import type { AnalyticsConsent } from "./consent";

const GA_MEASUREMENT_ID_RE = /^G-[A-Z0-9]+$/i;

export function parseGaMeasurementId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (!GA_MEASUREMENT_ID_RE.test(id)) return null;
  return id.toUpperCase();
}

/**
 * Resolve a public GA4 measurement ID from any supported alias.
 * Prefer VITE_ (build-time), then server-side names, then an SSR-injected value.
 */
export function resolvePublicGaMeasurementId(input: {
  viteMeasurementId?: unknown;
  gaMeasurementId?: unknown;
  googleAnalyticsMeasurementId?: unknown;
  injectedMeasurementId?: unknown;
}): string | null {
  return (
    parseGaMeasurementId(input.viteMeasurementId) ??
    parseGaMeasurementId(input.gaMeasurementId) ??
    parseGaMeasurementId(input.googleAnalyticsMeasurementId) ??
    parseGaMeasurementId(input.injectedMeasurementId)
  );
}

/**
 * Production-only by default. Set VITE_GA_ENABLE_DEV=1 to allow localhost / preview builds.
 */
export function isGoogleAnalyticsRuntimeAllowed(input: {
  isProd: boolean;
  enableDev: boolean;
}): boolean {
  return input.isProd || input.enableDev;
}

export function readGaEnableDevFlag(raw: unknown): boolean {
  if (typeof raw !== "string") return false;
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Whether to mount the consent banner (and consent state).
 *
 * - Offer when a valid measurement ID exists and runtime is allowed.
 * - enableDev without an ID: local/design preview only (never a fake production banner).
 */
export function shouldOfferAnalyticsConsent(input: {
  measurementId: string | null;
  isProd: boolean;
  enableDev: boolean;
}): boolean {
  if (input.measurementId) {
    return isGoogleAnalyticsRuntimeAllowed(input);
  }
  return !input.isProd && input.enableDev;
}

/** CMS admin bridge routes — do not prompt or load analytics. */
export function isAnalyticsExemptPath(pathname: string): boolean {
  return (
    pathname === "/cms-preview" ||
    pathname === "/cms-sync" ||
    pathname.startsWith("/cms-preview/") ||
    pathname.startsWith("/cms-sync/")
  );
}

/** Resolve the only state in which GA may initialize or emit a page view. */
export function resolveGoogleAnalyticsMeasurementId(input: {
  consent: AnalyticsConsent | null;
  rawMeasurementId: unknown;
  isProd: boolean;
  enableDev: boolean;
  pathname: string;
}): string | null {
  if (input.consent !== "granted") return null;
  if (isAnalyticsExemptPath(input.pathname)) return null;
  if (!isGoogleAnalyticsRuntimeAllowed(input)) return null;
  return parseGaMeasurementId(input.rawMeasurementId);
}
