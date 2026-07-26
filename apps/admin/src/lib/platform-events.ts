type PlatformEvent =
  | { type: "notification-received"; notificationId: string }
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

export type { PlatformEvent };
