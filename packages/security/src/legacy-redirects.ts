/**
 * Phase 2 SEO — legacy marketing URL map (301/410).
 *
 * Pure helpers: no network. Compose with host/slash rules for one-hop
 * Location construction toward https://www.mccoy.nl{path}.
 *
 * Does not redirect unrelated 404s. Identity aliases (/producten, /jobs, …)
 * stay in cms-schema / $customSlug.
 */

import { CANONICAL_PUBLIC_HOST, stripTrailingSlashPath } from "./host";

/** Paths with no genuine successor — real HTTP 410 Gone. */
export const LEGACY_GONE_PATHS: ReadonlySet<string> = new Set([
  "/ultrasoon",
  "/actie",
]);

/**
 * Slashless legacy path → canonical public path (NL identity, no /en).
 * Trailing-slash variants resolve via stripTrailingSlashPath first.
 */
export const LEGACY_PERMANENT_REDIRECTS: Readonly<Record<string, string>> = {
  "/cleaning": "/services",
  "/over-ons": "/about",
  "/collegas-gezocht": "/vacatures",
  "/solliciteer-direct": "/vacatures",
  "/privacybeleid": "/privacy",
};

export type LegacyUrlDecision =
  | { kind: "gone"; status: 410 }
  | { kind: "redirect"; status: 301; toPath: string };

export type LegacyHttpAction =
  | { kind: "gone"; status: 410 }
  | { kind: "redirect"; status: 301; location: string };

function stripPort(host: string): string {
  return host.split(":")[0]?.toLowerCase() ?? host.toLowerCase();
}

function isLocalHost(host: string): boolean {
  const h = stripPort(host);
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".localhost");
}

/**
 * Map a request pathname to a legacy decision (slash-insensitive).
 * Returns null for unknown paths — callers must not invent home redirects.
 */
export function resolveLegacyUrlDecision(
  pathname: string,
): LegacyUrlDecision | null {
  const path = stripTrailingSlashPath(pathname || "/");
  if (LEGACY_GONE_PATHS.has(path)) {
    return { kind: "gone", status: 410 };
  }
  const toPath = LEGACY_PERMANENT_REDIRECTS[path];
  if (toPath) {
    return { kind: "redirect", status: 301, toPath };
  }
  return null;
}

/**
 * Build Location for a legacy permanent redirect.
 * On known public / apex hosts (or when enforceCanonicalHost), use absolute
 * https://www.mccoy.nl{toPath}{search} so apex+https+slash+legacy stay one hop.
 * On localhost / preview, use a relative Location so we never mint preview hosts
 * as canonical.
 */
export function buildLegacyRedirectLocation(options: {
  toPath: string;
  search?: string;
  host?: string;
  /** Force absolute www Location (e.g. production-like tests). */
  enforceCanonicalHost?: boolean;
}): string {
  const search = options.search ?? "";
  const toPath = options.toPath.startsWith("/") ? options.toPath : `/${options.toPath}`;
  const host = stripPort(options.host ?? "");

  // Absolute only for production public hosts — never mint preview/admin as canonical.
  const useAbsolute =
    options.enforceCanonicalHost === true ||
    host === "mccoy.nl" ||
    host === CANONICAL_PUBLIC_HOST;

  if (useAbsolute && !isLocalHost(host)) {
    return `https://${CANONICAL_PUBLIC_HOST}${toPath}${search}`;
  }
  return `${toPath}${search}`;
}

/**
 * Full HTTP action for middleware: 410 or 301 with Location.
 * Applies slash normalize before the map so `/ultrasoon/` is Gone in one response
 * (no slash-strip hop that would soft-404).
 */
export function resolveLegacyHttpAction(options: {
  pathname: string;
  search?: string;
  host?: string;
  enforceCanonicalHost?: boolean;
}): LegacyHttpAction | null {
  const decision = resolveLegacyUrlDecision(options.pathname);
  if (!decision) return null;
  if (decision.kind === "gone") {
    return { kind: "gone", status: 410 };
  }
  return {
    kind: "redirect",
    status: 301,
    location: buildLegacyRedirectLocation({
      toPath: decision.toPath,
      search: options.search,
      host: options.host,
      enforceCanonicalHost: options.enforceCanonicalHost,
    }),
  };
}
