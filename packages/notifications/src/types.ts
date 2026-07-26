/**
 * Platform notification type vocabulary.
 * Active types have metadata allowlists + worker support.
 * Future placeholders are registered only until their domains exist.
 */

export const NOTIFICATION_TYPES = [
  // Active / Stage C–D
  "website_request.received",
  "website_request.reply_failed",
  "cms.publish_failed",
  "cms.publish_succeeded",
  "mailbox.connection_failed",
  "mailbox.connection_restored",
  "system.warning",
  // Future domain placeholders (Stage E)
  "user.registered",
  "user.approval_required",
  "company.registered",
  "product.low_stock",
  "product.out_of_stock",
  "order.created",
  "order.cancelled",
  "payment.completed",
  "payment.failed",
  "invoice.created",
  "invoice.overdue",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Types that have worker + metadata allowlists today. */
export const ACTIVE_NOTIFICATION_TYPES = [
  "website_request.received",
  "website_request.reply_failed",
  "cms.publish_failed",
  "cms.publish_succeeded",
  "mailbox.connection_failed",
  "mailbox.connection_restored",
  "system.warning",
] as const satisfies readonly NotificationType[];

export type ActiveNotificationType = (typeof ACTIVE_NOTIFICATION_TYPES)[number];

export const NOTIFICATION_SEVERITIES = [
  "info",
  "success",
  "warning",
  "error",
  "critical",
] as const;

export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[number];

export const NOTIFICATION_CATEGORIES = [
  "requests",
  "cms",
  "mailbox",
  "system",
  "users",
  "companies",
  "products",
  "orders",
  "payments",
  "invoices",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CHANNELS = ["in_app", "browser", "email"] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const RECIPIENT_RESOLVERS = [
  "active_staff",
  "actor_only",
  "future_company_users",
  "future_role_set",
  "future_inventory_staff",
  "future_finance_staff",
] as const;

export type RecipientResolver = (typeof RECIPIENT_RESOLVERS)[number];

export const DEDUPE_STRATEGIES = ["none", "dedupe_key"] as const;

export type DedupeStrategy = (typeof DEDUPE_STRATEGIES)[number];

export type NotificationDefinition = {
  type: NotificationType;
  severity: NotificationSeverity;
  category: NotificationCategory;
  recipientResolver: RecipientResolver;
  defaultChannels: readonly NotificationChannel[];
  dedupeStrategy: DedupeStrategy;
  /** Soft retention hint for workers / cleanup jobs. */
  expiresAfterDays?: number;
  /** False for future placeholders until the domain ships. */
  active: boolean;
};

export function isNotificationType(value: unknown): value is NotificationType {
  return (
    typeof value === "string" &&
    (NOTIFICATION_TYPES as readonly string[]).includes(value)
  );
}

export function isActiveNotificationType(
  value: unknown,
): value is ActiveNotificationType {
  return (
    typeof value === "string" &&
    (ACTIVE_NOTIFICATION_TYPES as readonly string[]).includes(value)
  );
}
