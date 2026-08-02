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

function websiteRequestToMessage(request: WebsiteRequest): FormInboxMessage {
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
    thread: [root, ...replies],
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
  const facets = buildInboxFacets(messages);
  const filtered = filterInboxMessages(messages, {
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
  return websiteRequestToMessage(request);
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
  await setWebsiteRequestStatus(request.id, "closed");
}
