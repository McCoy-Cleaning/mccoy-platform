/**
 * Host-based separation for the two product surfaces:
 *
 * - www / PUBLIC_HOST  → public storefront (apps/storefront)
 * - admin / ADMIN_HOST → admin panel (apps/admin)
 *
 * Localhost and 127.0.0.1 always allow both surfaces unless
 * HOST_ENFORCE=strict is set.
 *
 * Uses process.env only (no node:fs) so this module is safe if analyzed
 * alongside Start middleware. File-based .env fallback lives in env.ts.
 */

/** Production public canonical host (no protocol). */
export const CANONICAL_PUBLIC_HOST = "www.mccoy.nl";

function readHostEnv(name: string): string {
  try {
    return (typeof process !== "undefined" ? process.env[name] : undefined)?.trim() || "";
  } catch {
    return "";
  }
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

export function getHostConfig() {
  const adminHosts = parseList(readHostEnv("ADMIN_HOST") || "admin.mccoy.nl");
  const publicHosts = parseList(readHostEnv("PUBLIC_HOST") || "www.mccoy.nl,mccoy.nl");
  const enforce = (readHostEnv("HOST_ENFORCE") || "auto").toLowerCase();
  return { adminHosts, publicHosts, enforce };
}

function stripPort(host: string): string {
  return host.split(":")[0]?.toLowerCase() ?? host.toLowerCase();
}

function isLocalHost(host: string): boolean {
  const h = stripPort(host);
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".localhost");
}

/** Vercel preview / deployment hosts — never force-canonical to production. */
function isVercelPreviewHost(host: string): boolean {
  return stripPort(host).endsWith(".vercel.app");
}

/** Strip trailing slash except for `/`. Aligns with normalizeCmsPath. */
export function stripTrailingSlashPath(pathname: string): string {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
}

export type HostSurface = "admin" | "public" | "shared";

export function resolveHostSurface(hostHeader: string | undefined): HostSurface {
  const { adminHosts, publicHosts, enforce } = getHostConfig();
  const host = stripPort(hostHeader ?? "");

  if (!host) return "shared";
  if (isLocalHost(host) && enforce !== "strict") return "shared";
  // Preview deployments (stable git URL and unique *-xxxxx-*.vercel.app) stay shared
  // so admin never 301s to www / admin.mccoy.nl and creates a bounce loop.
  if (isVercelPreviewHost(host)) return "shared";

  if (adminHosts.includes(host)) return "admin";
  if (publicHosts.includes(host)) return "public";

  return enforce === "strict" ? "public" : "shared";
}

function isInfrastructurePath(pathname: string): boolean {
  return (
    pathname.startsWith("/_serverFn") ||
    pathname.startsWith("/@") ||
    pathname.startsWith("/node_modules") ||
    pathname.startsWith("/.well-known")
  );
}

export type CanonicalHostRedirect = {
  redirectTo: string;
  status: 301;
  reason: "https" | "apex_to_www" | "trailing_slash" | "combined";
};

/**
 * SEO-4 — single-hop preference toward https://www.mccoy.nl + strip trailing slash.
 * Preserves query string. Skips localhost / preview / infrastructure paths.
 * Returns null when already canonical (no loop).
 */
export function resolveCanonicalHostRedirect(options: {
  host: string | undefined;
  pathname: string;
  search?: string;
  protocol?: string;
  /** When false, skip (local/dev). Default: enforce only for known public hosts. */
  enforce?: boolean;
}): CanonicalHostRedirect | null {
  const host = stripPort(options.host ?? "");
  if (!host || isLocalHost(host)) return null;
  if (isInfrastructurePath(options.pathname || "/")) return null;

  // Never rewrite admin host into www.
  const { adminHosts, publicHosts } = getHostConfig();
  if (adminHosts.includes(host)) return null;

  const isPublicHost = publicHosts.includes(host) || host === "mccoy.nl" || host === "www.mccoy.nl";
  if (!isPublicHost && options.enforce !== true) return null;

  const incomingProtocol = (options.protocol ?? "https").replace(":", "").toLowerCase();
  const pathname = options.pathname || "/";
  const normalizedPath = stripTrailingSlashPath(pathname);
  const search = options.search ?? "";

  const needsHttps = incomingProtocol === "http";
  // Apex is the only non-www public host we force to www.
  const apexToWww = host === "mccoy.nl";
  const needsSlash = normalizedPath !== pathname;

  if (!needsHttps && !apexToWww && !needsSlash) return null;

  const target = `https://${CANONICAL_PUBLIC_HOST}${normalizedPath === "/" ? "" : normalizedPath}${search}`;
  // Guard against self-redirect loops.
  if (
    !needsHttps &&
    host === CANONICAL_PUBLIC_HOST &&
    !needsSlash &&
    target === `https://${host}${pathname}${search}`
  ) {
    return null;
  }

  let reason: CanonicalHostRedirect["reason"] = "combined";
  if (needsHttps && apexToWww) reason = "combined";
  else if (needsHttps) reason = "https";
  else if (apexToWww) reason = "apex_to_www";
  else if (needsSlash) reason = "trailing_slash";

  return { redirectTo: target, status: 301, reason };
}

/** True for the legacy `/admin` path prefix (bookmarks and old email links). */
export function isAdminPathPrefix(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * Drop the legacy `/admin` prefix: `/admin` → `/`, `/admin/website` → `/website`.
 * Returns null when the path is not prefixed.
 */
export function dropAdminPathPrefix(pathname: string): string | null {
  if (!isAdminPathPrefix(pathname)) return null;
  if (pathname === "/admin" || pathname === "/admin/") return "/";
  return pathname.slice("/admin".length) || "/";
}

/**
 * @param app - Which app is handling the request.
 *              Dedicated apps only redirect away from foreign surfaces.
 *              `"combined"` remains for legacy/tests; prefer `"storefront"` | `"admin"`.
 */
export function shouldRedirectForHost(options: {
  host: string | undefined;
  pathname: string;
  protocol?: string;
  search?: string;
  app?: "storefront" | "admin" | "combined";
}): { redirectTo: string; status?: number } | null {
  const surface = resolveHostSurface(options.host);
  const pathname = options.pathname || "/";
  if (isInfrastructurePath(pathname)) return null;

  const app = options.app ?? "combined";
  const isAdminPath = isAdminPathPrefix(pathname);
  const { adminHosts, publicHosts } = getHostConfig();
  const protocol = options.protocol === "http" ? "http" : "https";
  const adminHost = adminHosts[0] ?? "admin.mccoy.nl";
  const publicHost = publicHosts[0] ?? "www.mccoy.nl";
  const search = options.search ?? "";
  const unprefixedPath = dropAdminPathPrefix(pathname) ?? pathname;
  const unprefixedLocation = `${unprefixedPath === "/" ? "/" : unprefixedPath}${search}`;

  if (app === "storefront") {
    // Prefer one-hop canonical host/slash before surface redirects.
    const canonical = resolveCanonicalHostRedirect({
      host: options.host,
      pathname,
      search: options.search,
      protocol: options.protocol,
    });
    if (canonical) {
      return { redirectTo: canonical.redirectTo, status: canonical.status };
    }

    // Storefront never serves /admin*; send browsers to the admin host (prefix dropped).
    if (isAdminPath) {
      return {
        redirectTo: `${protocol}://${adminHost}${unprefixedLocation}`,
        status: 301,
      };
    }
    if (surface === "admin") {
      return { redirectTo: `${protocol}://${adminHost}/` };
    }
    return null;
  }

  if (app === "admin") {
    if (surface === "public" && !isLocalHost(options.host ?? "")) {
      return { redirectTo: `${protocol}://${publicHost}/` };
    }
    // Bookmarks and old emails: /admin/website → /website (keep query).
    if (isAdminPath) {
      return { redirectTo: unprefixedLocation, status: 301 };
    }
    return null;
  }

  // Combined (legacy) — both route trees in one process.
  if (isAdminPath) {
    if (surface === "public") {
      return {
        redirectTo: `${protocol}://${adminHost}${unprefixedLocation}`,
        status: 301,
      };
    }
    return { redirectTo: unprefixedLocation, status: 301 };
  }

  return null;
}
