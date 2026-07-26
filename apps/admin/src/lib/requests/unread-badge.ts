/**
 * Aanvragen nav badge signal — unread notifications in category `requests`.
 * Minimal pub/sub so admin.inquiries.tsx can tell the shell nav to refetch the
 * count after marking notifications read, without a full NotificationService
 * (not built yet — see docs/architecture/platform-notification-system.md).
 */
type Listener = () => void;

const listeners = new Set<Listener>();

export function refreshAdminRequestsUnreadBadge(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error("[requests-unread-badge] listener failed", error);
    }
  }
}

export function subscribeAdminRequestsUnreadBadge(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
