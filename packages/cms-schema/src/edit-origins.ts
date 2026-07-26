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
}): string[] {
  const origins = new Set<string>();
  if (input.envAdminOrigin) origins.add(normalizeOrigin(input.envAdminOrigin));
  addSiblingLocalPort(origins, input.currentOrigin);
  if (input.referrer) {
    try {
      origins.add(new URL(input.referrer).origin);
    } catch {
      /* ignore */
    }
  }
  // Same-origin embedding (tests / unified host)
  origins.add(normalizeOrigin(input.currentOrigin));
  return [...origins];
}

/**
 * Origins the admin parent accepts messages *from* (storefront iframe).
 */
export function resolveStorefrontChildOrigins(input: {
  currentOrigin: string;
  envStorefrontOrigin?: string | null;
}): string[] {
  const origins = new Set<string>();
  if (input.envStorefrontOrigin) origins.add(normalizeOrigin(input.envStorefrontOrigin));
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
