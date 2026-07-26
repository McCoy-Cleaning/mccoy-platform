/**
 * Server entry for `@mccoy/notifications/server`.
 * Registry + metadata validation for trusted workers and use cases.
 * Never import privileged database clients from this package.
 */

export {
  NOTIFICATION_TYPES,
  ACTIVE_NOTIFICATION_TYPES,
  NOTIFICATION_SEVERITIES,
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  RECIPIENT_RESOLVERS,
  DEDUPE_STRATEGIES,
  isNotificationType,
  isActiveNotificationType,
  type NotificationType,
  type ActiveNotificationType,
  type NotificationSeverity,
  type NotificationCategory,
  type NotificationChannel,
  type RecipientResolver,
  type DedupeStrategy,
  type NotificationDefinition,
} from "./types";

export {
  NOTIFICATION_REGISTRY,
  getNotificationDefinition,
  assertNotificationRegistryComplete,
  listActiveNotificationDefinitions,
} from "./registry";

export {
  websiteRequestReceivedMetadataSchema,
  websiteRequestReplyFailedMetadataSchema,
  cmsPublishFailedMetadataSchema,
  cmsPublishSucceededMetadataSchema,
  mailboxConnectionFailedMetadataSchema,
  mailboxConnectionRestoredMetadataSchema,
  systemWarningMetadataSchema,
  notificationDestinationPathSchema,
  ACTIVE_NOTIFICATION_METADATA_SCHEMAS,
  parseNotificationMetadata,
  type NotificationMetadataByType,
  type ParseNotificationMetadataResult,
} from "./metadata";
