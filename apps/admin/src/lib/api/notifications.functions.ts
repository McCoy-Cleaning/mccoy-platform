import { createServerFn } from "@tanstack/react-start";

import {
  dismissNotification,
  listNotificationPreferencesForUser,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationOpened,
  markNotificationRead,
  notificationUnreadCount,
  requireAdminSession,
  setNotificationPreference,
  type NotificationListItem,
  type NotificationPreferenceView,
} from "@mccoy/database/server";
import { AdminAuthError } from "@mccoy/security";
import {
  notificationIdSchema,
  notificationListSchema,
  notificationPreferenceUpdateSchema,
} from "@mccoy/validation";

import { resolveAdminNotificationDestination } from "@/lib/notifications/destinations";
import type { AdminNotificationItem, AdminNotificationPreference } from "@/lib/notifications/types";

function authErrorResult(error: unknown) {
  if (error instanceof AdminAuthError) {
    return { ok: false as const, error: error.message, code: error.code };
  }
  throw error;
}

/**
 * Staff notification centre requires a stable Supabase user id. Legacy
 * (non-Supabase) admin sessions have no `userId` and get no notifications
 * rather than a confusing partial experience.
 */
async function requireNotifiableStaffSession(): Promise<{ userId: string; username: string }> {
  const session = await requireAdminSession();
  if (!session.userId) {
    throw new AdminAuthError("Meldingen zijn niet beschikbaar voor deze inlogmethode.");
  }
  return { userId: session.userId, username: session.username };
}

function toClientPreference(item: NotificationPreferenceView): AdminNotificationPreference {
  return {
    type: item.type,
    category: item.category,
    inAppEnabled: item.inAppEnabled,
    browserEnabled: item.browserEnabled,
  };
}

function toClientNotification(item: NotificationListItem): AdminNotificationItem {
  return {
    recipientId: item.recipientId,
    notificationId: item.notificationId,
    type: item.type,
    category: item.category,
    severity: item.severity,
    title: item.title,
    body: item.body,
    destinationPath: item.destinationPath,
    entityType: item.entityType,
    entityId: item.entityId,
    // Safe cast: written through parseNotificationMetadata's strict allowlist
    // schemas (@mccoy/notifications), which only ever accept JSON primitives.
    metadata: item.metadata as AdminNotificationItem["metadata"],
    seenAt: item.seenAt,
    readAt: item.readAt,
    openedAt: item.openedAt,
    dismissedAt: item.dismissedAt,
    createdAt: item.createdAt,
  };
}

export const listAdminNotifications = createServerFn({ method: "POST" })
  .validator(notificationListSchema)
  .handler(async ({ data }) => {
    try {
      const { userId } = await requireNotifiableStaffSession();
      const [items, unreadCount] = await Promise.all([
        listNotificationsForUser(userId, data),
        notificationUnreadCount(userId),
      ]);
      return {
        ok: true as const,
        items: items.map(toClientNotification),
        unreadCount,
      };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const markAdminNotificationRead = createServerFn({ method: "POST" })
  .validator(notificationIdSchema)
  .handler(async ({ data }) => {
    try {
      const { userId } = await requireNotifiableStaffSession();
      await markNotificationRead(userId, data.notificationId);
      return { ok: true as const };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const markAllAdminNotificationsRead = createServerFn({ method: "POST" }).handler(
  async () => {
    try {
      const { userId } = await requireNotifiableStaffSession();
      const count = await markAllNotificationsRead(userId);
      return { ok: true as const, count };
    } catch (error) {
      return authErrorResult(error);
    }
  },
);

export const dismissAdminNotification = createServerFn({ method: "POST" })
  .validator(notificationIdSchema)
  .handler(async ({ data }) => {
    try {
      const { userId } = await requireNotifiableStaffSession();
      await dismissNotification(userId, data.notificationId);
      return { ok: true as const };
    } catch (error) {
      return authErrorResult(error);
    }
  });

/** Marks a notification opened (implies read) and returns an allowlisted destination. */
export const openAdminNotification = createServerFn({ method: "POST" })
  .validator(notificationIdSchema)
  .handler(async ({ data }) => {
    try {
      const { userId } = await requireNotifiableStaffSession();
      const items = await listNotificationsForUser(userId, { limit: 100 });
      const match = items.find((item) => item.notificationId === data.notificationId);
      await markNotificationOpened(userId, data.notificationId);
      return {
        ok: true as const,
        destinationPath: resolveAdminNotificationDestination(match?.destinationPath ?? null),
      };
    } catch (error) {
      return authErrorResult(error);
    }
  });

/** In-app/browser channel toggles for implemented notification types only. */
export const listAdminNotificationPreferences = createServerFn({ method: "POST" }).handler(
  async () => {
    try {
      const { userId } = await requireNotifiableStaffSession();
      const preferences = await listNotificationPreferencesForUser(userId);
      return { ok: true as const, preferences: preferences.map(toClientPreference) };
    } catch (error) {
      return authErrorResult(error);
    }
  },
);

export const updateAdminNotificationPreference = createServerFn({ method: "POST" })
  .validator(notificationPreferenceUpdateSchema)
  .handler(async ({ data }) => {
    try {
      const { userId } = await requireNotifiableStaffSession();
      const preference = await setNotificationPreference(
        userId,
        data.type,
        data.channel,
        data.enabled,
      );
      return { ok: true as const, preference: toClientPreference(preference) };
    } catch (error) {
      return authErrorResult(error);
    }
  });
