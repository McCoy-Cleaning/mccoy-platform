import type {
  ActiveNotificationType,
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
} from "@mccoy/notifications";

/**
 * Allowlisted metadata leaf values (see `@mccoy/notifications` metadata
 * schemas) — always JSON-serializable primitives, never `unknown`, so
 * TanStack Start server functions can prove the response is serializable.
 */
export type NotificationMetadataValue = string | number | boolean | null;

/**
 * Browser-safe notification centre DTO. Server functions return exactly this
 * shape (see `@/lib/api/notifications.functions`) — never the raw DB row.
 */
export type AdminNotificationItem = {
  recipientId: string;
  notificationId: string;
  type: NotificationType | string;
  category: NotificationCategory | string;
  severity: NotificationSeverity | string;
  title: string;
  body: string | null;
  destinationPath: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, NotificationMetadataValue>;
  seenAt: string | null;
  readAt: string | null;
  openedAt: string | null;
  dismissedAt: string | null;
  createdAt: string;
};

/** Effective in-app/browser preference for one implemented notification type. */
export type AdminNotificationPreference = {
  type: ActiveNotificationType;
  category: NotificationCategory | string;
  inAppEnabled: boolean;
  browserEnabled: boolean;
};

export type NotificationServiceStatus = "idle" | "loading" | "ready" | "error";

export type NotificationServiceState = {
  status: NotificationServiceStatus;
  items: AdminNotificationItem[];
  unreadCount: number;
  error: string | null;
};
