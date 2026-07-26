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

export type HostSurface = "admin" | "public" | "shared";

export function resolveHostSurface(hostHeader: string | undefined): HostSurface {
  const { adminHosts, publicHosts, enforce } = getHostConfig();
  const host = stripPort(hostHeader ?? "");

  if (!host) return "shared";
  if (isLocalHost(host) && enforce !== "strict") return "shared";

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

/**
 * @param app - Which app is handling the request.
 *              Dedicated apps only redirect away from foreign surfaces.
 *              `"combined"` remains for legacy/tests; prefer `"storefront"` | `"admin"`.
 */
export function shouldRedirectForHost(options: {
  host: string | undefined;
  pathname: string;
  protocol?: string;
  app?: "storefront" | "admin" | "combined";
}): { redirectTo: string } | null {
  const surface = resolveHostSurface(options.host);
  const pathname = options.pathname || "/";
  if (isInfrastructurePath(pathname)) return null;

  const app = options.app ?? "combined";
  const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
  const { adminHosts, publicHosts } = getHostConfig();
  const protocol = options.protocol === "http" ? "http" : "https";
  const adminHost = adminHosts[0] ?? "admin.mccoy.nl";
  const publicHost = publicHosts[0] ?? "www.mccoy.nl";

  if (app === "storefront") {
    // Storefront never serves /admin*; send browsers to the admin host.
    if (isAdminPath) {
      return { redirectTo: `${protocol}://${adminHost}${pathname}` };
    }
    if (surface === "admin") {
      return { redirectTo: `${protocol}://${adminHost}/admin` };
    }
    return null;
  }

  if (app === "admin") {
    // Dedicated admin app: keep traffic on /admin* paths.
    if (surface === "public" && !isLocalHost(options.host ?? "")) {
      return { redirectTo: `${protocol}://${publicHost}/` };
    }
    if (!isAdminPath && pathname !== "/") {
      // Allow root → /admin convenience redirect.
      if (pathname === "/" || pathname === "") {
        return { redirectTo: "/admin" };
      }
    }
    if (pathname === "/" || pathname === "") {
      return { redirectTo: "/admin" };
    }
    return null;
  }

  // Combined (legacy) — both route trees in one process.
  if (surface === "admin" && !isAdminPath) {
    return { redirectTo: "/admin" };
  }

  if (surface === "public" && isAdminPath) {
    return { redirectTo: `${protocol}://${adminHost}${pathname}` };
  }

  return null;
}
