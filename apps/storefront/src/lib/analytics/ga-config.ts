/**
 * Google Analytics 4 (gtag) configuration helpers.
 * Measurement ID is public-ish but still supplied via env — never hardcode production IDs.
 */

const GA_MEASUREMENT_ID_RE = /^G-[A-Z0-9]+$/i;

export function parseGaMeasurementId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim();
  if (!GA_MEASUREMENT_ID_RE.test(id)) return null;
  return id.toUpperCase();
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

/** CMS admin bridge routes — do not prompt or load analytics. */
export function isAnalyticsExemptPath(pathname: string): boolean {
  return (
    pathname === "/cms-preview" ||
    pathname === "/cms-sync" ||
    pathname.startsWith("/cms-preview/") ||
    pathname.startsWith("/cms-sync/")
  );
}
