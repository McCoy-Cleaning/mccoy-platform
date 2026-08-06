type PlatformEvent =
  | {
      type: "notification-received";
      notificationId: string;
      /** Allowlisted notification type, e.g. website_request.received */
      notificationType: string;
      /** Allowlisted category, e.g. requests */
      category: string;
    }
  | { type: "notification-read"; notificationId: string }
  | { type: "notification-refresh-failed"; errorCode: string }
  | { type: "notification-connection-restored" }
  | {
      type: "ui-toast";
      kind: "success" | "info" | "warning" | "error";
      title: string;
      description?: string;
      dedupeKey?: string;
    };

type Listener = (event: PlatformEvent) => void;

const listeners = new Set<Listener>();

export function emitPlatformEvent(event: PlatformEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error("[platform-events] listener failed", error);
    }
  }
}

export function subscribePlatformEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** True when Aanvragen list should refetch for this notification. */
export function shouldRefreshInquiriesForNotification(event: PlatformEvent): boolean {
  if (event.type !== "notification-received") return false;
  if (event.category === "requests") return true;
  return event.notificationType.startsWith("website_request.");
}

export type { PlatformEvent };
