import type { FormAttachment, FormKind, WebsiteFormPayload } from "@mccoy/domain";
import { sanitizeScopeForSubject } from "@mccoy/domain";
import {
  attachmentMetaFromBase64,
  createWebsiteRequest,
  hasSupabaseServiceConfig,
  processNotificationOutbox,
  updateRequestNotification,
} from "@mccoy/database/server";
import {
  assertRateLimit,
  isHoneypotTriggered,
  RateLimitError,
  readServerEnv,
} from "@mccoy/security";

import { FormSubmitError } from "./form-submit-error";
import { defaultTransactionalFrom, isSmtpConfigured, sendSmtpMail } from "./smtp";
import { buildFormEmail } from "./templates";

export { FormSubmitError } from "./form-submit-error";

const DEFAULT_TO = "oana.dine1571@gmail.com";
const MAX_ATTACHMENT_BYTES = 4.5 * 1024 * 1024;
const MAX_FIELD_LENGTH = 2000;

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
      filename: file.filename.replace(/[^\w.\- ()[\]]+/g, "_"),
      contentBase64: file.contentBase64,
      contentType: file.contentType || "application/octet-stream",
    });
    total += approxBytes;
  }
  return accepted;
}

/**
 * Persist a structured admin request, then queue/send the staff notification.
 * Persistence succeeds even when email delivery fails.
 */
export async function sendWebsiteFormEmail(payload: WebsiteFormPayload): Promise<{ ok: true }> {
  if (isHoneypotTriggered(payload.website)) {
    return { ok: true };
  }

  const kind = payload.kind as FormKind;
  const fields = sanitizeFields(payload.fields ?? {});

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

  const attachments = filterAttachments(payload.attachments);
  const attachmentMeta = attachments.map((a) =>
    attachmentMetaFromBase64(a.filename, a.contentType, a.contentBase64),
  );

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
    attachments.map((a) => a.filename),
    scope,
  );

  const config = getFormEmailConfig();
  if (process.env.MCCOY_E2E === "1" || !isSmtpConfigured()) {
    await updateRequestNotification(
      request.id,
      process.env.MCCOY_E2E === "1" ? "skipped" : "failed",
      process.env.MCCOY_E2E === "1"
        ? "E2E: SMTP notification skipped (deterministic inbox)"
        : "SMTP is not configured (SMTP_* or FORM_INBOX_USER/PASS)",
    );
    if (process.env.MCCOY_E2E !== "1") {
      console.warn("[forms] request persisted without email notification", {
        id: request.id,
        number: request.number,
      });
    }
    return { ok: true };
  }

  try {
    const headers: Record<string, string> = {
      "X-McCoy-Form-Kind": kind,
      "X-McCoy-Form-Id": formId,
      "X-McCoy-Form-Submission-Id": request.number,
    };
    if (scope?.key) {
      headers["X-McCoy-Form-Scope-Key"] = scope.key;
    }
    if (scope?.label) {
      headers["X-McCoy-Form-Scope-Label"] = sanitizeScopeForSubject(scope.label);
    }

    const sent = await sendSmtpMail({
      from: config.from,
      to: config.to,
      subject: `${email.subject} (${request.number})`,
      html: email.html,
      replyTo: fields.email,
      headers,
      attachments: attachments.map((a) => ({
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
