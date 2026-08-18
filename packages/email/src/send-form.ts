import type { FormAttachment, FormKind, UploadedFormAttachment, WebsiteFormPayload } from "@mccoy/domain";
import { sanitizeScopeForSubject } from "@mccoy/domain";
import {
  attachmentMetaFromBase64,
  createWebsiteRequest,
  finalizeWebsiteRequestUploadedAttachments,
  hasSupabaseServiceConfig,
  processNotificationOutbox,
  storeWebsiteRequestAttachments,
  updateRequestNotification,
} from "@mccoy/database/server";
import {
  assertRateLimit,
  isHoneypotTriggered,
  RateLimitError,
  readServerEnv,
} from "@mccoy/security";

import { FormSubmitError } from "./form-submit-error";
import { shouldAttemptGraphMail } from "./form-inbox-provider";
import { isGraphMailConfigured } from "./graph-config";
import { sendGraphAdminReply } from "./graph-mail";
import { defaultTransactionalFrom, isSmtpConfigured, sendSmtpMail } from "./smtp";
import { buildFormEmail } from "./templates";

export { FormSubmitError } from "./form-submit-error";

const DEFAULT_TO = "oana.dine1571@gmail.com";
const MAX_ATTACHMENT_BYTES = 4.5 * 1024 * 1024;
const MAX_FIELD_LENGTH = 2000;
const IMAGE_CONTENT_TYPE_RE = /^image\//i;
const IMAGE_EXTENSION_RE = /\.(avif|bmp|gif|jpe?g|png|webp)$/i;

function getFormEmailConfig() {
  return {
    to:
      readServerEnv("FORM_TO_EMAIL") ||
      readServerEnv("SMTP_REPLY_TO") ||
      DEFAULT_TO,
    from: defaultTransactionalFrom(),
  };
}

function sanitizeFields(fields: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(fields)) {
    if (typeof raw !== "string") continue;
    const value = raw.trim().slice(0, MAX_FIELD_LENGTH);
    if (!value) continue;
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(key)) continue;
    out[key] = value;
  }
  return out;
}

function sanitizeAttachmentFilename(name: string): string {
  return name.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 180) || "bijlage";
}

function filterAttachments(attachments: FormAttachment[] | undefined): FormAttachment[] {
  if (!attachments?.length) return [];
  const accepted: FormAttachment[] = [];
  let total = 0;
  for (const file of attachments.slice(0, 8)) {
    const approxBytes = Math.floor((file.contentBase64.length * 3) / 4);
    if (approxBytes <= 0 || approxBytes > MAX_ATTACHMENT_BYTES) continue;
    if (total + approxBytes > MAX_ATTACHMENT_BYTES) continue;
    if (!file.filename || file.filename.length > 180) continue;
    accepted.push({
      filename: sanitizeAttachmentFilename(file.filename),
      contentBase64: file.contentBase64,
      contentType: file.contentType || "application/octet-stream",
    });
    total += approxBytes;
  }
  return accepted;
}

function filterUploadedAttachments(
  uploaded: UploadedFormAttachment[] | undefined,
): UploadedFormAttachment[] {
  if (!uploaded?.length) return [];
  const used = new Set<string>();
  return uploaded.slice(0, 8).map((file) => {
    let filename = sanitizeAttachmentFilename(file.filename);
    if (used.has(filename.toLowerCase())) {
      const dot = filename.lastIndexOf(".");
      const stem = dot > 0 ? filename.slice(0, dot) : filename;
      const ext = dot > 0 ? filename.slice(dot) : "";
      let n = 2;
      while (used.has(`${stem}-${n}${ext}`.toLowerCase())) n += 1;
      filename = `${stem}-${n}${ext}`;
    }
    used.add(filename.toLowerCase());
    return {
      filename,
      contentType: file.contentType || "application/octet-stream",
      sizeBytes: file.sizeBytes,
      storagePath: file.storagePath.trim(),
    };
  });
}

function isImageAttachment(filename: string, contentType: string): boolean {
  if (IMAGE_CONTENT_TYPE_RE.test(contentType)) return true;
  return IMAGE_EXTENSION_RE.test(filename);
}

function enrichFieldsWithAttachmentNames(
  fields: Record<string, string>,
  attachments: Array<{ filename: string; contentType: string }>,
): Record<string, string> {
  if (!attachments.length) return fields;
  const next = { ...fields };
  const imageNames = attachments
    .filter((item) => isImageAttachment(item.filename, item.contentType))
    .map((item) => item.filename);
  if (imageNames.length > 0 && !next.photos?.trim()) {
    next.photos = imageNames.join(", ");
  }
  return next;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Persist a structured admin request, then queue/send the staff notification.
 * Prefer Microsoft Graph Mail.Send (as GRAPH_MAILBOX) over SMTP — avoids M365
 * SMTP AUTH / MFA issues. Persistence succeeds even when email delivery fails.
 */
export async function sendWebsiteFormEmail(payload: WebsiteFormPayload): Promise<{ ok: true }> {
  if (isHoneypotTriggered(payload.website)) {
    return { ok: true };
  }

  const kind = payload.kind as FormKind;
  let fields = sanitizeFields(payload.fields ?? {});

  if (kind === "newsletter") {
    if (!fields.email) {
      throw new FormSubmitError("Please enter a valid email address.", "validation");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      throw new FormSubmitError("Please enter a valid email address.", "validation");
    }
    if (fields.consentAccepted === "false" || fields.consentAccepted === "0") {
      throw new FormSubmitError("Consent is required.", "validation");
    }
    // Durable store expects name+email for staff inbox readability.
    if (!fields.name) {
      fields.name = fields.email.split("@")[0] || "Nieuwsbrief";
    }
  } else {
    if (!fields.name || !fields.email) {
      throw new FormSubmitError("Name and email are required.", "validation");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) {
      throw new FormSubmitError("Please enter a valid email address.", "validation");
    }
  }

  try {
    assertRateLimit(
      `form-submit:${fields.email.toLowerCase()}`,
      8,
      10 * 60_000,
      "Too many submissions. Please wait a few minutes.",
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      throw new FormSubmitError(error.message, "rate_limit");
    }
    throw error;
  }

  const legacyAttachments = filterAttachments(payload.attachments);
  const uploadedAttachments = filterUploadedAttachments(payload.uploadedAttachments);

  const attachmentMeta =
    uploadedAttachments.length > 0
      ? uploadedAttachments.map((a) => ({
          filename: a.filename,
          contentType: a.contentType,
          sizeBytes: a.sizeBytes,
        }))
      : legacyAttachments.map((a) =>
          attachmentMetaFromBase64(a.filename, a.contentType, a.contentBase64),
        );

  fields = enrichFieldsWithAttachmentNames(fields, attachmentMeta);

  // Scope on the payload is already server-resolved by submitWebsiteForm.
  // Never invent tabs from a raw client label.
  const scope = payload.scope ?? null;
  const formId = `${payload.pageId}:${payload.sourceId}`;

  const request = await createWebsiteRequest({
    kind,
    fields,
    attachments: attachmentMeta,
    notificationState: "pending",
    formId,
    sourcePageId: payload.pageId,
    scopeKey: scope?.key ?? null,
    scopeLabel: scope?.label ?? null,
  });

  if (uploadedAttachments.length > 0) {
    const finalized = await finalizeWebsiteRequestUploadedAttachments(
      request.id,
      uploadedAttachments,
    );
    if (!finalized.ok) {
      throw new FormSubmitError(finalized.error, "provider");
    }
  } else if (legacyAttachments.length > 0 && hasSupabaseServiceConfig()) {
    const stored = await storeWebsiteRequestAttachments(
      request.id,
      legacyAttachments.map((a) => ({
        filename: a.filename,
        contentType: a.contentType,
        contentBase64: a.contentBase64,
      })),
    );
    if (stored.status === "failed") {
      console.error("[forms] private attachment store failed", {
        requestId: request.id,
        error: stored.error,
      });
    }
  }

  // Postgres-backed store enqueues `website_request.received` in the same
  // transaction as the request row (create_website_request_with_notification RPC).
  // Drain the outbox inline — same pattern as CMS's processCmsOutbox after publish.
  // No-op when running on the JSON fallback store (no Supabase configured).
  if (hasSupabaseServiceConfig()) {
    try {
      await processNotificationOutbox(10);
    } catch (error) {
      console.error("[forms] notification outbox processing failed", error);
    }
  }

  const email = buildFormEmail(
    kind,
    fields,
    attachmentMeta.map((a) => a.filename),
    scope,
  );

  const config = getFormEmailConfig();
  const subject = `${email.subject} (${request.number})`;
  const text = htmlToPlainText(email.html);
  const headers: Record<string, string> = {
    "X-McCoy-Form-Kind": kind,
    "X-McCoy-Form-Id": formId,
    "X-McCoy-Form-Submission-Id": request.number,
    "X-McCoy-Submitter-Email": fields.email.trim().toLowerCase(),
  };
  if (scope?.key) {
    headers["X-McCoy-Form-Scope-Key"] = scope.key;
  }
  if (scope?.label) {
    headers["X-McCoy-Form-Scope-Label"] = sanitizeScopeForSubject(scope.label);
  }

  if (process.env.MCCOY_E2E === "1") {
    await updateRequestNotification(
      request.id,
      "skipped",
      "E2E: email notification skipped (deterministic inbox)",
    );
    return { ok: true };
  }

  const canGraph = shouldAttemptGraphMail() && isGraphMailConfigured();
  const canSmtp = isSmtpConfigured();

  if (!canGraph && !canSmtp) {
    await updateRequestNotification(
      request.id,
      "failed",
      "Geen e-mailkanaal: configureer Microsoft Graph (Mail.Send) of SMTP_*.",
    );
    console.warn("[forms] request persisted without email notification", {
      id: request.id,
      number: request.number,
    });
    return { ok: true };
  }

  // Prefer durable private storage for Admin; email may still carry small Base64 copies.
  const mailAttachments = legacyAttachments;

  try {
    if (canGraph) {
      const sent = await sendGraphAdminReply({
        to: config.to,
        subject,
        html: email.html,
        text,
        replyTo: fields.email,
        headers,
        // Form notifications to the shared mailbox must not also land in Sent Items
        // (saveToSentItems would duplicate the same submission in Aanvragen).
        saveToSentItems: false,
        attachments: mailAttachments.map((a) => ({
          filename: a.filename,
          contentBase64: a.contentBase64,
          contentType: a.contentType,
        })),
      });

      if (sent.ok) {
        await updateRequestNotification(request.id, "sent");
        return { ok: true };
      }

      console.error("[forms] Graph send failed", {
        detail: sent.error.slice(0, 300),
        kind,
        to: config.to,
        requestId: request.id,
      });

      if (!canSmtp) {
        await updateRequestNotification(request.id, "failed", sent.error.slice(0, 200));
        return { ok: true };
      }
      console.error("[forms] falling back to SMTP after Graph failure");
    }

    const sent = await sendSmtpMail({
      from: config.from,
      to: config.to,
      subject,
      html: email.html,
      replyTo: fields.email,
      headers,
      attachments: mailAttachments.map((a) => ({
        filename: a.filename,
        content: a.contentBase64,
        contentType: a.contentType,
        encoding: "base64" as const,
      })),
    });

    if (!sent.ok) {
      console.error("[forms] SMTP error", {
        detail: sent.error.slice(0, 300),
        kind,
        to: config.to,
        requestId: request.id,
      });
      await updateRequestNotification(request.id, "failed", sent.error.slice(0, 200));
      return { ok: true };
    }

    await updateRequestNotification(request.id, "sent");
    return { ok: true };
  } catch (error) {
    console.error("[forms] notification send failed", error);
    await updateRequestNotification(
      request.id,
      "failed",
      error instanceof Error ? error.message : "unknown",
    );
    return { ok: true };
  }
}
