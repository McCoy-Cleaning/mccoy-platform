import * as React from "react";

import { useAdminSession } from "@/lib/admin-auth";

import { getAdminNotificationService } from "./notification-service";
import type { AdminNotificationItem, NotificationServiceState } from "./types";

const EMPTY_STATE: NotificationServiceState = {
  status: "idle",
  items: [],
  unreadCount: 0,
  error: null,
};

export type UseAdminNotifications = NotificationServiceState & {
  refresh: () => Promise<void>;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (notificationId: string) => Promise<void>;
  /** Marks opened + returns the allowlisted destination path to navigate to. */
  open: (notificationId: string) => Promise<string>;
};

/** Wires the admin notification centre UI to the per-user `NotificationService` singleton. */
export function useAdminNotifications(): UseAdminNotifications {
  const { session } = useAdminSession();
  const userId = session?.userId ?? null;
  const [state, setState] = React.useState<NotificationServiceState>(EMPTY_STATE);

  React.useEffect(() => {
    if (!userId) {
      setState(EMPTY_STATE);
      return;
    }
    const service = getAdminNotificationService(userId);
    const unsubscribe = service.subscribe(setState);
    service.start();
    return unsubscribe;
  }, [userId]);

  const refresh = React.useCallback(async (): Promise<void> => {
    if (!userId) return;
    await getAdminNotificationService(userId).refresh();
  }, [userId]);

  const markRead = React.useCallback(
    async (notificationId: string): Promise<void> => {
      if (!userId) return;
      await getAdminNotificationService(userId).markRead(notificationId);
    },
    [userId],
  );

  const markAllRead = React.useCallback(async (): Promise<void> => {
    if (!userId) return;
    await getAdminNotificationService(userId).markAllRead();
  }, [userId]);

  const dismiss = React.useCallback(
    async (notificationId: string): Promise<void> => {
      if (!userId) return;
      await getAdminNotificationService(userId).dismiss(notificationId);
    },
    [userId],
  );

  const open = React.useCallback(
    async (notificationId: string): Promise<string> => {
      if (!userId) return "/admin";
      return getAdminNotificationService(userId).open(notificationId);
    },
    [userId],
  );

  return { ...state, refresh, markRead, markAllRead, dismiss, open };
}

export type { AdminNotificationItem };
