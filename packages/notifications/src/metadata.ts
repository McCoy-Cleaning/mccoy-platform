import { z } from "zod";

import type { ActiveNotificationType, NotificationType } from "./types";
import { isActiveNotificationType } from "./types";

/** Safe UUID refs only — never embed PII or message bodies. */
const uuidSchema = z.string().uuid();
const shortCodeSchema = z.string().trim().min(1).max(64);
const shortLabelSchema = z.string().trim().min(1).max(120);
const pathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^\/[A-Za-z0-9/_-]*(?:\?[A-Za-z0-9_.=%:-]*)?$/);

export const websiteRequestReceivedMetadataSchema = z
  .object({
    requestId: uuidSchema,
    requestNumber: shortLabelSchema.optional(),
    kind: shortCodeSchema.optional(),
  })
  .strict();

export const websiteRequestReplyFailedMetadataSchema = z
  .object({
    requestId: uuidSchema,
    errorCode: shortCodeSchema.optional(),
  })
  .strict();

export const websiteRequestApplicantRepliedMetadataSchema = z
  .object({
    requestId: uuidSchema,
    requestNumber: shortLabelSchema.optional(),
    submitterName: shortLabelSchema.optional(),
    /** Encoded inbox id (`req:…`) for deep-link open — not stored in destination_path. */
    inboxMessageId: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .regex(/^(imap:[^:]+:\d+|graph:[^:]+:.+|req:[^:]+:.+|e2e:[^:]+:.+)$/),
  })
  .strict();

export const cmsPublishFailedMetadataSchema = z
  .object({
    pageId: uuidSchema,
    attemptId: shortLabelSchema.optional(),
    pageKey: shortCodeSchema.optional(),
  })
  .strict();

export const cmsPublishSucceededMetadataSchema = z
  .object({
    pageId: uuidSchema,
    pageKey: shortCodeSchema.optional(),
    revisionId: uuidSchema.optional(),
  })
  .strict();

export const mailboxConnectionFailedMetadataSchema = z
  .object({
    provider: z.enum(["graph", "imap", "smtp"]).optional(),
    errorCode: shortCodeSchema.optional(),
  })
  .strict();

export const mailboxConnectionRestoredMetadataSchema = z
  .object({
    provider: z.enum(["graph", "imap", "smtp"]).optional(),
  })
  .strict();

export const systemWarningMetadataSchema = z
  .object({
    code: shortCodeSchema,
    detail: shortLabelSchema.optional(),
  })
  .strict();

/** Allowlisted destination paths for in-app deep links (admin-relative). */
export const notificationDestinationPathSchema = pathSchema;

export const ACTIVE_NOTIFICATION_METADATA_SCHEMAS = {
  "website_request.received": websiteRequestReceivedMetadataSchema,
  "website_request.reply_failed": websiteRequestReplyFailedMetadataSchema,
  "website_request.applicant_replied": websiteRequestApplicantRepliedMetadataSchema,
  "cms.publish_failed": cmsPublishFailedMetadataSchema,
  "cms.publish_succeeded": cmsPublishSucceededMetadataSchema,
  "mailbox.connection_failed": mailboxConnectionFailedMetadataSchema,
  "mailbox.connection_restored": mailboxConnectionRestoredMetadataSchema,
  "system.warning": systemWarningMetadataSchema,
} as const satisfies Record<ActiveNotificationType, z.ZodTypeAny>;

export type NotificationMetadataByType = {
  [K in ActiveNotificationType]: z.infer<
    (typeof ACTIVE_NOTIFICATION_METADATA_SCHEMAS)[K]
  >;
};

export type ParseNotificationMetadataResult =
  | { ok: true; metadata: Record<string, unknown> }
  | { ok: false; error: string };

/**
 * Validate metadata against the active-type allowlist.
 * Rejects unknown keys and inactive / unknown types.
 */
export function parseNotificationMetadata(
  type: NotificationType | string,
  metadata: unknown,
): ParseNotificationMetadataResult {
  if (!isActiveNotificationType(type)) {
    return {
      ok: false,
      error: `notification metadata schema not active for type: ${String(type)}`,
    };
  }

  const schema = ACTIVE_NOTIFICATION_METADATA_SCHEMAS[type];
  const parsed = schema.safeParse(metadata ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues.map((i) => i.message).join("; ") || "invalid metadata",
    };
  }

  return { ok: true, metadata: parsed.data as Record<string, unknown> };
}
