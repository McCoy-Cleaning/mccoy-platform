/**
 * Deterministic Aanvragen inbox for MCCOY_E2E=1.
 * Maps persisted website-requests (JSON store) to FormInbox contracts.
 * Does not mock form submit / CMS publish — only the mailbox read path.
 */
import type { WebsiteRequest } from "@mccoy/domain";
import { FIELD_LABELS_NL } from "@mccoy/domain";
import {
  getWebsiteRequest,
  listWebsiteRequests,
} from "@mccoy/database/server";

import type {
  FormInboxAttachment,
  FormInboxMessage,
  FormInboxMessageSummary,
  FormInboxThreadItem,
} from "./form-inbox-contracts";
import {
  buildInboxFacets,
  filterInboxMessages,
  type InboxFacets,
  type InboxListFilters,
} from "./filter-inbox-messages";
import {
  encodeE2eMessageId,
  graphIdToSyntheticUid,
} from "./inbox-message-id";
import type { ParsedFormField } from "./parse-form-fields";

const E2E_MAILBOX = "website-requests";

export function isE2eFormInboxEnabled(): boolean {
  return process.env.MCCOY_E2E === "1";
}

function fieldsToParsed(fields: Record<string, string>): ParsedFormField[] {
  return Object.entries(fields)
    .filter(([, value]) => typeof value === "string" && value.trim().length > 0)
    .map(([key, value]) => ({
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

function snippetFrom(request: WebsiteRequest): string {
  const msg = request.fields.message?.trim() || request.fields.motivation?.trim();
  if (msg) return msg.slice(0, 160);
  return `${request.submitterName} · ${request.number}`;
}

export function websiteRequestToSummary(request: WebsiteRequest): FormInboxMessageSummary {
  const id = encodeE2eMessageId(request.id, E2E_MAILBOX);
  return {
    id,
    uid: graphIdToSyntheticUid(request.id),
    kind: request.kind,
    subject: `${request.subject} (${request.number})`,
    from: request.submitterEmail
      ? `${request.submitterName} <${request.submitterEmail}>`
      : request.submitterName,
    to: "e2e@mccoy.local",
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

function websiteRequestToMessage(request: WebsiteRequest): FormInboxMessage {
  const summary = websiteRequestToSummary(request);
  const fields = fieldsToParsed(request.fields);
  const textBody = [
    `Aanvraag ${request.number}`,
    `Soort: ${request.kind}`,
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
    messageId: `<${request.id}@e2e.mccoy.local>`,
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
      .map((line) => `<p>${line.replace(/</g, "&lt;")}</p>`)
      .join(""),
    replyToHeader: request.submitterEmail || null,
    messageId: root.messageId,
    fields,
    attachments: attachmentMeta(request),
    thread: [root, ...replies],
  };
}

export async function listE2eFormInboxMessages(
  options?: InboxListFilters & { limit?: number },
): Promise<{ items: FormInboxMessageSummary[]; facets: InboxFacets }> {
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const summaries = await listWebsiteRequests({
    kind: options?.kind ?? "all",
    status: "all",
    q: options?.q,
    scopeKey: options?.scopeKey,
  });

  // listWebsiteRequests returns summaries — hydrate for full field parity where needed
  const messages: FormInboxMessageSummary[] = [];
  for (const summary of summaries) {
    const full = await getWebsiteRequest(summary.id);
    if (!full) continue;
    messages.push(websiteRequestToSummary(full));
  }

  messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const facets = buildInboxFacets(messages);
  const filtered = filterInboxMessages(messages, {
    kind: options?.kind,
    scopeKey: options?.scopeKey,
    q: options?.q,
  });
  return { items: filtered.slice(0, limit), facets };
}

export async function getE2eFormInboxMessage(id: string): Promise<FormInboxMessage | null> {
  const { decodeInboxMessageId } = await import("./inbox-message-id");
  const decoded = decodeInboxMessageId(id);
  if (decoded.provider !== "e2e") return null;
  const request = await getWebsiteRequest(decoded.requestId);
  if (!request) return null;
  return websiteRequestToMessage(request);
}

export async function getE2eFormInboxThread(id: string): Promise<FormInboxThreadItem[]> {
  const message = await getE2eFormInboxMessage(id);
  return message?.thread ?? [];
}

export async function getE2eFormInboxAttachment(
  _id: string,
  _filename: string,
): Promise<FormInboxAttachment | null> {
  // Binary bodies are not retained in the JSON request store — meta only.
  return null;
}
