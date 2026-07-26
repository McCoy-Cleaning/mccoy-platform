/**
 * Internal admin routes that a notification is allowed to deep-link to.
 * Mirrors `ADMIN_NAV` in `@/routes/admin` plus `/admin/settings`, kept as a
 * separate literal list to avoid a route ↔ notification module import cycle.
 */
const ADMIN_DESTINATION_ALLOWLIST = [
  "/admin",
  "/admin/website",
  "/admin/inquiries",
  "/admin/users",
  "/admin/products",
  "/admin/settings",
] as const;

const FALLBACK_DESTINATION = "/admin";

/**
 * `destination_path` is written by trusted server workers (see the
 * notification metadata allowlists in `@mccoy/notifications`), but we never
 * navigate on unchecked server data — re-validate against the admin route
 * allowlist here as defence in depth before the client ever calls `navigate`.
 */
export function resolveAdminNotificationDestination(path: string | null | undefined): string {
  if (!path) return FALLBACK_DESTINATION;
  const isAllowed = ADMIN_DESTINATION_ALLOWLIST.some(
    (allowed) => path === allowed || path.startsWith(`${allowed}/`),
  );
  return isAllowed ? path : FALLBACK_DESTINATION;
}
