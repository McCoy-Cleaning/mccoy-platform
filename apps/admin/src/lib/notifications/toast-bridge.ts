import { notifyToast } from "@/lib/notify-toast";
import { subscribePlatformEvents } from "@/lib/platform-events";

let bridged = false;

/**
 * Forwards `ui-toast` platform events to the Sonner toaster. Kept separate
 * from `NotificationService` so the service stays UI-library agnostic and
 * other future emitters (not just notifications) can reuse the same channel.
 * Idempotent — safe to call from every module/component that needs toasts.
 */
export function ensurePlatformToastBridge(): void {
  if (bridged) return;
  bridged = true;
  subscribePlatformEvents((event) => {
    if (event.type !== "ui-toast") return;
    notifyToast({
      kind: event.kind,
      title: event.title,
      description: event.description,
      dedupeKey: event.dedupeKey,
    });
  });
}
