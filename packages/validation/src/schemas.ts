import { z } from "zod";
import {
  FORM_KINDS,
  FORM_SCOPE_KEY_PATTERN,
  FORM_SCOPE_LABEL_MAX,
  REQUEST_STATUSES,
  STAFF_PASSWORD_MAX_LENGTH,
  staffPasswordStrengthError,
} from "@mccoy/domain";
import { ACTIVE_NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES } from "@mccoy/notifications";

/** Strong staff password (min 10, upper + lower + digit). */
export const staffPasswordSchema = z
  .string()
  .max(STAFF_PASSWORD_MAX_LENGTH)
  .superRefine((value, ctx) => {
    const message = staffPasswordStrengthError(value);
    if (message) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    }
  });

export const formAttachmentSchema = z.object({
  filename: z.string().min(1).max(180),
  contentBase64: z.string().min(1).max(7_000_000),
  contentType: z.string().min(1).max(120),
});

export const formScopeSnapshotSchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(FORM_SCOPE_KEY_PATTERN)
    .max(64),
  label: z.string().trim().min(1).max(FORM_SCOPE_LABEL_MAX),
});

export const websiteFormPayloadSchema = z.object({
  kind: z.enum(FORM_KINDS),
  pageId: z.string().trim().min(1).max(120),
  sourceId: z.string().trim().min(1).max(120),
  fields: z.record(z.string().max(2000)).default({}),
  attachments: z.array(formAttachmentSchema).max(8).optional(),
  website: z.string().max(200).optional(),
  /** Compatibility only — server overwrites from published CMS. */
  scope: formScopeSnapshotSchema.optional(),
});

/** Legacy username/password login (ADMIN_LEGACY_AUTH or no Supabase). */
export const adminLoginSchema = z.object({
  username: z.string().min(1).max(80),
  password: z.string().min(1).max(200),
});

/** Email+password for server-side Supabase staff login. */
export const adminEmailLoginSchema = z.object({
  email: z.string().trim().email().max(320),
  password: z.string().min(1).max(200),
  clientKey: z.string().trim().max(80).optional(),
});

/** Bridge browser Supabase session tokens into HttpOnly admin cookies. */
export const adminEstablishSessionSchema = z.object({
  accessToken: z.string().min(20).max(32_000),
  refreshToken: z.string().min(10).max(32_000),
  clientKey: z.string().trim().max(80).optional(),
});

export const adminRequestListSchema = z.object({
  kind: z.enum([...FORM_KINDS, "all"]).default("all"),
  status: z.enum([...REQUEST_STATUSES, "all"]).default("all"),
  q: z.string().max(200).optional(),
});

export const adminRequestIdSchema = z.object({
  id: z.string().uuid(),
});

export const adminRequestStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(REQUEST_STATUSES),
});

export const adminRequestReplySchema = z.object({
  id: z.string().uuid(),
  body: z.string().trim().min(1).max(8000),
  markClosed: z.boolean().optional(),
});

/** Mailbox-backed Aanvragen (Microsoft Graph or IMAP) */
export const adminInboxListSchema = z.object({
  kind: z.enum([...FORM_KINDS, "all"]).default("all"),
  /** Filter by stable scope key; omit or "all" = any scope. */
  scopeKey: z
    .union([z.literal("all"), z.string().trim().toLowerCase().regex(FORM_SCOPE_KEY_PATTERN)])
    .default("all"),
  q: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

/** imap:mailbox:uid | graph:mailbox:encodedMessageId | e2e:mailbox:requestId */
const inboxMessageId = z
  .string()
  .min(1)
  .max(800)
  .regex(/^(imap:[^:]+:\d+|graph:[^:]+:.+|e2e:[^:]+:.+)$/);

export const adminInboxMessageIdSchema = z.object({
  id: inboxMessageId,
});

export const adminInboxReplySchema = z.object({
  id: inboxMessageId,
  body: z.string().trim().min(1).max(8000),
});

export const adminInboxAttachmentSchema = z.object({
  id: inboxMessageId,
  filename: z.string().min(1).max(180),
});

/** Platform notification centre (staff-only). */
export const notificationListSchema = z.object({
  category: z.enum(NOTIFICATION_CATEGORIES).optional(),
  unreadOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional(),
  beforeCreatedAt: z.string().datetime().optional(),
});

export const notificationIdSchema = z.object({
  notificationId: z.string().uuid(),
});

/** Preference toggles cover implemented (active) types only — no future placeholders. */
export const notificationPreferenceUpdateSchema = z.object({
  type: z.enum(ACTIVE_NOTIFICATION_TYPES),
  channel: z.enum(["in_app", "browser"]),
  enabled: z.boolean(),
});

/** CMS content AI (admin-only, server-side Groq). */
export const contentAiGenerateDutchSchema = z
  .object({
    brief: z.string().trim().max(2000).optional(),
    currentText: z.string().trim().max(4000).optional(),
    fieldHint: z.string().trim().max(80).optional(),
    tone: z.enum(["professional", "catchy", "warm", "concise"]).default("catchy"),
    maxChars: z.number().int().min(20).max(2000).default(280),
    regenerate: z.boolean().optional(),
    previousText: z.string().trim().max(4000).optional(),
  })
  .refine((v) => Boolean(v.brief?.trim()) || Boolean(v.currentText?.trim()), {
    message: "brief or currentText required",
  });

export const contentAiTranslateSchema = z
  .object({
    text: z.string().trim().min(1).max(4000).optional(),
    fields: z.record(z.string().trim().min(1).max(4000)).optional(),
    preserveTerms: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    maxCharsPerField: z.number().int().min(20).max(4000).default(2000),
  })
  .refine(
    (v) => Boolean(v.text?.trim()) || (v.fields && Object.keys(v.fields).length > 0),
    { message: "text or fields required" },
  );

export const contentAiGenerateSectionSchema = z.object({
  brief: z.string().trim().max(2000).optional(),
  fields: z
    .record(
      z.object({
        currentText: z.string().trim().max(4000).optional(),
        fieldHint: z.string().trim().max(80).optional(),
        maxChars: z.number().int().min(20).max(2000).optional(),
      }),
    )
    .refine((v) => Object.keys(v).length >= 1 && Object.keys(v).length <= 12, {
      message: "1–12 sectievelden vereist",
    }),
  tone: z.enum(["professional", "catchy", "warm", "concise"]).default("catchy"),
  regenerate: z.boolean().optional(),
  previousFields: z.record(z.string().trim().max(4000)).optional(),
});

/** Staff settings — own-account mutations (server-enforced actor). */
export const staffUpdateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(200),
});

export const staffChangeEmailSchema = z.object({
  newEmail: z.string().trim().email().max(320),
});

export const staffChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: staffPasswordSchema,
  /** TOTP code from authenticator app — required before password is changed. */
  totpCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Voer de 6-cijferige MFA-code in."),
});

export const staffInviteAdminSchema = z.object({
  email: z.string().trim().email().max(320),
  fullName: z.string().trim().max(200).optional(),
  requestId: z.string().uuid().optional(),
});

export const staffRemoveMemberSchema = z.object({
  targetUserId: z.string().uuid(),
});

/** Server complete-invite step after the invitee set their own password via Auth updateUser. */
export const staffCompleteInviteRegistrationSchema = z.object({
  fullName: z.string().trim().min(1).max(200).optional(),
  requestId: z.string().uuid().optional(),
});

/** Client-side invite registration form (password never sent to McCoy server). */
export const staffInviteRegistrationFormSchema = z
  .object({
    fullName: z.string().trim().max(200).optional(),
    password: staffPasswordSchema,
    confirmPassword: z.string().min(1).max(STAFF_PASSWORD_MAX_LENGTH),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Wachtwoorden komen niet overeen.",
    path: ["confirmPassword"],
  });
