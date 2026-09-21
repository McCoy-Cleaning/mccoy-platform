import { createServerFn } from "@tanstack/react-start";

import {
  appendWebsiteRequestReply,
  enqueueNotificationOutbox,
  getWebsiteRequest,
  hasSupabaseServiceConfig,
  isNotificationOutboxUnavailableMessage,
  listWebsiteRequestMailMessages,
  listWebsiteRequests,
  listUnreadNotificationEntityIds,
  markAllNotificationsRead,
  markNotificationsReadForEntity,
  NotificationOutboxUnavailableError,
  notificationUnreadCount,
  processNotificationOutbox,
  requireAdminSession,
  setWebsiteRequestInquiryStatus,
  setWebsiteRequestStatus,
  updateWebsiteRequestSubmitterEmail,
  upsertWebsiteRequestMailMessage,
  writeStaffAudit,
} from "@mccoy/database/server";
import {
  FormInboxConfigError,
  FormInboxError,
  formInboxConfigHelpMessage,
  deleteFormInboxMessage,
  bulkDeleteFormInboxMessages,
  bulkDeleteFailureMessage,
  decodeInboxMessageId,
  encodeGraphMessageId,
  getFormInboxAttachment,
  getFormInboxMessage,
  getFormInboxThread,
  isFormInboxConfigured,
  listFormInboxMessages,
  clearInboxListSnapshotCache,
  getGraphMailConfig,
  sendAdminReplyEmail,
  shouldAttemptGraphMail,
  dedupeInquiryThreadItems,
  extractSimpleReplyBody,
  isTemplatedWrapOf,
} from "@mccoy/email/server";
import {
  AdminAuthError,
  assertInboxFetchRateLimit,
  assertInquiryStatusRateLimit,
  assertReplyRateLimit,
} from "@mccoy/security";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";
import {
  adminInboxAttachmentSchema,
  adminInboxBulkDeleteSchema,
  adminInboxListSchema,
  adminInboxLifecycleStatusSchema,
  adminInboxMessageIdSchema,
  adminInboxReplySchema,
  adminInboxUpdateSubmitterEmailSchema,
  adminInquiryStatusSchema,
  adminRequestIdSchema,
  adminRequestListSchema,
  adminRequestReplySchema,
  adminRequestStatusSchema,
} from "@mccoy/validation";
import {
  applyRequestNotificationUnreadState,
  websiteRequestIdFromInboxId,
  websiteRequestIdsFromInboxItems,
} from "@/lib/requests/inquiry-unread";

function ensureInboxEnv(): void {
  ensureMonorepoEnvLoaded();
}

async function mergePersistedRepliesIntoThread(
  thread: Awaited<ReturnType<typeof getFormInboxThread>>,
  requestNumber: string | null | undefined,
): Promise<Awaited<ReturnType<typeof getFormInboxThread>>> {
  if (!requestNumber) return thread;

  try {
    const matches = await listWebsiteRequests({ q: requestNumber });
    const summary = matches.find((item) => item.number === requestNumber);
    if (!summary) return thread;

    const request = await getWebsiteRequest(summary.id);
    if (!request?.replies.length) return thread;

    const normalisedThread = thread.map((item) =>
      item.direction === "admin"
        ? { ...item, textBody: extractSimpleReplyBody(item.textBody) }
        : item,
    );

    const extras = request.replies
      .filter((reply) => {
        const simple = reply.body.trim().toLowerCase();
        return !normalisedThread.some(
          (item) =>
            item.direction === "admin" &&
            (item.textBody.trim().toLowerCase() === simple ||
              isTemplatedWrapOf(reply.body, item.textBody) ||
              isTemplatedWrapOf(item.textBody, reply.body)),
        );
      })
      .map((reply, index) => ({
        id: `persisted-reply:${request.id}:${reply.id}`,
        uid: 900_000 + index,
        direction: "admin" as const,
        from: reply.sentBy || "McCoy",
        to: reply.toEmail,
        date: reply.sentAt,
        subject: `Re: ${request.subject}`,
        textBody: reply.body,
        messageId: reply.resendId ?? null,
        attachments: [],
      }));

    return dedupeInquiryThreadItems(
      [...normalisedThread, ...extras].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    );
  } catch {
    return thread;
  }
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
      destinationPath: "/inquiries",
      entityType: "mailbox",
      entityId: provider,
      metadata: { provider },
      dedupeKey: `mailbox.connection_restored:${hourBucket()}`,
    });
    await processNotificationOutbox(5);
  } catch (notifyError) {
    if (
      notifyError instanceof NotificationOutboxUnavailableError ||
      (notifyError instanceof Error && isNotificationOutboxUnavailableMessage(notifyError.message))
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
      destinationPath: "/inquiries",
      entityType: "mailbox",
      entityId: provider,
      metadata: { provider, errorCode },
      dedupeKey: `mailbox.connection_failed:${hourBucket()}`,
    });
    await processNotificationOutbox(5);
  } catch (notifyError) {
    if (
      notifyError instanceof NotificationOutboxUnavailableError ||
      (notifyError instanceof Error && isNotificationOutboxUnavailableMessage(notifyError.message))
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

/** Clears the Aanvragen badge for one website request — called when staff opens that inquiry. */
export const markAdminRequestNotificationsReadForEntity = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const data = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const entityId = typeof data.entityId === "string" ? data.entityId.trim() : "";
    if (!entityId) throw new Error("entityId is required");
    return { entityId };
  })
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminSession();
      if (!session.userId || !hasSupabaseServiceConfig()) {
        return { ok: true as const, count: 0 };
      }
      const count = await markNotificationsReadForEntity(
        session.userId,
        "website_request",
        data.entityId,
      );
      return { ok: true as const, count };
    } catch (error) {
      return authErrorResult(error);
    }
  });

/**
 * @deprecated Prefer markAdminRequestNotificationsReadForEntity — blanket list clear
 * hid the bell badge for applicant replies. Kept for rare admin tooling.
 */
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

      // Safety net: persist-clear orphan scopes — do not block inbox paint.
      void import("@mccoy/database/server")
        .then(({ reconcileOrphanWebsiteRequestScopes }) => reconcileOrphanWebsiteRequestScopes())
        .catch(() => {
          /* display-time clear in listFormInboxMessages still applies */
        });

      let result: Awaited<ReturnType<typeof listFormInboxMessages>>;
      try {
        result = await listFormInboxMessages({
          kind: data.kind,
          lifecycle: data.lifecycle,
          scopeKey: data.scopeKey,
          q: data.q,
          limit: data.limit,
          fresh: data.fresh,
        });
        await reportMailboxConnectionOk();
      } catch (inboxError) {
        await reportMailboxConnectionFailed(inboxError);
        throw inboxError;
      }

      const { buildAanvragenScopeFacets } = await import("@mccoy/email/contracts");
      const { showAllGraphInboxMessages } = await import("@mccoy/email/server");
      let publishedScopes: Array<{ key: string; label: string; count: number }> = [];
      try {
        const { loadPublishedCmsPagesForFormScopes } = await import("@mccoy/database/server");
        const { collectPublishedFormScopes } = await import("@mccoy/cms-schema");
        const pages = await loadPublishedCmsPagesForFormScopes();
        publishedScopes = collectPublishedFormScopes(pages);
      } catch {
        publishedScopes = [];
      }

      const scopes = buildAanvragenScopeFacets({
        published: publishedScopes,
        mailbox: result.facets.scopes,
        storeLabels: result.facets.scopes,
      });

      let items = result.items;
      if (session.userId && hasSupabaseServiceConfig()) {
        const requestIds = websiteRequestIdsFromInboxItems(items);
        try {
          const unreadRequestIds = await listUnreadNotificationEntityIds(
            session.userId,
            "website_request",
            requestIds,
          );
          items = applyRequestNotificationUnreadState(items, new Set(unreadRequestIds));
        } catch (unreadError) {
          console.error("[admin-requests] request unread overlay failed", {
            message: unreadError instanceof Error ? unreadError.message.slice(0, 160) : "unknown",
          });
        }
      }

      return {
        ok: true as const,
        items,
        facets: { kinds: result.facets.kinds, scopes },
        showAll: showAllGraphInboxMessages(),
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

      let message = await getFormInboxMessage(data.id);
      if (!message) {
        return {
          ok: false as const,
          error: "Bericht niet gevonden of geen McCoy-formulier-e-mail.",
          code: "not_found" as const,
        };
      }

      let notificationReadCount = 0;
      const requestId = websiteRequestIdFromInboxId(data.id);
      if (requestId && session.userId && hasSupabaseServiceConfig()) {
        try {
          notificationReadCount = await markNotificationsReadForEntity(
            session.userId,
            "website_request",
            requestId,
          );
        } catch (readError) {
          // Reading the request must remain available during a transient
          // notification failure. The next list refresh will reconcile state.
          console.error("[admin-requests] request notification read failed", {
            requestId,
            message: readError instanceof Error ? readError.message.slice(0, 160) : "unknown",
          });
        }
      }

      // Opening the detail is the read action. Workflow remains untouched;
      // notification_recipients is the durable per-admin source of truth.
      message = { ...message, unread: false };
      return { ok: true as const, message, notificationReadCount };
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

      // Load root without blocking; request-backed Graph sync runs in getFormInboxThread.
      const message = await getFormInboxMessage(data.id);
      let thread = message?.thread ?? [];
      try {
        thread = await getFormInboxThread(data.id);
      } catch {
        thread = message?.thread ?? [];
      }
      const merged = await mergePersistedRepliesIntoThread(thread, message?.requestNumber ?? null);
      return { ok: true as const, thread: merged };
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

      // Request-backed Graph fallback must run even if IMAP inbox is not configured.
      if (!isFormInboxConfigured() && !getGraphMailConfig()) {
        return {
          ok: false as const,
          error: formInboxConfigHelpMessage(),
          code: "config" as const,
        };
      }

      const attachment = await getFormInboxAttachment(data.id, data.filename);
      if (!attachment) {
        return {
          ok: false as const,
          error:
            "Bijlage staat in de mailbox maar kon niet worden gekoppeld. Probeer Vernieuwen, of open het bericht opnieuw.",
          code: "not_found" as const,
        };
      }
      const hasBytes = Boolean(attachment.contentBase64?.trim());
      const hasSignedUrl = Boolean(attachment.contentUrl || attachment.downloadUrl);
      if (!hasBytes && !hasSignedUrl) {
        return {
          ok: false as const,
          error:
            "Bijlage staat in de mailbox maar kon niet worden gekoppeld. Probeer Vernieuwen, of open het bericht opnieuw.",
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

export const updateAdminFormInboxSubmitterEmail = createServerFn({ method: "POST" })
  .validator(adminInboxUpdateSubmitterEmailSchema)
  .handler(async ({ data }) => {
    try {
      ensureInboxEnv();
      const session = await requireAdminSession();

      let requestId: string | null = null;
      try {
        const decoded = decodeInboxMessageId(data.id);
        if (decoded.provider === "request" || decoded.provider === "e2e") {
          requestId = decoded.requestId;
        }
      } catch {
        /* invalid id handled below */
      }

      if (!requestId) {
        return {
          ok: false as const,
          error:
            "Het e-mailadres kan alleen worden aangepast bij formulieraanvragen (niet bij losse mailboxberichten).",
          code: "validation" as const,
        };
      }

      const existing = await getWebsiteRequest(requestId);
      if (!existing) {
        return {
          ok: false as const,
          error: "Aanvraag niet gevonden.",
          code: "not_found" as const,
        };
      }

      const normalized = data.email.trim().toLowerCase();
      if (normalized === existing.submitterEmail.trim().toLowerCase()) {
        return {
          ok: true as const,
          submitterEmail: existing.submitterEmail,
          requestId: existing.id,
        };
      }

      const updated = await updateWebsiteRequestSubmitterEmail(requestId, normalized);
      if (!updated) {
        return {
          ok: false as const,
          error: "Aanvraag niet gevonden.",
          code: "not_found" as const,
        };
      }

      await writeStaffAudit({
        actorUserId: session.userId ?? null,
        action: "website_request.submitter_email_updated",
        targetType: "website_request",
        targetId: updated.id,
        before: { submitterEmail: existing.submitterEmail },
        after: { submitterEmail: updated.submitterEmail },
        metadata: { requestNumber: updated.number, inboxMessageId: data.id },
      });

      return {
        ok: true as const,
        submitterEmail: updated.submitterEmail,
        requestId: updated.id,
      };
    } catch (error) {
      return authErrorResult(error);
    }
  });

/**
 * Set the staff triage label (Nieuw / In behandeling / Gefactureerd) for a
 * website-request inquiry, directly from the Aanvragen list/detail.
 *
 * "invoiced" is a manual label ONLY — it never creates, links, or implies a
 * legal invoice, order, payment, or financial record (see migration
 * 20260915200000_website_request_inquiry_status.sql).
 *
 * Accepts the encoded inbox message id (`req:…` / `e2e:…`); mailbox-only
 * messages have no persistent row and are rejected. Authorization is enforced
 * server-side via requireAdminSession + service-role write; the change is
 * audited with before/after values.
 */
export const updateAdminInquiryStatus = createServerFn({ method: "POST" })
  .validator(adminInquiryStatusSchema)
  .handler(async ({ data }) => {
    try {
      ensureInboxEnv();
      const session = await requireAdminSession();
      assertInquiryStatusRateLimit(session.username);

      let requestId: string | null = null;
      try {
        const decoded = decodeInboxMessageId(data.id);
        if (decoded.provider === "request" || decoded.provider === "e2e") {
          requestId = decoded.requestId;
        }
      } catch {
        /* invalid id handled below */
      }

      if (!requestId) {
        return {
          ok: false as const,
          error:
            "De status kan alleen worden ingesteld bij formulieraanvragen (niet bij losse mailboxberichten).",
          code: "validation" as const,
        };
      }

      const existing = await getWebsiteRequest(requestId);
      if (!existing) {
        return {
          ok: false as const,
          error: "Aanvraag niet gevonden.",
          code: "not_found" as const,
        };
      }

      if (existing.inquiryStatus === data.inquiryStatus) {
        return {
          ok: true as const,
          inquiryStatus: existing.inquiryStatus,
          requestId: existing.id,
        };
      }

      const updated = await setWebsiteRequestInquiryStatus(requestId, data.inquiryStatus);
      if (!updated) {
        return {
          ok: false as const,
          error: "Aanvraag niet gevonden.",
          code: "not_found" as const,
        };
      }

      await writeStaffAudit({
        actorUserId: session.userId ?? null,
        action: "website_request.inquiry_status_updated",
        targetType: "website_request",
        targetId: updated.id,
        before: { inquiryStatus: existing.inquiryStatus },
        after: { inquiryStatus: updated.inquiryStatus },
        metadata: { requestNumber: updated.number, inboxMessageId: data.id },
      });

      return {
        ok: true as const,
        inquiryStatus: updated.inquiryStatus,
        requestId: updated.id,
      };
    } catch (error) {
      if (error instanceof AdminAuthError && error.message.includes("Te veel")) {
        return { ok: false as const, error: error.message, code: "rate_limit" as const };
      }
      return authErrorResult(error);
    }
  });

/**
 * Resolve or manually reopen a persisted website request. This is deliberately
 * separate from the triage label: `closed` means resolved; `open` means the
 * request needs attention. Deleted/spam requests cannot be reopened here.
 */
export const updateAdminRequestLifecycleStatus = createServerFn({ method: "POST" })
  .validator(adminInboxLifecycleStatusSchema)
  .handler(async ({ data }) => {
    try {
      ensureInboxEnv();
      const session = await requireAdminSession();
      assertInquiryStatusRateLimit(session.username);

      let requestId: string | null = null;
      try {
        const decoded = decodeInboxMessageId(data.id);
        if (decoded.provider === "request" || decoded.provider === "e2e") {
          requestId = decoded.requestId;
        }
      } catch {
        /* invalid id handled below */
      }

      if (!requestId) {
        return {
          ok: false as const,
          error: "Alleen opgeslagen formulieraanvragen kunnen worden afgerond.",
          code: "validation" as const,
        };
      }

      const existing = await getWebsiteRequest(requestId);
      if (!existing) {
        return {
          ok: false as const,
          error: "Aanvraag niet gevonden.",
          code: "not_found" as const,
        };
      }
      if (existing.status === "deleted" || existing.status === "spam") {
        return {
          ok: false as const,
          error: "Een verwijderde of als spam gemarkeerde aanvraag kan niet worden heropend.",
          code: "validation" as const,
        };
      }
      if (existing.status === data.status) {
        return {
          ok: true as const,
          lifecycleStatus: existing.status,
          requestId: existing.id,
        };
      }
      if (data.status === "open" && existing.status !== "closed") {
        return {
          ok: false as const,
          error: "Alleen een afgeronde aanvraag kan handmatig worden heropend.",
          code: "validation" as const,
        };
      }

      const updated = await setWebsiteRequestStatus(requestId, data.status);
      if (!updated) {
        return {
          ok: false as const,
          error: "Aanvraag niet gevonden.",
          code: "not_found" as const,
        };
      }

      clearInboxListSnapshotCache();
      await writeStaffAudit({
        actorUserId: session.userId ?? null,
        action: data.status === "closed" ? "website_request.resolved" : "website_request.reopened",
        targetType: "website_request",
        targetId: updated.id,
        before: { status: existing.status },
        after: { status: updated.status },
        metadata: { requestNumber: updated.number, inboxMessageId: data.id },
      });

      return {
        ok: true as const,
        lifecycleStatus: updated.status,
        requestId: updated.id,
      };
    } catch (error) {
      if (error instanceof AdminAuthError && error.message.includes("Te veel")) {
        return { ok: false as const, error: error.message, code: "rate_limit" as const };
      }
      return authErrorResult(error);
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
      if (message.lifecycleStatus === "closed") {
        return {
          ok: false as const,
          error: "Heropen de afgeronde aanvraag voordat u een nieuw antwoord verstuurt.",
          code: "validation" as const,
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

      // Prefer Graph createReply against the latest inbound / root Graph message.
      // The parent must be from this request's own submitter (or the form
      // notification): createReply inherits the parent's quoted body and inline
      // attachments, so replying to any other message would send that message's
      // content to this customer.
      let inboxMessageIdForReply = data.id;
      try {
        const decoded = decodeInboxMessageId(data.id);
        if (decoded.provider === "request" || decoded.provider === "e2e") {
          const mailRows = await listWebsiteRequestMailMessages(decoded.requestId);
          const submitter = message.submitterEmail.trim().toLowerCase();
          const parent =
            [...mailRows]
              .reverse()
              .find(
                (row) =>
                  row.direction === "inbound" &&
                  Boolean(row.graph_message_id) &&
                  (row.sender_address || "").trim().toLowerCase() === submitter,
              ) ??
            mailRows.find(
              (row) => row.provider === "website_form" && Boolean(row.graph_message_id),
            );
          if (parent?.graph_message_id) {
            inboxMessageIdForReply = encodeGraphMessageId(
              parent.graph_message_id,
              parent.mailbox || "info@mccoy.nl",
            );
          }
        }
      } catch {
        /* keep original id */
      }

      const sent = await sendAdminReplyEmail({
        to: message.submitterEmail,
        subject,
        body: data.body,
        requestNumber,
        inReplyTo: message.messageId ?? undefined,
        inboxMessageId: inboxMessageIdForReply,
      });

      if (!sent.ok) {
        return { ok: false as const, error: sent.error, code: "provider" as const };
      }

      // Persist staff reply + Graph/RFC identity on the website request inquiry.
      if (message.requestNumber) {
        try {
          const matches = await listWebsiteRequests({ q: message.requestNumber });
          const match = matches.find((item) => item.number === message.requestNumber);
          if (match) {
            await appendWebsiteRequestReply(
              match.id,
              {
                body: data.body,
                sentAt: sent.sentAt ?? new Date().toISOString(),
                sentBy: session.username,
                toEmail: message.submitterEmail,
                resendId: sent.internetMessageId ?? sent.resendId ?? sent.messageId,
              },
              "replied",
            );
            const graphMailbox =
              getGraphMailConfig()?.mailbox ||
              process.env.GRAPH_MAILBOX ||
              process.env.FORM_TO_EMAIL ||
              "";
            await upsertWebsiteRequestMailMessage({
              requestId: match.id,
              direction: "outbound",
              provider: sent.usedGraphReply || sent.graphMessageId ? "microsoft_graph" : "smtp",
              mailbox: graphMailbox,
              graphMessageId: sent.graphMessageId ?? null,
              internetMessageId: sent.internetMessageId ?? sent.messageId ?? null,
              conversationId: sent.conversationId ?? null,
              inReplyTo: message.messageId ?? null,
              senderAddress: graphMailbox || null,
              recipientAddresses: [message.submitterEmail],
              subject,
              bodyText: data.body,
              occurredAt: sent.sentAt ?? new Date().toISOString(),
              isRead: true,
            });
          }
        } catch (persistError) {
          console.error("[admin-requests] failed to persist inbox reply", {
            requestNumber: message.requestNumber,
            message: persistError instanceof Error ? persistError.message.slice(0, 160) : "unknown",
          });
        }
      }

      return {
        ok: true as const,
        toEmail: message.submitterEmail,
        resendId: sent.resendId,
        graphMessageId: sent.graphMessageId,
        internetMessageId: sent.internetMessageId,
        conversationId: sent.conversationId,
        usedGraphReply: sent.usedGraphReply,
        identityPending: sent.identityPending ?? false,
      };
    } catch (error) {
      if (error instanceof AdminAuthError && error.message.includes("Te veel")) {
        return { ok: false as const, error: error.message, code: "rate_limit" as const };
      }
      return inboxErrorResult(error);
    }
  });

export const deleteAdminFormInboxMessage = createServerFn({ method: "POST" })
  .validator(adminInboxMessageIdSchema)
  .handler(async ({ data }) => {
    try {
      ensureInboxEnv();
      const session = await requireAdminSession();
      assertReplyRateLimit(session.username);

      if (!isFormInboxConfigured()) {
        return {
          ok: false as const,
          error: formInboxConfigHelpMessage(),
          code: "config" as const,
        };
      }

      await deleteFormInboxMessage(data.id);
      return { ok: true as const };
    } catch (error) {
      if (error instanceof AdminAuthError && error.message.includes("Te veel")) {
        return { ok: false as const, error: error.message, code: "rate_limit" as const };
      }
      return inboxErrorResult(error);
    }
  });

export const bulkDeleteAdminFormInboxMessages = createServerFn({ method: "POST" })
  .validator(adminInboxBulkDeleteSchema)
  .handler(async ({ data }) => {
    try {
      ensureInboxEnv();
      const session = await requireAdminSession();
      assertReplyRateLimit(session.username);

      if (!isFormInboxConfigured()) {
        return {
          ok: false as const,
          error: formInboxConfigHelpMessage(),
          code: "config" as const,
          requestedCount: data.ids.length,
          deletedCount: 0,
          alreadyAbsentCount: 0,
          failedCount: data.ids.length,
          deletedIds: [] as string[],
          failures: data.ids.map((id) => ({ id, error: formInboxConfigHelpMessage() })),
          results: data.ids.map((messageId) => ({
            messageId,
            status: "failed" as const,
            errorCode: "config",
          })),
        };
      }

      const bulk = await bulkDeleteFormInboxMessages(data.ids);
      const deletedIds = bulk.results
        .filter((r) => r.status === "deleted" || r.status === "already_absent")
        .map((r) => r.messageId);
      const failures = bulk.results
        .filter((r) => r.status === "failed")
        .map((r) => ({ id: r.messageId, error: r.error ?? "Verwijderen mislukt." }));

      console.info("[admin-requests] bulk delete", {
        operation: "bulkDeleteAdminFormInboxMessages",
        requestedCount: bulk.requestedCount,
        deletedCount: bulk.deletedCount,
        alreadyAbsentCount: bulk.alreadyAbsentCount,
        failedCount: bulk.failedCount,
        chunkCount: bulk.metrics?.chunkCount,
        graphRequestCount: bulk.metrics?.graphRequestCount,
        durationMs: bulk.metrics?.durationMs,
      });

      if (bulk.deletedCount + bulk.alreadyAbsentCount === 0) {
        return {
          ok: false as const,
          error: bulkDeleteFailureMessage(0, failures),
          code: "provider" as const,
          requestedCount: bulk.requestedCount,
          deletedCount: 0,
          alreadyAbsentCount: 0,
          failedCount: bulk.failedCount,
          deletedIds: [] as string[],
          failures,
          results: bulk.results,
        };
      }

      return {
        ok: true as const,
        requestedCount: bulk.requestedCount,
        deletedCount: bulk.deletedCount + bulk.alreadyAbsentCount,
        alreadyAbsentCount: bulk.alreadyAbsentCount,
        failedCount: bulk.failedCount,
        deletedIds,
        failures,
        results: bulk.results,
        ...(failures.length > 0
          ? {
              partial: true as const,
              error: bulkDeleteFailureMessage(
                bulk.deletedCount + bulk.alreadyAbsentCount,
                failures,
              ),
            }
          : {}),
      };
    } catch (error) {
      if (error instanceof AdminAuthError && error.message.includes("Te veel")) {
        return {
          ok: false as const,
          error: error.message,
          code: "rate_limit" as const,
          requestedCount: data.ids.length,
          deletedCount: 0,
          alreadyAbsentCount: 0,
          failedCount: data.ids.length,
          deletedIds: [] as string[],
          failures: data.ids.map((id) => ({ id, error: error.message })),
          results: data.ids.map((messageId) => ({
            messageId,
            status: "failed" as const,
            errorCode: "rate_limit",
          })),
        };
      }
      const mapped = inboxErrorResult(error);
      if (mapped && typeof mapped === "object" && "error" in mapped) {
        return {
          ok: false as const,
          error: mapped.error,
          code: "code" in mapped ? mapped.code : ("provider" as const),
          requestedCount: data.ids.length,
          deletedCount: 0,
          alreadyAbsentCount: 0,
          failedCount: data.ids.length,
          deletedIds: [] as string[],
          failures: data.ids.map((id) => ({ id, error: mapped.error })),
          results: data.ids.map((messageId) => ({
            messageId,
            status: "failed" as const,
            errorCode: "provider",
          })),
        };
      }
      throw error;
    }
  });
