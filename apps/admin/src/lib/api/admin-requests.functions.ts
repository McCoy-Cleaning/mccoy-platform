import { createServerFn } from "@tanstack/react-start";

import {
  appendWebsiteRequestReply,
  enqueueNotificationOutbox,
  getWebsiteRequest,
  hasSupabaseServiceConfig,
  isNotificationOutboxUnavailableMessage,
  listWebsiteRequests,
  markAllNotificationsRead,
  NotificationOutboxUnavailableError,
  notificationUnreadCount,
  processNotificationOutbox,
  requireAdminSession,
  setWebsiteRequestStatus,
} from "@mccoy/database/server";
import {
  FormInboxConfigError,
  FormInboxError,
  formInboxConfigHelpMessage,
  getFormInboxAttachment,
  getFormInboxMessage,
  getFormInboxThread,
  isFormInboxConfigured,
  listFormInboxMessages,
  sendAdminReplyEmail,
  shouldAttemptGraphMail,
} from "@mccoy/email/server";
import { AdminAuthError, assertInboxFetchRateLimit, assertReplyRateLimit } from "@mccoy/security";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";
import {
  adminInboxAttachmentSchema,
  adminInboxListSchema,
  adminInboxMessageIdSchema,
  adminInboxReplySchema,
  adminRequestIdSchema,
  adminRequestListSchema,
  adminRequestReplySchema,
  adminRequestStatusSchema,
} from "@mccoy/validation";

function ensureInboxEnv(): void {
  ensureMonorepoEnvLoaded();
}
function authErrorResult(error: unknown) {
  if (error instanceof AdminAuthError) {
    return {
      ok: false as const,
      error: error.message,
      code: error.code,
    };
  }
  throw error;
}

function inboxErrorResult(error: unknown) {
  if (error instanceof FormInboxConfigError) {
    return {
      ok: false as const,
      error: error.message,
      code: "config" as const,
    };
  }
  if (error instanceof FormInboxError) {
    return {
      ok: false as const,
      error: error.message,
      code: "provider" as const,
    };
  }
  return authErrorResult(error);
}

/**
 * Stage D — best-effort mailbox connection status hook.
 *
 * There is no persistent inbox-watch process (see form-inbox.ts): mailbox
 * reads happen inline on each admin request. This tracks only whether the
 * *previous* attempt on this server instance failed, so a failure→success
 * transition can enqueue `mailbox.connection_restored` and a success→failure
 * transition can enqueue `mailbox.connection_failed`, without spamming a
 * notification on every single request while the mailbox stays down.
 *
 * Known limitation: this is per-instance in-memory state. Serverless/multi-
 * replica deployments will not share it, so a flapping mailbox can produce a
 * failed/restored pair per instance. Dedupe keys are bucketed per hour to
 * bound the worst case. A durable status table would remove this limitation
 * but is out of scope for Stage D (see docs/architecture/platform-notification-system.md).
 */
let mailboxWasFailing = false;

function hourBucket(): string {
  return new Date().toISOString().slice(0, 13);
}

async function reportMailboxConnectionOk(): Promise<void> {
  if (!mailboxWasFailing || !hasSupabaseServiceConfig()) {
    mailboxWasFailing = false;
    return;
  }
  mailboxWasFailing = false;
  try {
    const provider = shouldAttemptGraphMail() ? "graph" : "imap";
    await enqueueNotificationOutbox({
      type: "mailbox.connection_restored",
      title: "Postvak-verbinding hersteld",
      destinationPath: "/admin/inquiries",
      entityType: "mailbox",
      entityId: provider,
      metadata: { provider },
      dedupeKey: `mailbox.connection_restored:${hourBucket()}`,
    });
    await processNotificationOutbox(5);
  } catch (notifyError) {
    if (
      notifyError instanceof NotificationOutboxUnavailableError ||
      (notifyError instanceof Error &&
        isNotificationOutboxUnavailableMessage(notifyError.message))
    ) {
      console.warn(
        "[admin-requests] mailbox-restored notification skipped — notification_outbox missing; apply migration 20260725120000_platform_notifications.sql",
      );
      return;
    }
    console.error("[admin-requests] mailbox-restored notification enqueue failed", notifyError);
  }
}

async function reportMailboxConnectionFailed(error: unknown): Promise<void> {
  const wasAlreadyFailing = mailboxWasFailing;
  mailboxWasFailing = true;
  if (wasAlreadyFailing || !hasSupabaseServiceConfig()) return;
  try {
    const provider = shouldAttemptGraphMail() ? "graph" : "imap";
    const errorCode =
      error instanceof FormInboxConfigError
        ? "config"
        : error instanceof FormInboxError
          ? "provider"
          : "unknown";
    await enqueueNotificationOutbox({
      type: "mailbox.connection_failed",
      title: "Postvak-verbinding mislukt",
      destinationPath: "/admin/inquiries",
      entityType: "mailbox",
      entityId: provider,
      metadata: { provider, errorCode },
      dedupeKey: `mailbox.connection_failed:${hourBucket()}`,
    });
    await processNotificationOutbox(5);
  } catch (notifyError) {
    if (
      notifyError instanceof NotificationOutboxUnavailableError ||
      (notifyError instanceof Error &&
        isNotificationOutboxUnavailableMessage(notifyError.message))
    ) {
      console.warn(
        "[admin-requests] mailbox-failed notification skipped — notification_outbox missing; apply migration 20260725120000_platform_notifications.sql",
      );
      return;
    }
    console.error("[admin-requests] mailbox-failed notification enqueue failed", notifyError);
  }
}

/**
 * Aanvragen nav badge count — unread in-app notifications in category `requests`.
 * Deliberately NOT the Graph/IMAP mailbox unread count (see
 * docs/architecture/platform-notification-system.md: "Aanvragen badge = unread
 * notifications category requests, not Graph unread count").
 */
export const getAdminRequestsUnreadCount = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const session = await requireAdminSession();
    if (!session.userId || !hasSupabaseServiceConfig()) {
      return { ok: true as const, count: 0 };
    }
    const count = await notificationUnreadCount(session.userId, "requests");
    return { ok: true as const, count };
  } catch (error) {
    return authErrorResult(error);
  }
});

/** Clears the Aanvragen badge — called when staff opens the Aanvragen list. */
export const markAdminRequestsNotificationsRead = createServerFn({ method: "POST" }).handler(
  async () => {
    try {
      const session = await requireAdminSession();
      if (!session.userId || !hasSupabaseServiceConfig()) {
        return { ok: true as const, count: 0 };
      }
      const count = await markAllNotificationsRead(session.userId, "requests");
      return { ok: true as const, count };
    } catch (error) {
      return authErrorResult(error);
    }
  },
);

/** @deprecated Prefer listAdminFormInbox — kept for structured-store reconciliation. */
export const listAdminWebsiteRequests = createServerFn({ method: "POST" })
  .validator(adminRequestListSchema)
  .handler(async ({ data }) => {
    try {
      await requireAdminSession();
      const items = await listWebsiteRequests({
        kind: data.kind,
        status: data.status,
        q: data.q,
      });
      return { ok: true as const, items };
    } catch (error) {
      return authErrorResult(error);
    }
  });

/** @deprecated Prefer getAdminFormInboxMessage */
export const getAdminWebsiteRequest = createServerFn({ method: "POST" })
  .validator(adminRequestIdSchema)
  .handler(async ({ data }) => {
    try {
      await requireAdminSession();
      const request = await getWebsiteRequest(data.id);
      if (!request) {
        return { ok: false as const, error: "Aanvraag niet gevonden.", code: "not_found" as const };
      }
      return { ok: true as const, request };
    } catch (error) {
      return authErrorResult(error);
    }
  });

export const updateAdminWebsiteRequestStatus = createServerFn({ method: "POST" })
  .validator(adminRequestStatusSchema)
  .handler(async ({ data }) => {
    try {
      await requireAdminSession();
      const request = await setWebsiteRequestStatus(data.id, data.status);
      if (!request) {
        return { ok: false as const, error: "Aanvraag niet gevonden.", code: "not_found" as const };
      }
      return { ok: true as const, request };
    } catch (error) {
      return authErrorResult(error);
    }
  });

/** @deprecated Prefer replyAdminFormInboxMessage */
export const replyAdminWebsiteRequest = createServerFn({ method: "POST" })
  .validator(adminRequestReplySchema)
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminSession();
      assertReplyRateLimit(session.username);

      const existing = await getWebsiteRequest(data.id);
      if (!existing) {
        return { ok: false as const, error: "Aanvraag niet gevonden.", code: "not_found" as const };
      }
      if (!existing.submitterEmail) {
        return {
          ok: false as const,
          error: "Deze aanvraag heeft geen e-mailadres om op te antwoorden.",
          code: "validation" as const,
        };
      }

      const subject = `Re: ${existing.subject} (${existing.number})`;
      const sent = await sendAdminReplyEmail({
        to: existing.submitterEmail,
        subject,
        body: data.body,
        requestNumber: existing.number,
      });

      if (!sent.ok) {
        return { ok: false as const, error: sent.error, code: "provider" as const };
      }

      const nextStatus = data.markClosed ? "closed" : "replied";
      const request = await appendWebsiteRequestReply(
        data.id,
        {
          body: data.body,
          sentAt: new Date().toISOString(),
          sentBy: session.username,
          toEmail: existing.submitterEmail,
          resendId: sent.resendId,
        },
        nextStatus,
      );

      if (!request) {
        return { ok: false as const, error: "Aanvraag niet gevonden.", code: "not_found" as const };
      }

      return { ok: true as const, request };
    } catch (error) {
      if (error instanceof AdminAuthError && error.message.includes("Te veel")) {
        return { ok: false as const, error: error.message, code: "rate_limit" as const };
      }
      return authErrorResult(error);
    }
  });

export const listAdminFormInbox = createServerFn({ method: "POST" })
  .validator(adminInboxListSchema)
  .handler(async ({ data }) => {
    try {
      ensureInboxEnv();
      const session = await requireAdminSession();
      assertInboxFetchRateLimit(session.username);

      if (!isFormInboxConfigured()) {
        // Static "not configured" is a setup state, not a connectivity failure —
        // never enqueue mailbox.connection_failed for it (would fire on every
        // request in environments that simply don't use this feature).
        return {
          ok: false as const,
          error: formInboxConfigHelpMessage(),
          code: "config" as const,
        };
      }

      let result: Awaited<ReturnType<typeof listFormInboxMessages>>;
      try {
        result = await listFormInboxMessages({
          kind: data.kind,
          scopeKey: data.scopeKey,
          q: data.q,
          limit: data.limit,
        });
      } catch (inboxError) {
        await reportMailboxConnectionFailed(inboxError);
        throw inboxError;
      }
      await reportMailboxConnectionOk();

      // Facets: mailbox window ∪ persisted website-request scopes (not limited to result page).
      let storeScopes: Array<{ key: string; label: string; count: number }> = [];
      try {
        const requests = await listWebsiteRequests({ kind: "all", status: "all" });
        const map = new Map<string, { label: string; count: number }>();
        for (const r of requests) {
          if (!r.scopeKey) continue;
          const prev = map.get(r.scopeKey);
          map.set(r.scopeKey, {
            label: r.scopeLabel?.trim() || prev?.label || r.scopeKey,
            count: (prev?.count ?? 0) + 1,
          });
        }
        storeScopes = [...map.entries()].map(([key, v]) => ({
          key,
          label: v.label,
          count: v.count,
        }));
      } catch {
        storeScopes = [];
      }

      const { mergeScopeFacets } = await import("@mccoy/email/contracts");
      const scopes = mergeScopeFacets(storeScopes, result.facets.scopes);

      return {
        ok: true as const,
        items: result.items,
        facets: { kinds: result.facets.kinds, scopes },
      };
    } catch (error) {
      if (error instanceof AdminAuthError && error.message.includes("Te veel")) {
        return { ok: false as const, error: error.message, code: "rate_limit" as const };
      }
      return inboxErrorResult(error);
    }
  });

export const getAdminFormInboxMessage = createServerFn({ method: "POST" })
  .validator(adminInboxMessageIdSchema)
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminSession();
      assertInboxFetchRateLimit(session.username);

      if (!isFormInboxConfigured()) {
        return {
          ok: false as const,
          error: formInboxConfigHelpMessage(),
          code: "config" as const,
        };
      }

      const message = await getFormInboxMessage(data.id);
      if (!message) {
        return {
          ok: false as const,
          error: "Bericht niet gevonden of geen McCoy-formulier-e-mail.",
          code: "not_found" as const,
        };
      }
      return { ok: true as const, message };
    } catch (error) {
      if (error instanceof AdminAuthError && error.message.includes("Te veel")) {
        return { ok: false as const, error: error.message, code: "rate_limit" as const };
      }
      return inboxErrorResult(error);
    }
  });

export const getAdminFormInboxThread = createServerFn({ method: "POST" })
  .validator(adminInboxMessageIdSchema)
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminSession();
      assertInboxFetchRateLimit(session.username);

      if (!isFormInboxConfigured()) {
        return {
          ok: false as const,
          error: formInboxConfigHelpMessage(),
          code: "config" as const,
        };
      }

      const thread = await getFormInboxThread(data.id);
      return { ok: true as const, thread };
    } catch (error) {
      if (error instanceof AdminAuthError && error.message.includes("Te veel")) {
        return { ok: false as const, error: error.message, code: "rate_limit" as const };
      }
      return inboxErrorResult(error);
    }
  });

export const getAdminFormInboxAttachment = createServerFn({ method: "POST" })
  .validator(adminInboxAttachmentSchema)
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminSession();
      assertInboxFetchRateLimit(session.username);

      if (!isFormInboxConfigured()) {
        return {
          ok: false as const,
          error: formInboxConfigHelpMessage(),
          code: "config" as const,
        };
      }

      const attachment = await getFormInboxAttachment(data.id, data.filename);
      if (!attachment?.contentBase64) {
        return {
          ok: false as const,
          error: "Bijlage niet gevonden of te groot om te downloaden.",
          code: "not_found" as const,
        };
      }
      return { ok: true as const, attachment };
    } catch (error) {
      if (error instanceof AdminAuthError && error.message.includes("Te veel")) {
        return { ok: false as const, error: error.message, code: "rate_limit" as const };
      }
      return inboxErrorResult(error);
    }
  });

export const replyAdminFormInboxMessage = createServerFn({ method: "POST" })
  .validator(adminInboxReplySchema)
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminSession();
      assertReplyRateLimit(session.username);

      if (!isFormInboxConfigured()) {
        return {
          ok: false as const,
          error: formInboxConfigHelpMessage(),
          code: "config" as const,
        };
      }

      const message = await getFormInboxMessage(data.id);
      if (!message) {
        return {
          ok: false as const,
          error: "Bericht niet gevonden.",
          code: "not_found" as const,
        };
      }
      if (!message.submitterEmail) {
        return {
          ok: false as const,
          error:
            "Geen afzender-e-mail gevonden (Reply-To / contactveld). Antwoorden is niet mogelijk.",
          code: "validation" as const,
        };
      }

      const requestNumber = message.requestNumber ?? `IMAP-${message.uid}`;
      const subject = message.subject.startsWith("Re:")
        ? message.subject
        : `Re: ${message.subject}`;

      const sent = await sendAdminReplyEmail({
        to: message.submitterEmail,
        subject,
        body: data.body,
        requestNumber,
        inReplyTo: message.messageId ?? undefined,
        inboxMessageId: data.id,
      });

      if (!sent.ok) {
        return { ok: false as const, error: sent.error, code: "provider" as const };
      }

      return {
        ok: true as const,
        toEmail: message.submitterEmail,
        resendId: sent.resendId,
      };
    } catch (error) {
      if (error instanceof AdminAuthError && error.message.includes("Te veel")) {
        return { ok: false as const, error: error.message, code: "rate_limit" as const };
      }
      return inboxErrorResult(error);
    }
  });
