/**
 * Detect Auth invite/recovery callbacks that landed on the wrong path
 * (e.g. Site URL origin without /invite → login shell).
 */

const AUTH_SHELL_PATHS = new Set([
  "/invite",
  "/recover-mfa",
  "/mfa",
]);

function readAuthCallbackType(url: URL): string | null {
  const fromQuery = url.searchParams.get("type");
  if (fromQuery) return fromQuery.toLowerCase();

  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const fromHash = params.get("type");
  return fromHash ? fromHash.toLowerCase() : null;
}

/** Read invite/recovery type from the current browser URL (query or hash). */
export function readStaffAuthCallbackTypeFromLocation(
  locationLike: Pick<Location, "search" | "hash"> & { href?: string },
): string | null {
  try {
    const url = new URL(
      locationLike.href ??
        `${typeof window !== "undefined" ? window.location.origin : "http://localhost"}${typeof window !== "undefined" ? window.location.pathname : ""}${locationLike.search}${locationLike.hash}`,
    );
    return readAuthCallbackType(url);
  } catch {
    return null;
  }
}

/** Strip Auth hash/query tokens after the browser session is established. */
export function clearStaffInviteAuthCallbackFromUrl(): void {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  if (url.hash) {
    url.hash = "";
    changed = true;
  }
  for (const key of ["code", "type", "token", "token_hash", "error", "error_description"]) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }
}

/** True when the current URL carries an invite or recovery Auth callback. */
export function isStaffInviteAuthCallback(locationLike: {
  pathname: string;
  search: string;
  hash: string;
  href?: string;
}): boolean {
  // Never yank the user off MFA / invite / login mid-flow when tokens linger in the hash.
  if (AUTH_SHELL_PATHS.has(locationLike.pathname)) return false;

  let url: URL;
  try {
    url = new URL(
      locationLike.href ??
        `${typeof window !== "undefined" ? window.location.origin : "http://localhost"}${locationLike.pathname}${locationLike.search}${locationLike.hash}`,
    );
  } catch {
    return false;
  }

  const type = readAuthCallbackType(url);
  if (type === "invite" || type === "recovery" || type === "signup" || type === "magiclink") {
    return true;
  }

  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  if (hash && new URLSearchParams(hash).has("access_token")) {
    return true;
  }

  return false;
}

/**
 * If Auth dumped the user on `/` or a non-auth path with invite tokens,
 * hard-navigate to `/invite` preserving query + hash (one-shot).
 */
export function redirectStaffInviteAuthCallbackIfNeeded(): boolean {
  if (typeof window === "undefined") return false;
  const { pathname, search, hash } = window.location;
  if (!isStaffInviteAuthCallback({ pathname, search, hash, href: window.location.href })) {
    return false;
  }
  const next = `/invite${search}${hash}`;
  window.location.replace(next);
  return true;
}

// Run as early as this module loads so Auth hash tokens are not eaten on `/` first.
if (typeof window !== "undefined") {
  redirectStaffInviteAuthCallbackIfNeeded();
}
