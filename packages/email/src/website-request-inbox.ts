/**
 * Aanvragen items backed by persisted website_requests.
 * Used in production (and E2E) so submissions stay visible even when the
 * mailbox copy is missing, delayed, or the CMS form was deleted.
 */
import type { WebsiteRequest, WebsiteRequestSummary } from "@mccoy/domain";
import { displayFormFields, FIELD_LABELS_NL } from "@mccoy/domain";
import {
  getWebsiteRequest,
  listWebsiteRequests,
  setWebsiteRequestStatus,
} from "@mccoy/database/server";

import type {
  FormInboxAttachment,
  FormInboxMessage,
  FormInboxMessageSummary,
  FormInboxThreadItem,
} from "./form-inbox-contracts";
import { FormInboxConfigError, FormInboxError } from "./form-inbox-contracts";
import { mergeMailboxAndWebsiteRequestSummaries } from "./enrich-inbox-scopes";
import {
  buildInboxFacets,
  filterInboxMessages,
  type InboxFacets,
  type InboxListFilters,
} from "./filter-inbox-messages";
import {
  decodeInboxMessageId,
  encodeGraphMessageId,
  encodeRequestMessageId,
  graphIdToSyntheticUid,
  splitWebsiteRequestInboxTarget,
} from "./inbox-message-id";
import type { ParsedFormField } from "./parse-form-fields";
import { escapeHtml } from "./templates";
import { isRejectedReplyAttachment } from "./form-inbox-attachment";
import {
  dedupeInquiryThreadItems,
  normaliseThreadMessageBody,
  outboundMailDuplicatesStaffReply,
} from "./inquiry-thread-dedupe";

export { mergeMailboxAndWebsiteRequestSummaries };

const REQUEST_MAILBOX = "website-requests";

function fieldsToParsed(fields: Record<string, string>): ParsedFormField[] {
  return Object.entries(displayFormFields(fields)).map(([key, value]) => ({
    key,
    label: FIELD_LABELS_NL[key as keyof typeof FIELD_LABELS_NL] ?? key,
    value,
  }));
}

function attachmentMeta(request: WebsiteRequest): FormInboxAttachment[] {
  return request.attachments.map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    size: a.sizeBytes,
    omitted: true,
  }));
}

function snippetFrom(request: WebsiteRequest | WebsiteRequestSummary): string {
  if ("fields" in request && request.fields) {
    const msg =
      request.fields.message?.trim() || request.fields.motivation?.trim();
    if (msg) return msg.slice(0, 160);
  }
  return `${request.submitterName} · ${request.number}`;
}

export function websiteRequestSummaryToInboxSummary(
  request: WebsiteRequest | WebsiteRequestSummary,
): FormInboxMessageSummary {
  const id = encodeRequestMessageId(request.id, REQUEST_MAILBOX);
  // new = never handled; open = customer replied / needs attention (after staff reply cycle).
  const unread = request.status === "new" || request.status === "open";
  return {
    id,
    uid: graphIdToSyntheticUid(request.id),
    kind: request.kind,
    subject: `${request.subject} (${request.number})`,
    from: request.submitterEmail
      ? `${request.submitterName} <${request.submitterEmail}>`
      : request.submitterName,
    to: "info@mccoy.nl",
    date: request.updatedAt || request.createdAt,
    snippet: snippetFrom(request),
    unread,
    submitterName: request.submitterName || null,
    submitterEmail: request.submitterEmail || null,
    requestNumber: request.number,
    scopeKey: request.scopeKey,
    scopeLabel: request.scopeLabel,
  };
}

/** @deprecated alias — prefer websiteRequestSummaryToInboxSummary */
export const websiteRequestToSummary = websiteRequestSummaryToInboxSummary;

function websiteRequestToMessage(
  request: WebsiteRequest,
  mailMessages: Array<{
    id: string;
    direction: "inbound" | "outbound";
    provider?: string;
    sender_address: string | null;
    recipient_addresses: string[] | null;
    subject: string | null;
    body_text: string | null;
    occurred_at: string;
    internet_message_id: string | null;
    graph_message_id: string | null;
  }> = [],
): FormInboxMessage {
  const summary = websiteRequestSummaryToInboxSummary(request);
  const fields = fieldsToParsed(request.fields);
  const textBody = [
    `Aanvraag ${request.number}`,
    `Soort: ${request.kind}`,
    ...(request.scopeLabel ? [`Scope: ${request.scopeLabel}`] : []),
    ...fields.map((f) => `${f.label}: ${f.value}`),
  ].join("\n");

  const root: FormInboxThreadItem = {
    id: summary.id,
    uid: summary.uid,
    direction: "form",
    from: summary.from,
    to: summary.to,
    date: summary.date,
    subject: summary.subject,
    textBody,
    messageId: `<${request.id}@mccoy.website-request>`,
    attachments: attachmentMeta(request),
  };

  const replies: FormInboxThreadItem[] = request.replies.map((reply, index) => ({
    id: `${summary.id}:reply:${reply.id}`,
    uid: summary.uid + index + 1,
    direction: "admin" as const,
    from: reply.sentBy,
    to: reply.toEmail,
    date: reply.sentAt,
    subject: `Re: ${request.subject}`,
    textBody: reply.body,
    messageId: reply.resendId ?? null,
    attachments: [],
  }));

  const fromMail: FormInboxThreadItem[] = [];
  mailMessages.forEach((row, index) => {
    // Form-notification identity rows must not appear as "Klant" in Gesprek —
    // structured fields already render above the thread.
    if (row.provider === "website_form") return;

    const isOutbound = row.direction === "outbound";
    if (isOutbound && outboundMailDuplicatesStaffReply(row, request.replies)) {
      return;
    }
    fromMail.push({
      id: `${summary.id}:mail:${row.id}`,
      uid: summary.uid + 1000 + index,
      direction: isOutbound ? "admin" : "customer",
      from: row.sender_address || (isOutbound ? "McCoy" : summary.from),
      to: (row.recipient_addresses ?? []).join(", ") || (isOutbound ? summary.from : summary.to),
      date: row.occurred_at,
      subject: row.subject || `Re: ${request.subject}`,
      textBody: normaliseThreadMessageBody(
        row.body_text || "",
        isOutbound ? "outbound" : "inbound",
      ),
      messageId: row.internet_message_id,
      attachments: [],
    });
  });

  const thread = dedupeInquiryThreadItems(
    [root, ...replies, ...fromMail].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    ),
  );

  return {
    ...summary,
    textBody,
    htmlSafePreview: textBody
      .split("\n")
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join(""),
    replyToHeader: request.submitterEmail || null,
    messageId: root.messageId,
    fields,
    attachments: attachmentMeta(request),
    thread,
  };
}

function isActiveRequestStatus(status: WebsiteRequestSummary["status"]): boolean {
  return status !== "closed" && status !== "spam";
}

export async function listWebsiteRequestInboxSummaries(
  options?: InboxListFilters & { limit?: number },
): Promise<FormInboxMessageSummary[]> {
  const limit = Math.min(Math.max(options?.limit ?? 80, 1), 200);
  const rows = await listWebsiteRequests({
    kind: options?.kind ?? "all",
    status: "all",
    q: options?.q,
    scopeKey: options?.scopeKey === "all" ? undefined : options?.scopeKey,
  });

  return rows
    .filter((row) => isActiveRequestStatus(row.status))
    .slice(0, limit)
    .map((row) => websiteRequestSummaryToInboxSummary(row));
}

export async function listWebsiteRequestFormInboxMessages(
  options?: InboxListFilters & { limit?: number },
): Promise<{ items: FormInboxMessageSummary[]; facets: InboxFacets }> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const messages = await listWebsiteRequestInboxSummaries({ ...options, limit: 200 });
  messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const { withActivePublishedScopesCleared } = await import("./apply-active-form-scopes");
  const scoped = await withActivePublishedScopesCleared(messages);
  const facets = buildInboxFacets(scoped);
  const filtered = filterInboxMessages(scoped, {
    kind: options?.kind,
    scopeKey: options?.scopeKey,
    q: options?.q,
  });
  return { items: filtered.slice(0, limit), facets };
}


type WebsiteRequestMailRow = {
  id: string;
  direction: "inbound" | "outbound";
  provider?: string;
  mailbox?: string | null;
  sender_address: string | null;
  recipient_addresses: string[] | null;
  subject: string | null;
  body_text: string | null;
  occurred_at: string;
  internet_message_id: string | null;
  graph_message_id: string | null;
};

function sameRfcMessageId(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = (a || "").replace(/[<>\s]/g, "").toLowerCase();
  const right = (b || "").replace(/[<>\s]/g, "").toLowerCase();
  return Boolean(left && right && left === right);
}

/**
 * Attach Graph file metadata to Gesprek bubbles. Download uses graph: ids so
 * /$value hits the reply message, not the original form notification.
 * Mailbox copies are only read — never deleted or rewritten.
 */
export async function hydrateWebsiteRequestThreadAttachments(
  thread: FormInboxThreadItem[],
  mailRows: WebsiteRequestMailRow[],
  fallbackMailbox: string,
): Promise<FormInboxThreadItem[]> {
  if (thread.length === 0 || mailRows.length === 0) return thread;

  const { listGraphFormInboxAttachments } = await import("./graph-mail");
  const next = thread.map((item) => ({ ...item, attachments: item.attachments.slice() }));

  for (const row of mailRows) {
    if (row.provider === "website_form") continue;
    const graphId = row.graph_message_id?.trim();
    if (!graphId) continue;
    const mailbox = (row.mailbox || fallbackMailbox).trim() || fallbackMailbox;

    let attachments: FormInboxAttachment[] = [];
    try {
      attachments = (await listGraphFormInboxAttachments(graphId, mailbox)).filter(
        (item) => !isRejectedReplyAttachment(item),
      );
    } catch {
      continue;
    }
    if (attachments.length === 0) continue;

    const graphInboxId = encodeGraphMessageId(graphId, mailbox);
    const mailSuffix = `:mail:${row.id}`;
    let index = next.findIndex((item) => item.id.endsWith(mailSuffix));
    if (index < 0 && row.internet_message_id) {
      index = next.findIndex((item) => sameRfcMessageId(item.messageId, row.internet_message_id));
    }
    if (index < 0 && row.direction === "outbound") {
      index = next.findIndex(
        (item) =>
          item.direction === "admin" &&
          outboundMailDuplicatesStaffReply(row, [
            {
              resendId: item.messageId ?? undefined,
              body: item.textBody,
              sentAt: item.date,
              toEmail: item.to,
            },
          ]),
      );
    }
    if (index < 0) continue;

    const existing = next[index]!;
    if (existing.direction === "form") continue;
    next[index] = {
      ...existing,
      id: graphInboxId,
      attachments,
    };
  }

  return next;
}

export async function getWebsiteRequestFormInboxMessage(
  id: string,
): Promise<FormInboxMessage | null> {
  const decoded = decodeInboxMessageId(id);
  if (decoded.provider !== "request" && decoded.provider !== "e2e") return null;
  const { requestId } = splitWebsiteRequestInboxTarget(decoded.requestId);
  const request = await getWebsiteRequest(requestId);
  if (!request || !isActiveRequestStatus(request.status)) return null;

  // DB-only open path — Graph sync runs in getWebsiteRequestFormInboxThread so
  // the root message paints without waiting on Microsoft Graph.
  let mailMessages: Array<{
    id: string;
    direction: "inbound" | "outbound";
    provider: string;
    sender_address: string | null;
    recipient_addresses: string[] | null;
    subject: string | null;
    body_text: string | null;
    occurred_at: string;
    internet_message_id: string | null;
    graph_message_id: string | null;
  }> = [];
  try {
    const { listWebsiteRequestMailMessages } = await import("@mccoy/database/server");
    mailMessages = await listWebsiteRequestMailMessages(requestId);
  } catch {
    mailMessages = [];
  }

  const message = websiteRequestToMessage(request, mailMessages);
  const { withActivePublishedScopeCleared } = await import("./apply-active-form-scopes");
  return withActivePublishedScopeCleared(message);
}

export async function getWebsiteRequestFormInboxThread(
  id: string,
): Promise<FormInboxThreadItem[]> {
  const decoded = decodeInboxMessageId(id);
  if (decoded.provider !== "request" && decoded.provider !== "e2e") return [];
  const { requestId } = splitWebsiteRequestInboxTarget(decoded.requestId);

  // Pull Graph conversation into mail_messages so applicant replies appear in Gesprek.
  try {
    const { syncWebsiteRequestGraphThread } = await import("./sync-request-graph-thread");
    await syncWebsiteRequestGraphThread(requestId);
  } catch (error) {
    console.error("[website-request-inbox] graph thread sync failed", {
      requestId,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
  }

  const message = await getWebsiteRequestFormInboxMessage(
    encodeRequestMessageId(requestId, decoded.mailbox),
  );
  const thread = message?.thread ?? [];
  try {
    const { listWebsiteRequestMailMessages } = await import("@mccoy/database/server");
    const { getGraphMailConfig } = await import("./graph-config");
    const rows = await listWebsiteRequestMailMessages(requestId);
    const mailbox = (getGraphMailConfig()?.mailbox || "info@mccoy.nl").trim();
    return hydrateWebsiteRequestThreadAttachments(thread, rows, mailbox);
  } catch (error) {
    console.error("[website-request-inbox] reply attachment hydrate failed", {
      requestId,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
    return thread;
  }
}

export async function getWebsiteRequestFormInboxAttachment(
  id: string,
  filename: string,
): Promise<FormInboxAttachment | null> {
  const decoded = decodeInboxMessageId(id);
  if (decoded.provider !== "request" && decoded.provider !== "e2e") return null;
  const { requestId, mailRowId } = splitWebsiteRequestInboxTarget(decoded.requestId);

  const request = await getWebsiteRequest(requestId);
  if (!request || !isActiveRequestStatus(request.status)) return null;

  const wanted = filename.trim();
  if (!wanted) return null;

  const { attachmentFilenamesMatch } = await import("./form-inbox-attachment");
  const isReplyTarget = Boolean(mailRowId);
  const matched =
    request.attachments.find((item) => attachmentFilenamesMatch(wanted, item.filename)) ??
    (!isReplyTarget && request.attachments.length === 1 ? request.attachments[0] : null);
  const attachmentMeta = matched ?? {
    filename: wanted,
    contentType: "application/octet-stream",
    sizeBytes: 0,
  };

  try {
    const {
      createStoredWebsiteRequestAttachmentAccess,
      getStoredWebsiteRequestAttachment,
      storeWebsiteRequestAttachments,
    } = await import("@mccoy/database/server");

    // Reply files live on Graph conversation messages, not request storage.
    const access = isReplyTarget
      ? null
      : await createStoredWebsiteRequestAttachmentAccess({
      requestId: request.id,
      filename: attachmentMeta.filename,
      storagePath: matched?.storagePath,
    });
    if (access) {
      return {
        filename: attachmentMeta.filename,
        contentType: attachmentMeta.contentType,
        size: access.sizeBytes || attachmentMeta.sizeBytes,
        contentUrl: access.contentUrl,
        downloadUrl: access.downloadUrl,
        urlExpiresAt: access.expiresAt,
        omitted: false,
      };
    }

    // Legacy rows may still have bytes under the request prefix without signed URL support.
    const stored = isReplyTarget
      ? null
      : await getStoredWebsiteRequestAttachment(
      request.id,
      attachmentMeta.filename,
      matched?.storagePath,
    );
    if (stored?.contentBase64) {
      return {
        filename: attachmentMeta.filename,
        contentType: attachmentMeta.contentType,
        size: stored.sizeBytes || attachmentMeta.sizeBytes,
        contentBase64: stored.contentBase64,
        omitted: false,
      };
    }

    const { getGraphMailConfig } = await import("./graph-config");
    const config = getGraphMailConfig();
    if (!config) return null;

    const { listWebsiteRequestMailMessages } = await import("@mccoy/database/server");
    const mailRows = await listWebsiteRequestMailMessages(request.id);
    const formRoot =
      mailRows.find((row) => row.provider === "website_form" && row.graph_message_id?.trim()) ??
      mailRows.find((row) => Boolean(row.graph_message_id?.trim()));

    const {
      getGraphFormInboxAttachment,
      findGraphFormNotificationByRequestNumber,
    } = await import("./graph-mail");

    const downloadGraphFile = async (
      graphMessageId: string,
      box: string,
      persistAsFormFile: boolean,
    ): Promise<FormInboxAttachment | null> => {
      const graphAttachment = await getGraphFormInboxAttachment(
        graphMessageId,
        attachmentMeta.filename,
        box,
        {
          sizeBytes: attachmentMeta.sizeBytes > 0 ? attachmentMeta.sizeBytes : undefined,
          maxBytes: 25 * 1024 * 1024,
        },
      );
      if (!graphAttachment?.contentBase64) return null;
      // Never persist conversation-reply bytes as form uploads.
      if (persistAsFormFile) {
        void storeWebsiteRequestAttachments(request.id, [
          {
            filename: attachmentMeta.filename,
            contentType: graphAttachment.contentType || attachmentMeta.contentType,
            contentBase64: graphAttachment.contentBase64,
          },
        ]).catch(() => undefined);
      }
      return {
        filename: attachmentMeta.filename,
        contentType: graphAttachment.contentType || attachmentMeta.contentType,
        size: graphAttachment.size || attachmentMeta.sizeBytes,
        contentBase64: graphAttachment.contentBase64,
        omitted: false,
        part: graphAttachment.part,
      };
    };

    if (mailRowId) {
      const replyRow = mailRows.find(
        (row) => row.id === mailRowId && Boolean(row.graph_message_id?.trim()),
      );
      if (replyRow?.graph_message_id) {
        const hit = await downloadGraphFile(
          replyRow.graph_message_id.trim(),
          (replyRow.mailbox || config.mailbox).trim() || config.mailbox,
          false,
        );
        if (hit) return hit;
      }
    }

    let graphId = formRoot?.graph_message_id?.trim() || "";
    let mailbox = (formRoot?.mailbox || config.mailbox).trim() || config.mailbox;

    if (!graphId && !isReplyTarget) {
      const found = await findGraphFormNotificationByRequestNumber({
        requestNumber: request.number,
        mailbox: config.mailbox,
        createdAt: request.createdAt,
        filename: attachmentMeta.filename,
        submitterName: request.submitterName,
        submitterEmail: request.submitterEmail,
      });
      if (found?.id) {
        graphId = found.id;
        mailbox = found.mailbox || mailbox;
      }
    }

    if (graphId && !isReplyTarget) {
      const formHit = await downloadGraphFile(graphId, mailbox, true);
      if (formHit) return formHit;
    }

    for (const row of mailRows) {
      if (row.provider === "website_form") continue;
      const replyGraphId = row.graph_message_id?.trim();
      if (!replyGraphId || replyGraphId === graphId) continue;
      const hit = await downloadGraphFile(
        replyGraphId,
        (row.mailbox || config.mailbox).trim() || config.mailbox,
        false,
      );
      if (hit) return hit;
    }

    return null;
  } catch (error) {
    if (error instanceof FormInboxError || error instanceof FormInboxConfigError) {
      throw error;
    }
    console.error("[website-request-inbox] attachment fetch failed", {
      requestId: request.id,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
    return null;
  }
}

/** Soft-delete: close the website request so it leaves Aanvragen. */
export async function deleteWebsiteRequestFormInboxMessage(id: string): Promise<void> {
  const decoded = decodeInboxMessageId(id);
  if (decoded.provider !== "request" && decoded.provider !== "e2e") {
    throw new FormInboxError("Ongeldig berichten-ID.");
  }
  const request = await getWebsiteRequest(decoded.requestId);
  if (!request) {
    throw new FormInboxError("Bericht niet gevonden.");
  }

  const updated = await setWebsiteRequestStatus(request.id, "closed");
  if (!updated) {
    throw new FormInboxError("Aanvraag kon niet worden gesloten.");
  }

  // Best-effort: remove known Graph copies so Vernieuwen cannot resurrect a
  // graph: row for the same WR- number.
  try {
    const { listWebsiteRequestMailMessages } = await import("@mccoy/database/server");
    const { shouldAttemptGraphMail } = await import("./form-inbox-provider");
    const { deleteGraphFormInboxMessage } = await import("./graph-mail");
    const { getGraphMailConfig } = await import("./graph-config");

    if (!shouldAttemptGraphMail()) return;
    const config = getGraphMailConfig();
    if (!config) return;

    const mailRows = await listWebsiteRequestMailMessages(request.id);
    const seen = new Set<string>();
    for (const row of mailRows) {
      const graphId = row.graph_message_id?.trim();
      if (!graphId || seen.has(graphId)) continue;
      seen.add(graphId);
      const mailbox = (row.mailbox || config.mailbox).trim() || config.mailbox;
      try {
        await deleteGraphFormInboxMessage(graphId, mailbox);
      } catch (error) {
        console.warn("[website-request-inbox] Graph copy delete failed", {
          requestId: request.id,
          message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
        });
      }
    }
  } catch (error) {
    console.warn("[website-request-inbox] Graph cleanup after close failed", {
      requestId: request.id,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
  }
}

/**
 * Close the website request correlated with a Graph mailbox message so Aanvragen
 * list suppress hides the WR even if the mailbox move fails.
 * @returns true when an active request was closed
 */
export async function closeWebsiteRequestForGraphMessage(
  graphId: string,
  mailbox?: string,
): Promise<boolean> {
  try {
    const {
      findWebsiteRequestIdByGraphMessageId,
      findWebsiteRequestIdByNumber,
      getWebsiteRequest,
      setWebsiteRequestStatus,
    } = await import("@mccoy/database/server");

    let requestId = await findWebsiteRequestIdByGraphMessageId(graphId);

    if (!requestId) {
      try {
        const { peekGraphMessageRequestNumber } = await import("./graph-mail");
        const number = await peekGraphMessageRequestNumber(graphId, mailbox);
        if (number) {
          requestId = await findWebsiteRequestIdByNumber(number);
        }
      } catch {
        // Best-effort only — mailbox delete may still proceed.
      }
    }

    if (!requestId) return false;

    const request = await getWebsiteRequest(requestId);
    if (!request) return false;
    if (request.status === "closed" || request.status === "spam") return true;

    const updated = await setWebsiteRequestStatus(requestId, "closed");
    return Boolean(updated);
  } catch (error) {
    console.warn("[website-request-inbox] close for Graph message failed", {
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
    return false;
  }
}

/** Close an active website request by WR- number (IMAP / Graph subject match). */
export async function closeWebsiteRequestByNumber(requestNumber: string): Promise<void> {
  const number = requestNumber.trim();
  if (!number) return;
  try {
    const { findWebsiteRequestIdByNumber, getWebsiteRequest, setWebsiteRequestStatus } =
      await import("@mccoy/database/server");
    const requestId = await findWebsiteRequestIdByNumber(number);
    if (!requestId) return;
    const request = await getWebsiteRequest(requestId);
    if (!request || request.status === "closed" || request.status === "spam") return;
    await setWebsiteRequestStatus(requestId, "closed");
  } catch (error) {
    console.warn("[website-request-inbox] close by number failed", {
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
  }
}
