/**
 * Internal admin routes that a notification is allowed to deep-link to.
 * Mirrors `ADMIN_NAV` in `@/routes/_app` plus `/settings`, kept as a
 * separate literal list to avoid a route ↔ notification module import cycle.
 */
const ADMIN_DESTINATION_ALLOWLIST = [
  "/",
  "/website",
  "/inquiries",
  "/users",
  "/products",
  "/settings",
] as const;

const FALLBACK_DESTINATION = "/";

const INBOX_MESSAGE_ID_RE =
  /^(imap:[^:]+:\d+|graph:[^:]+:.+|req:[^:]+:.+|e2e:[^:]+:.+)$/;
const REQUEST_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Drop legacy `/admin` prefix from stored notification destinations. */
export function rewriteLegacyAdminDestination(path: string): string {
  if (path === "/admin") return "/";
  if (path.startsWith("/admin?")) return `/${path.slice("/admin".length)}`;
  if (path.startsWith("/admin/")) return path.slice("/admin".length) || "/";
  return path;
}

/**
 * `destination_path` is written by trusted server workers (see the
 * notification metadata allowlists in `@mccoy/notifications`), but we never
 * navigate on unchecked server data — re-validate against the admin route
 * allowlist here as defence in depth before the client ever calls `navigate`.
 */
export function resolveAdminNotificationDestination(path: string | null | undefined): string {
  if (!path) return FALLBACK_DESTINATION;
  const normalized = rewriteLegacyAdminDestination(path);
  const isAllowed = ADMIN_DESTINATION_ALLOWLIST.some(
    (allowed) =>
      normalized === allowed ||
      (allowed !== "/" &&
        (normalized.startsWith(`${allowed}/`) || normalized.startsWith(`${allowed}?`))) ||
      (allowed === "/" && (normalized === "/" || normalized.startsWith("/?"))),
  );
  return isAllowed ? normalized : FALLBACK_DESTINATION;
}

/**
 * Build Aanvragen deep link from notification metadata / entity refs.
 * Legacy rows only have destination `/admin/inquiries` + requestId in metadata.
 */
export function resolveInquiryNotificationHref(options: {
  type?: string | null;
  destinationPath?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
  encodeRequestMessageId: (requestId: string) => string;
}): string {
  const meta = options.metadata ?? {};
  const inboxMessageId =
    typeof meta.inboxMessageId === "string" ? meta.inboxMessageId.trim() : "";
  if (inboxMessageId && INBOX_MESSAGE_ID_RE.test(inboxMessageId)) {
    return resolveAdminNotificationDestination(
      `/inquiries?id=${encodeURIComponent(inboxMessageId)}`,
    );
  }

  const requestIdRaw =
    (typeof meta.requestId === "string" && meta.requestId.trim()) ||
    (options.entityType === "website_request" && typeof options.entityId === "string"
      ? options.entityId.trim()
      : "");
  const isRequestNotification =
    options.type === "website_request.received" ||
    options.type === "website_request.applicant_replied" ||
    options.type === "website_request.reply_failed";

  if (isRequestNotification && requestIdRaw && REQUEST_UUID_RE.test(requestIdRaw)) {
    const inboxId = options.encodeRequestMessageId(requestIdRaw);
    return resolveAdminNotificationDestination(
      `/inquiries?id=${encodeURIComponent(inboxId)}`,
    );
  }

  return resolveAdminNotificationDestination(options.destinationPath ?? null);
}

/** Browser-safe encoder matching `@mccoy/email` `encodeRequestMessageId` default mailbox. */
export function encodeWebsiteRequestInboxId(requestId: string): string {
  return `req:${encodeURIComponent("website-requests")}:${encodeURIComponent(requestId)}`;
}
