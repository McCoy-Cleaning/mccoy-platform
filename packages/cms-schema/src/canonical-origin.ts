/**
 * Canonical public origin helpers — leaf module (no cms-schema value deps).
 * Keep this file free of imports from resolve / content / business-nap so
 * NAP + head builders can share origin without circular graphs.
 */

export const CANONICAL_SITE_ORIGIN = "https://www.mccoy.nl";

const PREVIEW_HOST_RE =
  /(^|\.)localhost$|(^|\.)local$|\.vercel\.app$|\.now\.sh$|^127\.0\.0\.1$|^0\.0\.0\.0$|^::1$/i;

/**
 * Fail-closed: preview/dev/admin hosts never become the public canonical origin.
 */
export function resolveCanonicalOrigin(candidate?: string | null): string {
  if (!candidate) return CANONICAL_SITE_ORIGIN;
  try {
    const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" && url.protocol !== "http:") return CANONICAL_SITE_ORIGIN;
    if (PREVIEW_HOST_RE.test(host)) return CANONICAL_SITE_ORIGIN;
    if (host === "admin.mccoy.nl") return CANONICAL_SITE_ORIGIN;
    if (host === "www.mccoy.nl" || host === "mccoy.nl") return CANONICAL_SITE_ORIGIN;
    return CANONICAL_SITE_ORIGIN;
  } catch {
    return CANONICAL_SITE_ORIGIN;
  }
}

/** Absolute public URL for a path on the canonical host. */
export function absoluteCanonicalUrl(pathname: string, origin = CANONICAL_SITE_ORIGIN): string {
  const base = resolveCanonicalOrigin(origin).replace(/\/+$/, "");
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (path === "/") return base;
  return `${base}${path.replace(/\/+$/, "")}`;
}
