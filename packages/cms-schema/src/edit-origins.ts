/**
 * Cross-origin helpers for admin ↔ storefront postMessage.
 * Local pairs: dev 5173↔5174, production preview 4173↔4174.
 * Never use targetOrigin "*" — always enumerate concrete origins.
 */

/** Local sibling port pairs (storefront ↔ admin). */
const LOCAL_SIBLING_PORTS: Readonly<Record<string, string>> = {
  "5173": "5174",
  "5174": "5173",
  "4173": "4174",
  "4174": "4173",
};

function normalizeOrigin(value: string): string {
  return value.replace(/\/$/, "");
}

/** Support comma-separated VITE_ADMIN_ORIGIN / frame-ancestor lists. */
function originsFromEnvList(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[\s,]+/)
    .map((v) => normalizeOrigin(v.trim()))
    .filter(Boolean);
}

function addSiblingLocalPort(origins: Set<string>, currentOrigin: string) {
  try {
    const u = new URL(currentOrigin);
    const siblingPort = u.port ? LOCAL_SIBLING_PORTS[u.port] : undefined;
    if (siblingPort) {
      origins.add(`${u.protocol}//${u.hostname}:${siblingPort}`);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Origins the storefront iframe may postMessage *to* (admin parent windows).
 */
export function resolveAdminParentOrigins(input: {
  currentOrigin: string;
  envAdminOrigin?: string | null;
  referrer?: string | null;
  /** Chrome: parent browsing-context origins when embedded in an iframe. */
  ancestorOrigins?: ArrayLike<string> | null;
}): string[] {
  const origins = new Set<string>();
  for (const o of originsFromEnvList(input.envAdminOrigin)) origins.add(o);
  addSiblingLocalPort(origins, input.currentOrigin);
  if (input.referrer) {
    try {
      origins.add(new URL(input.referrer).origin);
    } catch {
      /* ignore */
    }
  }
  if (input.ancestorOrigins) {
    for (let i = 0; i < input.ancestorOrigins.length; i++) {
      const raw = input.ancestorOrigins[i];
      if (typeof raw === "string" && raw) origins.add(normalizeOrigin(raw));
    }
  }
  // Same-origin embedding (tests / unified host)
  origins.add(normalizeOrigin(input.currentOrigin));
  return [...origins];
}

/**
 * True for Vercel *deployment* hosts (`…-eringkpn6-….vercel.app`), not stable
 * branch aliases (`…-git-development-….vercel.app`).
 */
export function isEphemeralVercelDeploymentOrigin(origin: string): boolean {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (!host.endsWith(".vercel.app")) return false;
    if (host.includes("-git-")) return false;
    // project-<deploymentId>-team.vercel.app
    return /-[a-z0-9]{6,}-[a-z0-9-]+\.vercel\.app$/i.test(host);
  } catch {
    return false;
  }
}

/**
 * Origins the admin parent accepts messages *from* (storefront iframe).
 */
export function resolveStorefrontChildOrigins(input: {
  currentOrigin: string;
  envStorefrontOrigin?: string | null;
}): string[] {
  const origins = new Set<string>();
  for (const o of originsFromEnvList(input.envStorefrontOrigin)) origins.add(o);
  addSiblingLocalPort(origins, input.currentOrigin);
  origins.add(normalizeOrigin(input.currentOrigin));
  return [...origins];
}

/**
 * Origins the storefront accepts messages *from* (admin parent).
 */
export function resolveAdminChildOrigins(input: {
  currentOrigin: string;
  envAdminOrigin?: string | null;
  referrer?: string | null;
}): string[] {
  return resolveAdminParentOrigins(input);
}
