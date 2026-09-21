import type { NotificationType } from "@mccoy/notifications";

import type {
  ListNotificationsForUserFilter,
  NotificationListItem,
  NotificationRecipientRow,
  NotificationRow,
} from "./types";
import { createSupabaseServiceClient } from "../supabase";

type JoinedRecipientRow = NotificationRecipientRow & {
  notifications: NotificationRow | NotificationRow[] | null;
};

function asNotificationRow(
  value: NotificationRow | NotificationRow[] | null,
): NotificationRow | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function mapListItem(row: JoinedRecipientRow): NotificationListItem | null {
  const notification = asNotificationRow(row.notifications);
  if (!notification) return null;

  return {
    recipientId: row.id,
    notificationId: notification.id,
    userId: row.user_id,
    type: notification.type as NotificationType | string,
    category: notification.category,
    severity: notification.severity,
    title: notification.title,
    body: notification.body,
    destinationPath: notification.destination_path,
    entityType: notification.entity_type,
    entityId: notification.entity_id,
    metadata: (notification.metadata ?? {}) as Record<string, unknown>,
    dedupeKey: notification.dedupe_key,
    seenAt: row.seen_at,
    readAt: row.read_at,
    openedAt: row.opened_at,
    dismissedAt: row.dismissed_at,
    browserNotifiedAt: row.browser_notified_at,
    emailNotifiedAt: row.email_notified_at,
    createdAt: notification.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * List notifications for a user (service client; caller must authorize userId).
 */
export async function listForUser(
  userId: string,
  filter: ListNotificationsForUserFilter = {},
): Promise<NotificationListItem[]> {
  const supabase = createSupabaseServiceClient();
  const limit = Math.max(1, Math.min(filter.limit ?? 50, 100));

  let query = supabase
    .from("notification_recipients")
    .select(
      `
      id,
      notification_id,
      user_id,
      seen_at,
      read_at,
      opened_at,
      dismissed_at,
      browser_notified_at,
      email_notified_at,
      created_at,
      updated_at,
      notifications${filter.category ? "!inner" : ""} (
        id,
        type,
        category,
        severity,
        title,
        body,
        destination_path,
        entity_type,
        entity_id,
        metadata,
        dedupe_key,
        actor_user_id,
        expires_at,
        created_at,
        updated_at
      )
    `,
    )
    .eq("user_id", userId)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (filter.category) {
    query = query.eq("notifications.category", filter.category);
  }

  if (filter.unreadOnly) {
    query = query.is("read_at", null);
  }

  if (filter.beforeCreatedAt) {
    query = query.lt("created_at", filter.beforeCreatedAt);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`listForUser failed: ${error.message}`);
  }

  return ((data as JoinedRecipientRow[] | null) ?? [])
    .map(mapListItem)
    .filter((item): item is NotificationListItem => item != null);
}

export async function unreadCount(userId: string, category?: string): Promise<number> {
  const supabase = createSupabaseServiceClient();

  let query = supabase
    .from("notification_recipients")
    .select(category ? "id, notifications!inner(category)" : "id", {
      count: "exact",
      head: true,
    })
    .eq("user_id", userId)
    .is("read_at", null)
    .is("dismissed_at", null);

  if (category) {
    query = query.eq("notifications.category", category);
  }

  const { count, error } = await query;
  if (error) {
    throw new Error(`unreadCount failed: ${error.message}`);
  }
  return count ?? 0;
}

type NotificationEntityRelation =
  { entity_id?: string | null } | Array<{ entity_id?: string | null }> | null;

/**
 * Per-user unread state for a bounded set of domain entities.
 *
 * The inquiry list uses this instead of deriving "unread" from a shared
 * workflow status. Requests are chunked to keep PostgREST URLs bounded.
 */
export async function listUnreadEntityIdsForUser(
  userId: string,
  entityType: string,
  entityIds: string[],
): Promise<string[]> {
  const type = entityType.trim();
  const ids = [...new Set(entityIds.map((id) => id.trim()).filter(Boolean))];
  if (!userId.trim() || !type || ids.length === 0) return [];

  const supabase = createSupabaseServiceClient();
  const unread = new Set<string>();
  const chunkSize = 50;

  for (let offset = 0; offset < ids.length; offset += chunkSize) {
    const chunk = ids.slice(offset, offset + chunkSize);
    const { data, error } = await supabase
      .from("notification_recipients")
      .select("notifications!inner(entity_id)")
      .eq("user_id", userId)
      .is("read_at", null)
      .is("dismissed_at", null)
      .eq("notifications.entity_type", type)
      .in("notifications.entity_id", chunk);

    if (error) {
      throw new Error(`listUnreadEntityIdsForUser failed: ${error.message}`);
    }

    for (const row of (data as Array<{ notifications: NotificationEntityRelation }> | null) ?? []) {
      const relation = Array.isArray(row.notifications) ? row.notifications[0] : row.notifications;
      const entityId = relation?.entity_id?.trim();
      if (entityId) unread.add(entityId);
    }
  }

  return [...unread];
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("notification_recipients")
    .update({
      read_at: now,
      seen_at: now,
    })
    .eq("user_id", userId)
    .eq("notification_id", notificationId)
    .is("read_at", null);

  if (error) {
    throw new Error(`markRead failed: ${error.message}`);
  }
}

export async function markAllRead(userId: string, category?: string): Promise<number> {
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();

  let query = supabase
    .from("notification_recipients")
    .update({
      read_at: now,
      seen_at: now,
    })
    .eq("user_id", userId)
    .is("read_at", null)
    .is("dismissed_at", null);

  if (category) {
    query = query.eq("notifications.category", category);
  }

  const { data, error } = await query.select(category ? "id, notifications!inner(category)" : "id");

  if (error) {
    throw new Error(`markAllRead failed: ${error.message}`);
  }

  return data?.length ?? 0;
}

/**
 * Mark unread notifications for a specific entity (e.g. one website_request) as read.
 * Used when staff opens that Aanvraag — not when merely viewing the list.
 */
export async function markReadForEntity(
  userId: string,
  entityType: string,
  entityId: string,
): Promise<number> {
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();
  const type = entityType.trim();
  const id = entityId.trim();
  if (!type || !id) return 0;

  // Resolve notification ids first. Filtering a related table directly on a
  // mutation is provider-version-sensitive and previously allowed this update
  // to fail silently behind the detail screen's best-effort catch.
  const { data: notifications, error: notificationError } = await supabase
    .from("notifications")
    .select("id")
    .eq("entity_type", type)
    .eq("entity_id", id);

  if (notificationError) {
    throw new Error(`markReadForEntity lookup failed: ${notificationError.message}`);
  }

  const notificationIds = [
    ...new Set(
      ((notifications as Array<{ id?: string }> | null) ?? [])
        .map((row) => row.id?.trim())
        .filter((notificationId): notificationId is string => Boolean(notificationId)),
    ),
  ];
  if (notificationIds.length === 0) return 0;

  const { data, error } = await supabase
    .from("notification_recipients")
    .update({
      read_at: now,
      seen_at: now,
    })
    .eq("user_id", userId)
    .is("read_at", null)
    .is("dismissed_at", null)
    .in("notification_id", notificationIds)
    .select("id");

  if (error) {
    throw new Error(`markReadForEntity failed: ${error.message}`);
  }

  return data?.length ?? 0;
}

export async function dismiss(userId: string, notificationId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("notification_recipients")
    .update({
      dismissed_at: now,
      seen_at: now,
    })
    .eq("user_id", userId)
    .eq("notification_id", notificationId)
    .is("dismissed_at", null);

  if (error) {
    throw new Error(`dismiss failed: ${error.message}`);
  }
}

export async function markOpened(userId: string, notificationId: string): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const now = new Date().toISOString();

  const { data: current, error: readError } = await supabase
    .from("notification_recipients")
    .select("read_at, seen_at, opened_at")
    .eq("user_id", userId)
    .eq("notification_id", notificationId)
    .maybeSingle();

  if (readError) {
    throw new Error(`markOpened read failed: ${readError.message}`);
  }
  if (!current) return;

  const { error } = await supabase
    .from("notification_recipients")
    .update({
      opened_at: current.opened_at ?? now,
      seen_at: current.seen_at ?? now,
      read_at: current.read_at ?? now,
    })
    .eq("user_id", userId)
    .eq("notification_id", notificationId);

  if (error) {
    throw new Error(`markOpened failed: ${error.message}`);
  }
}
