export type {
  NotificationRow,
  NotificationRecipientRow,
  NotificationPreferenceRow,
  NotificationOutboxRow,
  NotificationOutboxPayload,
  EnqueueNotificationOutboxInput,
  EnqueueNotificationOutboxResult,
  NotificationListItem,
  ListNotificationsForUserFilter,
  ProcessNotificationOutboxResult,
  NotificationPreferenceChannel,
  NotificationPreferenceView,
} from "./types";

export {
  enqueueNotificationOutbox,
  listUnprocessedNotificationOutbox,
  markNotificationOutboxProcessed,
  markNotificationOutboxFailed,
} from "./outbox";

export { processNotificationOutbox } from "./worker";

export {
  listForUser,
  unreadCount,
  markRead,
  markAllRead,
  dismiss,
  markOpened,
} from "./queries";

export {
  listNotificationPreferencesForUser,
  setNotificationPreference,
} from "./preferences";
