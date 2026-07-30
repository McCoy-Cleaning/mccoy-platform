/**
 * Detect Auth invite/recovery callbacks that landed on the wrong path
 * (e.g. Site URL origin without /admin/invite → login shell).
 */

function readAuthCallbackType(url: URL): string | null {
  const fromQuery = url.searchParams.get("type");
  if (fromQuery) return fromQuery.toLowerCase();

  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const fromHash = params.get("type");
  return fromHash ? fromHash.toLowerCase() : null;
}

/** True when the current URL carries an invite or recovery Auth callback. */
export function isStaffInviteAuthCallback(locationLike: {
  pathname: string;
  search: string;
  hash: string;
  href?: string;
}): boolean {
  if (locationLike.pathname === "/admin/invite") return false;

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

  // PKCE invite sometimes only has ?code= after verify when type was dropped.
  // Only treat as invite callback when not already on login with a normal flow —
  // require access_token in hash or explicit type above. code alone is too broad.
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
  if (hash && new URLSearchParams(hash).has("access_token")) {
    return true;
  }

  return false;
}

/**
 * If Auth dumped the user on `/` or `/admin/login` with invite tokens,
 * hard-navigate to `/admin/invite` preserving query + hash (one-shot).
 */
export function redirectStaffInviteAuthCallbackIfNeeded(): boolean {
  if (typeof window === "undefined") return false;
  const { pathname, search, hash } = window.location;
  if (!isStaffInviteAuthCallback({ pathname, search, hash, href: window.location.href })) {
    return false;
  }
  const next = `/admin/invite${search}${hash}`;
  window.location.replace(next);
  return true;
}

// Run as early as this module loads so Auth hash tokens are not eaten on /admin/login first.
if (typeof window !== "undefined") {
  redirectStaffInviteAuthCallbackIfNeeded();
}
