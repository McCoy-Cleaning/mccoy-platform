import type {
  ActiveNotificationType,
  NotificationCategory,
  NotificationSeverity,
  NotificationType,
} from "@mccoy/notifications";

/** Row shapes for public notification tables (snake_case as stored). */

export type NotificationRow = {
  id: string;
  type: string;
  category: string;
  severity: string;
  title: string;
  body: string | null;
  destination_path: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  dedupe_key: string | null;
  actor_user_id: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationRecipientRow = {
  id: string;
  notification_id: string;
  user_id: string;
  seen_at: string | null;
  read_at: string | null;
  opened_at: string | null;
  dismissed_at: string | null;
  browser_notified_at: string | null;
  email_notified_at: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationPreferenceRow = {
  id: string;
  user_id: string;
  notification_type: string;
  in_app_enabled: boolean;
  browser_enabled: boolean;
  email_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type NotificationOutboxRow = {
  id: string;
  type: string;
  payload: NotificationOutboxPayload;
  dedupe_key: string | null;
  actor_user_id: string | null;
  created_at: string;
  processed_at: string | null;
  failed_at: string | null;
  attempts: number;
  last_error: string | null;
};

/** Payload written to notification_outbox by domain transactions. */
export type NotificationOutboxPayload = {
  title: string;
  body?: string | null;
  destinationPath?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export type EnqueueNotificationOutboxInput = {
  type: NotificationType;
  title: string;
  body?: string | null;
  destinationPath?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  dedupeKey?: string | null;
  actorUserId?: string | null;
};

export type EnqueueNotificationOutboxResult = {
  id: string;
  inserted: boolean;
};

export type NotificationListItem = {
  recipientId: string;
  notificationId: string;
  userId: string;
  type: NotificationType | string;
  category: NotificationCategory | string;
  severity: NotificationSeverity | string;
  title: string;
  body: string | null;
  destinationPath: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  dedupeKey: string | null;
  seenAt: string | null;
  readAt: string | null;
  openedAt: string | null;
  dismissedAt: string | null;
  browserNotifiedAt: string | null;
  emailNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListNotificationsForUserFilter = {
  category?: string;
  unreadOnly?: boolean;
  limit?: number;
  beforeCreatedAt?: string;
};

export type NotificationPreferenceChannel = "in_app" | "browser";

/** Effective per-type preference (stored override merged over registry defaults). */
export type NotificationPreferenceView = {
  type: ActiveNotificationType;
  category: NotificationCategory | string;
  inAppEnabled: boolean;
  browserEnabled: boolean;
};

export type ProcessNotificationOutboxResult = {
  processed: number;
  failed: number;
  skipped: number;
};
