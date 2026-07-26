import {
  type NotificationDefinition,
  type NotificationType,
  NOTIFICATION_TYPES,
} from "./types";

const IN_APP_ONLY = ["in_app"] as const;
const IN_APP_BROWSER = ["in_app", "browser"] as const;

/**
 * Canonical notification registry. Workers must look up definitions here —
 * never trust client-supplied severity, category, or recipient sets.
 */
export const NOTIFICATION_REGISTRY: Record<
  NotificationType,
  NotificationDefinition
> = {
  "website_request.received": {
    type: "website_request.received",
    severity: "info",
    category: "requests",
    recipientResolver: "active_staff",
    defaultChannels: IN_APP_BROWSER,
    dedupeStrategy: "dedupe_key",
    expiresAfterDays: 90,
    active: true,
  },
  "website_request.reply_failed": {
    type: "website_request.reply_failed",
    severity: "error",
    category: "requests",
    recipientResolver: "active_staff",
    defaultChannels: IN_APP_BROWSER,
    dedupeStrategy: "dedupe_key",
    expiresAfterDays: 90,
    active: true,
  },
  "cms.publish_failed": {
    type: "cms.publish_failed",
    severity: "error",
    category: "cms",
    recipientResolver: "actor_only",
    defaultChannels: IN_APP_BROWSER,
    dedupeStrategy: "dedupe_key",
    expiresAfterDays: 30,
    active: true,
  },
  "cms.publish_succeeded": {
    type: "cms.publish_succeeded",
    severity: "success",
    category: "cms",
    recipientResolver: "actor_only",
    defaultChannels: IN_APP_ONLY,
    dedupeStrategy: "dedupe_key",
    expiresAfterDays: 14,
    active: true,
  },
  "mailbox.connection_failed": {
    type: "mailbox.connection_failed",
    severity: "warning",
    category: "mailbox",
    recipientResolver: "active_staff",
    defaultChannels: IN_APP_BROWSER,
    dedupeStrategy: "dedupe_key",
    expiresAfterDays: 30,
    active: true,
  },
  "mailbox.connection_restored": {
    type: "mailbox.connection_restored",
    severity: "info",
    category: "mailbox",
    recipientResolver: "active_staff",
    defaultChannels: IN_APP_ONLY,
    dedupeStrategy: "dedupe_key",
    expiresAfterDays: 14,
    active: true,
  },
  "system.warning": {
    type: "system.warning",
    severity: "warning",
    category: "system",
    recipientResolver: "active_staff",
    defaultChannels: IN_APP_BROWSER,
    dedupeStrategy: "dedupe_key",
    expiresAfterDays: 60,
    active: true,
  },
  "user.registered": {
    type: "user.registered",
    severity: "info",
    category: "users",
    recipientResolver: "future_role_set",
    defaultChannels: IN_APP_ONLY,
    dedupeStrategy: "dedupe_key",
    active: false,
  },
  "user.approval_required": {
    type: "user.approval_required",
    severity: "warning",
    category: "users",
    recipientResolver: "future_role_set",
    defaultChannels: IN_APP_BROWSER,
    dedupeStrategy: "dedupe_key",
    active: false,
  },
  "company.registered": {
    type: "company.registered",
    severity: "info",
    category: "companies",
    recipientResolver: "future_role_set",
    defaultChannels: IN_APP_ONLY,
    dedupeStrategy: "dedupe_key",
    active: false,
  },
  "product.low_stock": {
    type: "product.low_stock",
    severity: "warning",
    category: "products",
    recipientResolver: "future_inventory_staff",
    defaultChannels: IN_APP_BROWSER,
    dedupeStrategy: "dedupe_key",
    active: false,
  },
  "product.out_of_stock": {
    type: "product.out_of_stock",
    severity: "error",
    category: "products",
    recipientResolver: "future_inventory_staff",
    defaultChannels: IN_APP_BROWSER,
    dedupeStrategy: "dedupe_key",
    active: false,
  },
  "order.created": {
    type: "order.created",
    severity: "info",
    category: "orders",
    recipientResolver: "future_role_set",
    defaultChannels: IN_APP_ONLY,
    dedupeStrategy: "dedupe_key",
    active: false,
  },
  "order.cancelled": {
    type: "order.cancelled",
    severity: "warning",
    category: "orders",
    recipientResolver: "future_role_set",
    defaultChannels: IN_APP_BROWSER,
    dedupeStrategy: "dedupe_key",
    active: false,
  },
  "payment.completed": {
    type: "payment.completed",
    severity: "success",
    category: "payments",
    recipientResolver: "future_finance_staff",
    defaultChannels: IN_APP_ONLY,
    dedupeStrategy: "dedupe_key",
    active: false,
  },
  "payment.failed": {
    type: "payment.failed",
    severity: "error",
    category: "payments",
    recipientResolver: "future_finance_staff",
    defaultChannels: IN_APP_BROWSER,
    dedupeStrategy: "dedupe_key",
    active: false,
  },
  "invoice.created": {
    type: "invoice.created",
    severity: "info",
    category: "invoices",
    recipientResolver: "future_finance_staff",
    defaultChannels: IN_APP_ONLY,
    dedupeStrategy: "dedupe_key",
    active: false,
  },
  "invoice.overdue": {
    type: "invoice.overdue",
    severity: "warning",
    category: "invoices",
    recipientResolver: "future_finance_staff",
    defaultChannels: IN_APP_BROWSER,
    dedupeStrategy: "dedupe_key",
    active: false,
  },
};

export function getNotificationDefinition(
  type: NotificationType,
): NotificationDefinition {
  return NOTIFICATION_REGISTRY[type];
}

/** Assert every declared type has a registry entry (load-time / test helper). */
export function assertNotificationRegistryComplete(): void {
  for (const type of NOTIFICATION_TYPES) {
    if (!NOTIFICATION_REGISTRY[type]) {
      throw new Error(`Missing notification registry entry for ${type}`);
    }
    if (NOTIFICATION_REGISTRY[type].type !== type) {
      throw new Error(`Registry key/type mismatch for ${type}`);
    }
  }
}

export function listActiveNotificationDefinitions(): NotificationDefinition[] {
  return NOTIFICATION_TYPES.map((type) => NOTIFICATION_REGISTRY[type]).filter(
    (def) => def.active,
  );
}
