/**
 * Phase 5 — paths that must never appear in the public sitemap.
 */

import {
  PUBLIC_IDENTITY_PATH_ALIASES,
  stripLocalePrefix,
  CANONICAL_SITE_ORIGIN,
} from "@mccoy/cms-schema";
import {
  LEGACY_GONE_PATHS,
  LEGACY_PERMANENT_REDIRECTS,
  resolveLegacyUrlDecision,
  stripTrailingSlashPath,
} from "@mccoy/security";

/**
 * Static indexable landings that are not CMS pages (city SEO routes).
 * Always merged into the dynamic sitemap after CMS entries.
 */
export const STATIC_INDEXABLE_SITEMAP_PATHS = [
  "/schoonmaakbedrijf-enschede",
  "/schoonmaakbedrijf-hengelo",
] as const;

export function staticIndexableSitemapEntries(origin = CANONICAL_SITE_ORIGIN): Array<{
  loc: string;
  lastmod?: string;
  alternates: Array<{ locale: string; url: string }>;
}> {
  const base = origin.replace(/\/+$/, "");
  return STATIC_INDEXABLE_SITEMAP_PATHS.map((path) => {
    const loc = `${base}${path}`;
    return {
      loc,
      alternates: [
        { locale: "nl", url: loc },
        { locale: "x-default", url: loc },
      ],
    };
  });
}

/**
 * Paths that must never appear in the sitemap (legacy 301/410, identity aliases,
 * CMS preview surfaces). Includes trailing-slash variants of slashless identities.
 */
export function forbiddenSitemapPathnames(): string[] {
  const bases = new Set<string>([
    ...LEGACY_GONE_PATHS,
    ...Object.keys(LEGACY_PERMANENT_REDIRECTS),
    ...Object.keys(PUBLIC_IDENTITY_PATH_ALIASES),
    "/cms-preview",
    "/cms-sync",
  ]);
  const out: string[] = [];
  for (const path of bases) {
    out.push(path);
    if (path !== "/" && !path.endsWith("/")) out.push(`${path}/`);
  }
  return out;
}

/** True when a public pathname must be excluded from sitemap emission. */
export function isSitemapExcludedPathname(pathname: string): boolean {
  const path = stripTrailingSlashPath(pathname || "/");
  if (resolveLegacyUrlDecision(path)) return true;
  if (path === "/cms-preview" || path.startsWith("/cms-preview/")) return true;
  if (path === "/cms-sync" || path.startsWith("/cms-sync/")) return true;
  const { path: identity } = stripLocalePrefix(path);
  if (PUBLIC_IDENTITY_PATH_ALIASES[identity]) return true;
  return false;
}
