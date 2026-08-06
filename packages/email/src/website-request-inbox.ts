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
import { FormInboxError } from "./form-inbox-contracts";
import { mergeMailboxAndWebsiteRequestSummaries } from "./enrich-inbox-scopes";
import {
  buildInboxFacets,
  filterInboxMessages,
  type InboxFacets,
  type InboxListFilters,
} from "./filter-inbox-messages";
import {
  decodeInboxMessageId,
  encodeRequestMessageId,
  graphIdToSyntheticUid,
} from "./inbox-message-id";
import type { ParsedFormField } from "./parse-form-fields";
import { escapeHtml } from "./templates";
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
  return {
    id,
    uid: graphIdToSyntheticUid(request.id),
    kind: request.kind,
    subject: `${request.subject} (${request.number})`,
    from: request.submitterEmail
      ? `${request.submitterName} <${request.submitterEmail}>`
      : request.submitterName,
    to: "info@mccoy.nl",
    date: request.createdAt,
    snippet: snippetFrom(request),
    unread: request.status === "new",
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

export async function getWebsiteRequestFormInboxMessage(
  id: string,
): Promise<FormInboxMessage | null> {
  const decoded = decodeInboxMessageId(id);
  if (decoded.provider !== "request" && decoded.provider !== "e2e") return null;
  const request = await getWebsiteRequest(decoded.requestId);
  if (!request || !isActiveRequestStatus(request.status)) return null;

  // Pull Graph conversation into mail_messages so applicant replies appear in Gesprek.
  // List-time ingest alone misses replies that arrive while the detail panel is open.
  try {
    const { syncWebsiteRequestGraphThread } = await import("./sync-request-graph-thread");
    await syncWebsiteRequestGraphThread(decoded.requestId);
  } catch (error) {
    console.error("[website-request-inbox] graph thread sync failed", {
      requestId: decoded.requestId,
      message: error instanceof Error ? error.message.slice(0, 160) : "unknown",
    });
  }

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
    mailMessages = await listWebsiteRequestMailMessages(decoded.requestId);
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
  const message = await getWebsiteRequestFormInboxMessage(id);
  return message?.thread ?? [];
}

export async function getWebsiteRequestFormInboxAttachment(): Promise<FormInboxAttachment | null> {
  // Binary bodies are not retained on the request row — meta only in list/detail.
  return null;
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
