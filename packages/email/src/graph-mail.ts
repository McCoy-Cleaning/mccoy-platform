/**
 * Microsoft Graph mailbox adapter for Admin → Aanvragen.
 * Application permissions (client credentials) against a shared mailbox.
 */
import type { FormKind } from "@mccoy/domain";
import { FIELD_LABELS_NL } from "@mccoy/domain";
import { readServerEnv } from "@mccoy/security";

import {
  classifyFormEmailSubject,
  extractFormScopeKeyFromSubject,
  extractRequestNumber,
  extractSubmitterNameFromSubject,
} from "./classify-form-email";
import { filterInboxMessages, buildInboxFacets, type InboxFacets } from "./filter-inbox-messages";
import {
  FormInboxError,
  type FormInboxAttachment,
  type FormInboxMessage,
  type FormInboxMessageSummary,
  type FormInboxThreadItem,
} from "./form-inbox-contracts";
import { getGraphAccessToken } from "./graph-auth";
import { getGraphMailConfig, type GraphMailConfig } from "./graph-config";
import { formatGraphApiError } from "./graph-errors";
import {
  encodeGraphMessageId,
  graphIdToSyntheticUid,
} from "./inbox-message-id";
import {
  normalizeFormFieldLabel,
  parseFormFieldsFromHtml,
  parseFormFieldsFromText,
  type ParsedFormField,
} from "./parse-form-fields";
import { escapeHtml } from "./templates";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 80;
const MAX_THREAD_MESSAGES = 12;
const MAX_ATTACHMENT_BYTES = 3.5 * 1024 * 1024;
const MAX_ATTACHMENTS = 8;
const LIST_PAGE_SIZE = 50;
const LIST_MAX_PAGES = 4;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

type GraphEmailAddress = {
  name?: string | null;
  address?: string | null;
};

type GraphRecipient = {
  emailAddress?: GraphEmailAddress | null;
};

type GraphMessage = {
  id?: string;
  subject?: string | null;
  bodyPreview?: string | null;
  receivedDateTime?: string | null;
  isRead?: boolean;
  hasAttachments?: boolean;
  internetMessageId?: string | null;
  conversationId?: string | null;
  from?: GraphRecipient | null;
  replyTo?: GraphRecipient[] | null;
  toRecipients?: GraphRecipient[] | null;
  body?: { contentType?: string | null; content?: string | null } | null;
};

type GraphAttachment = {
  id?: string;
  name?: string | null;
  contentType?: string | null;
  size?: number | null;
  contentBytes?: string | null;
  "@odata.type"?: string;
  isInline?: boolean | null;
};

type GraphListResponse<T> = {
  value?: T[];
  "@odata.nextLink"?: string;
};

function extractEmail(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] || raw).trim().toLowerCase();
}

function configuredFromAddress(): string {
  const candidates = [
    readServerEnv("FORM_FROM_EMAIL"),
    readServerEnv("SMTP_FROM_EMAIL"),
    readServerEnv("SMTP_USER"),
    readServerEnv("FORM_INBOX_USER"),
    readServerEnv("GRAPH_MAILBOX"),
  ];
  for (const raw of candidates) {
    const email = extractEmail(raw);
    if (email && EMAIL_RE.test(email)) return email;
  }
  return "";
}

function configuredFromDisplayName(): string {
  return (readServerEnv("SMTP_FROM_NAME") || "McCoy Website").trim();
}

function recipientAddress(r: GraphRecipient | null | undefined): string | null {
  const address = r?.emailAddress?.address?.trim().toLowerCase();
  if (address && EMAIL_RE.test(address)) return address;
  return null;
}

function recipientName(r: GraphRecipient | null | undefined): string {
  return r?.emailAddress?.name?.trim() || "";
}

function formatRecipient(r: GraphRecipient | null | undefined): string {
  const name = recipientName(r);
  const address = recipientAddress(r);
  if (name && address) return `${name} <${address}>`;
  return address || name || "";
}

function formatRecipients(list: GraphRecipient[] | null | undefined): string {
  if (!list?.length) return "";
  return list.map(formatRecipient).filter(Boolean).join(", ");
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/(div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function bodyPlainFromGraph(msg: GraphMessage): { text: string; html: string } {
  const content = msg.body?.content ?? "";
  const type = (msg.body?.contentType || "").toLowerCase();
  if (type === "html") {
    return { text: stripHtmlToText(content), html: content };
  }
  if (type === "text") {
    return { text: content.trim(), html: "" };
  }
  if (content.includes("<") && content.includes(">")) {
    return { text: stripHtmlToText(content), html: content };
  }
  return { text: content.trim() || (msg.bodyPreview || "").trim(), html: "" };
}

function makeSnippet(text: string, max = 160): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

function sanitizeParsedFields(fields: ParsedFormField[]): ParsedFormField[] {
  const out: ParsedFormField[] = [];
  for (const field of fields) {
    const label = normalizeFormFieldLabel(field.label);
    if (!label) continue;
    const value = field.value.replace(/\s+/g, " ").trim();
    if (!value) continue;
    const key =
      Object.entries(FIELD_LABELS_NL).find(([, v]) => v === label)?.[0] ?? field.key;
    if (out.some((f) => f.key === key)) continue;
    out.push({ key, label, value });
  }
  return out;
}

function parseFieldsFromParts(text: string, html: string): ParsedFormField[] {
  const fromHtml = sanitizeParsedFields(parseFormFieldsFromHtml(html));
  if (fromHtml.length > 0) return fromHtml;
  return sanitizeParsedFields(parseFormFieldsFromText(text || stripHtmlToText(html)));
}

/**
 * Detect McCoy website form notification messages (same rules as IMAP path).
 * Exported for unit tests.
 */
export function isMcCoyWebsiteFormNotificationGraph(input: {
  fromName: string;
  fromAddress: string;
  text: string;
  html: string;
}): boolean {
  const fromName = input.fromName.toLowerCase();
  const fromAddr = input.fromAddress.toLowerCase();
  const configured = configuredFromAddress();
  const configuredName = configuredFromDisplayName().toLowerCase();

  if (fromName.includes("mccoy website")) return true;
  if (configuredName && fromName.includes(configuredName)) return true;
  if (configured && fromAddr === configured) return true;
  if (fromAddr.endsWith("@resend.dev") && fromName.includes("mccoy")) return true;

  if (
    /verstuurd via het mccoy websiteformulier/i.test(input.html) ||
    /verstuurd via het mccoy websiteformulier/i.test(input.text) ||
    /sent from the mccoy website form/i.test(input.html) ||
    /sent from the mccoy website form/i.test(input.text)
  ) {
    return true;
  }

  return false;
}

function extractEmailFromText(value: string | undefined | null): string | null {
  if (!value) return null;
  const labeled = value.match(
    /(?:e-?mail|reply-?to|afzender|contact)\s*[:|]?\s*<?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?/i,
  );
  if (labeled?.[1]) return labeled[1].toLowerCase();
  const plain = value.match(EMAIL_RE);
  return plain ? plain[0].toLowerCase() : null;
}

export function resolveSubmitterEmailGraph(
  msg: {
    replyTo?: GraphRecipient[] | null;
    from?: GraphRecipient | null;
  },
  fields: ParsedFormField[],
  textBody: string,
  inboxUser: string,
): string | null {
  const replyTo = recipientAddress(msg.replyTo?.[0]);
  if (replyTo) return replyTo;

  const emailField = fields.find((f) => f.key === "email");
  if (emailField && EMAIL_RE.test(emailField.value)) {
    return emailField.value.trim().toLowerCase();
  }

  const fromBody = extractEmailFromText(textBody);
  if (fromBody && fromBody !== inboxUser.toLowerCase()) return fromBody;

  const from = recipientAddress(msg.from);
  if (from && from !== inboxUser.toLowerCase()) return from;

  return null;
}

function resolveSubmitterName(
  subject: string,
  fields?: ParsedFormField[],
): string | null {
  const fromFields = fields?.find((f) => f.key === "name")?.value.trim();
  if (fromFields && fromFields.length <= 120) return fromFields;
  return extractSubmitterNameFromSubject(subject);
}

function formMessageSnippet(
  fields: ParsedFormField[],
  textBody: string,
  subject: string,
): string {
  const message = fields
    .find((f) => f.key === "message" || f.key === "motivation")
    ?.value.trim();
  if (message) return makeSnippet(message);
  const useful = fields
    .filter((f) => f.key !== "name" && f.key !== "email")
    .map((f) => `${f.label}: ${f.value}`)
    .join(" · ");
  if (useful) return makeSnippet(useful);
  return makeSnippet(textBody || subject);
}

async function graphFetch<T>(
  pathOrUrl: string,
  init?: RequestInit & { accessToken?: string },
): Promise<T> {
  const config = getGraphMailConfig();
  if (!config) {
    throw new FormInboxError("Microsoft Graph is niet geconfigureerd.");
  }
  const accessToken = init?.accessToken ?? (await getGraphAccessToken(config));
  const url = pathOrUrl.startsWith("http")
    ? pathOrUrl
    : `${GRAPH_BASE}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;

  const { accessToken: _omit, ...rest } = init ?? {};
  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        ...(rest.headers ?? {}),
      },
      signal: rest.signal ?? AbortSignal.timeout(25_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 160) : "network error";
    console.error("[graph-mail] request failed", { message });
    throw new FormInboxError(`Microsoft Graph-aanvraag mislukt (${message}).`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = null;
    }
  }

  if (!response.ok) {
    const errObj =
      json && typeof json === "object" && "error" in json
        ? (json as { error?: { code?: string; message?: string } }).error
        : undefined;
    const code = errObj?.code || `http_${response.status}`;
    const detail = (errObj?.message || "").slice(0, 220);
    console.error("[graph-mail] API error", {
      status: response.status,
      code,
    });
    throw new FormInboxError(
      formatGraphApiError({
        status: response.status,
        code,
        detail,
        mailbox: config.mailbox,
      }),
    );
  }

  return json as T;
}

function usersPath(mailbox: string, suffix: string): string {
  return `/users/${encodeURIComponent(mailbox)}${suffix}`;
}

function mapAttachmentMeta(att: GraphAttachment): FormInboxAttachment | null {
  const odataType = att["@odata.type"] || "";
  if (odataType.includes("itemAttachment") || odataType.includes("referenceAttachment")) {
    return null;
  }
  if (att.isInline) return null;
  const filename = (att.name || "bijlage").replace(/[^\w.\- ()[\]]+/g, "_");
  const size = typeof att.size === "number" ? att.size : 0;
  const contentType = att.contentType || "application/octet-stream";
  const out: FormInboxAttachment = {
    filename,
    contentType,
    size,
    omitted: true,
    part: att.id,
  };
  if (att.contentBytes && size > 0 && size <= MAX_ATTACHMENT_BYTES) {
    out.contentBase64 = att.contentBytes;
    out.omitted = false;
  }
  return out;
}

function mapAttachments(list: GraphAttachment[] | undefined): FormInboxAttachment[] {
  if (!list?.length) return [];
  const out: FormInboxAttachment[] = [];
  for (const att of list.slice(0, MAX_ATTACHMENTS)) {
    const mapped = mapAttachmentMeta(att);
    if (mapped) out.push(mapped);
  }
  return out;
}

function looksLikeFormCandidate(msg: GraphMessage): boolean {
  const subject = msg.subject || "";
  if (classifyFormEmailSubject(subject)) return true;
  const fromName = recipientName(msg.from);
  const fromAddr = recipientAddress(msg.from) || "";
  return isMcCoyWebsiteFormNotificationGraph({
    fromName,
    fromAddress: fromAddr,
    text: msg.bodyPreview || "",
    html: "",
  });
}

function toSummary(
  msg: GraphMessage,
  mailbox: string,
  fields?: ParsedFormField[],
  textBody?: string,
): FormInboxMessageSummary | null {
  if (!msg.id) return null;
  const subject = (msg.subject || "").trim() || "(geen onderwerp)";
  const kind = classifyFormEmailSubject(subject);
  if (!kind) return null;

  const fromName = recipientName(msg.from);
  const fromAddr = recipientAddress(msg.from) || "";
  const { text, html } = textBody != null
    ? { text: textBody, html: "" }
    : bodyPlainFromGraph(msg);

  const isForm = isMcCoyWebsiteFormNotificationGraph({
    fromName,
    fromAddress: fromAddr,
    text: text || msg.bodyPreview || "",
    html,
  });
  // List path may only have preview — still require kind match; body check when available
  if (textBody != null || html || msg.body?.content) {
    if (!isForm) return null;
  } else if (
    !isForm &&
    !isMcCoyWebsiteFormNotificationGraph({
      fromName,
      fromAddress: fromAddr,
      text: msg.bodyPreview || "",
      html: "",
    })
  ) {
    // Keep subject-classified candidates from our From address / name for list speed
    const configured = configuredFromAddress();
    const configuredName = configuredFromDisplayName().toLowerCase();
    const fromOk =
      (configured && fromAddr === configured) ||
      (configuredName && fromName.toLowerCase().includes(configuredName)) ||
      fromName.toLowerCase().includes("mccoy");
    if (!fromOk) return null;
  }

  const parsedFields = fields ?? [];
  const submitterEmail = resolveSubmitterEmailGraph(
    msg,
    parsedFields,
    text || msg.bodyPreview || "",
    mailbox,
  );

  return {
    id: encodeGraphMessageId(msg.id, mailbox),
    uid: graphIdToSyntheticUid(msg.id),
    kind,
    subject,
    from: formatRecipient(msg.from) || "(onbekend)",
    to: formatRecipients(msg.toRecipients) || mailbox,
    date: msg.receivedDateTime || new Date().toISOString(),
    snippet: formMessageSnippet(parsedFields, text || msg.bodyPreview || "", subject),
    unread: msg.isRead === false,
    submitterName: resolveSubmitterName(subject, parsedFields),
    submitterEmail,
    requestNumber: extractRequestNumber(subject, text || msg.bodyPreview || ""),
    scopeKey: extractFormScopeKeyFromSubject(subject),
    scopeLabel:
      parsedFields.find((f) => f.label.toLowerCase() === "scope")?.value?.trim() || null,
  };
}

function threadDirection(
  from: string | null,
  inboxUser: string,
  submitter: string | null,
): FormInboxThreadItem["direction"] {
  const f = (from || "").toLowerCase();
  if (submitter && f === submitter.toLowerCase()) return "customer";
  if (f === inboxUser.toLowerCase()) return "admin";
  const configured = configuredFromAddress();
  if (configured && f === configured) return "form";
  return "admin";
}

function toThreadItem(
  msg: GraphMessage,
  mailbox: string,
  submitter: string | null,
): FormInboxThreadItem | null {
  if (!msg.id) return null;
  const { text } = bodyPlainFromGraph(msg);
  const fromAddr = recipientAddress(msg.from);
  return {
    id: encodeGraphMessageId(msg.id, mailbox),
    uid: graphIdToSyntheticUid(msg.id),
    direction: threadDirection(fromAddr, mailbox, submitter),
    from: formatRecipient(msg.from) || "(onbekend)",
    to: formatRecipients(msg.toRecipients) || mailbox,
    date: msg.receivedDateTime || new Date().toISOString(),
    subject: (msg.subject || "").trim() || "(geen onderwerp)",
    textBody: text,
    messageId: msg.internetMessageId ?? null,
    attachments: [],
  };
}

async function listRecentMessages(
  config: GraphMailConfig,
  accessToken: string,
): Promise<GraphMessage[]> {
  const select = [
    "id",
    "subject",
    "bodyPreview",
    "receivedDateTime",
    "isRead",
    "hasAttachments",
    "internetMessageId",
    "conversationId",
    "from",
    "replyTo",
    "toRecipients",
  ].join(",");

  let url =
    `${GRAPH_BASE}${usersPath(config.mailbox, "/messages")}` +
    `?$select=${encodeURIComponent(select)}` +
    `&$orderby=${encodeURIComponent("receivedDateTime desc")}` +
    `&$top=${LIST_PAGE_SIZE}`;

  const all: GraphMessage[] = [];
  for (let page = 0; page < LIST_MAX_PAGES; page++) {
    const data = await graphFetch<GraphListResponse<GraphMessage>>(url, {
      accessToken,
    });
    const batch = data.value ?? [];
    all.push(...batch);
    if (!data["@odata.nextLink"] || batch.length === 0) break;
    url = data["@odata.nextLink"];
  }
  return all;
}

export async function listGraphFormInboxMessages(options?: {
  kind?: FormKind | "all";
  scopeKey?: string | "all";
  q?: string;
  limit?: number;
}): Promise<{ items: FormInboxMessageSummary[]; facets: InboxFacets }> {
  const config = getGraphMailConfig();
  if (!config) {
    throw new FormInboxError("Microsoft Graph is niet geconfigureerd.");
  }

  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const accessToken = await getGraphAccessToken(config);
  const recent = await listRecentMessages(config, accessToken);

  const windowMessages: FormInboxMessageSummary[] = [];
  for (const msg of recent) {
    if (!looksLikeFormCandidate(msg)) continue;
    const summary = toSummary(msg, config.mailbox);
    if (!summary) continue;
    windowMessages.push(summary);
  }

  windowMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const facets = buildInboxFacets(windowMessages);
  const filtered = filterInboxMessages(windowMessages, {
    kind: options?.kind,
    scopeKey: options?.scopeKey,
    q: options?.q,
  });
  return { items: filtered.slice(0, limit), facets };
}

export async function getGraphFormInboxMessage(
  graphId: string,
  mailbox?: string,
): Promise<FormInboxMessage | null> {
  const config = getGraphMailConfig();
  if (!config) {
    throw new FormInboxError("Microsoft Graph is niet geconfigureerd.");
  }
  const box = mailbox || config.mailbox;
  const accessToken = await getGraphAccessToken(config);

  const select = [
    "id",
    "subject",
    "bodyPreview",
    "receivedDateTime",
    "isRead",
    "hasAttachments",
    "internetMessageId",
    "conversationId",
    "from",
    "replyTo",
    "toRecipients",
    "body",
  ].join(",");

  const msg = await graphFetch<GraphMessage>(
    usersPath(box, `/messages/${encodeURIComponent(graphId)}?$select=${encodeURIComponent(select)}`),
    { accessToken },
  );

  const { text, html } = bodyPlainFromGraph(msg);
  const fields = parseFieldsFromParts(text, html);
  const summary = toSummary(msg, box, fields, text);
  if (!summary) return null;

  let attachments: FormInboxAttachment[] = [];
  if (msg.hasAttachments) {
    try {
      const attData = await graphFetch<GraphListResponse<GraphAttachment>>(
        usersPath(box, `/messages/${encodeURIComponent(graphId)}/attachments`),
        { accessToken },
      );
      attachments = mapAttachments(attData.value).map((a) => ({
        ...a,
        // Keep list payload small — content fetched on demand
        contentBase64: undefined,
        omitted: true,
      }));
    } catch {
      attachments = [];
    }
  }

  if (msg.isRead === false && msg.id) {
    try {
      await graphFetch(usersPath(box, `/messages/${encodeURIComponent(msg.id)}`), {
        method: "PATCH",
        accessToken,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
      summary.unread = false;
    } catch {
      // non-fatal
    }
  }

  const safePreview = escapeHtml(text).replaceAll("\n", "<br />");

  return {
    ...summary,
    textBody: text,
    htmlSafePreview: safePreview,
    replyToHeader: recipientAddress(msg.replyTo?.[0]),
    messageId: msg.internetMessageId ?? null,
    fields,
    attachments,
    thread: [],
  };
}

export async function getGraphFormInboxThread(
  graphId: string,
  mailbox?: string,
): Promise<FormInboxThreadItem[]> {
  const config = getGraphMailConfig();
  if (!config) {
    throw new FormInboxError("Microsoft Graph is niet geconfigureerd.");
  }
  const box = mailbox || config.mailbox;
  const accessToken = await getGraphAccessToken(config);

  const root = await graphFetch<GraphMessage>(
    usersPath(
      box,
      `/messages/${encodeURIComponent(graphId)}?$select=${encodeURIComponent(
        "id,subject,conversationId,from,toRecipients,replyTo,receivedDateTime,internetMessageId,body,bodyPreview",
      )}`,
    ),
    { accessToken },
  );

  const { text: rootText, html: rootHtml } = bodyPlainFromGraph(root);
  const fields = parseFieldsFromParts(rootText, rootHtml);
  const submitter = resolveSubmitterEmailGraph(root, fields, rootText, box);
  const conversationId = root.conversationId;

  if (!conversationId) {
    const single = toThreadItem(root, box, submitter);
    return single ? [single] : [];
  }

  const filter = `conversationId eq '${conversationId.replace(/'/g, "''")}'`;
  const data = await graphFetch<GraphListResponse<GraphMessage>>(
    usersPath(
      box,
      `/messages?$filter=${encodeURIComponent(filter)}` +
        `&$select=${encodeURIComponent(
          "id,subject,from,toRecipients,replyTo,receivedDateTime,internetMessageId,body,bodyPreview",
        )}` +
        `&$orderby=${encodeURIComponent("receivedDateTime asc")}` +
        `&$top=${MAX_THREAD_MESSAGES}`,
    ),
    { accessToken },
  );

  const thread: FormInboxThreadItem[] = [];
  for (const msg of data.value ?? []) {
    const item = toThreadItem(msg, box, submitter);
    if (item) thread.push(item);
  }

  if (!thread.some((t) => t.id === encodeGraphMessageId(graphId, box))) {
    const rootItem = toThreadItem(root, box, submitter);
    if (rootItem) thread.unshift(rootItem);
  }

  thread.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return thread.slice(-MAX_THREAD_MESSAGES);
}

export async function getGraphFormInboxAttachment(
  graphId: string,
  filename: string,
  mailbox?: string,
): Promise<FormInboxAttachment | null> {
  const config = getGraphMailConfig();
  if (!config) {
    throw new FormInboxError("Microsoft Graph is niet geconfigureerd.");
  }
  const box = mailbox || config.mailbox;
  const accessToken = await getGraphAccessToken(config);
  const wanted = filename.trim().toLowerCase();

  const data = await graphFetch<GraphListResponse<GraphAttachment>>(
    usersPath(box, `/messages/${encodeURIComponent(graphId)}/attachments`),
    { accessToken },
  );

  const list = mapAttachments(data.value);
  const hit =
    list.find((a) => a.filename.toLowerCase() === wanted) ??
    list.find((a) => a.filename.toLowerCase().includes(wanted));

  if (!hit) return null;

  if (hit.contentBase64) return hit;

  if (hit.part) {
    const att = await graphFetch<GraphAttachment>(
      usersPath(
        box,
        `/messages/${encodeURIComponent(graphId)}/attachments/${encodeURIComponent(hit.part)}`,
      ),
      { accessToken },
    );
    const mapped = mapAttachmentMeta(att);
    if (mapped?.contentBase64) return mapped;
    if (mapped) return { ...mapped, omitted: true };
  }

  return { ...hit, omitted: true };
}

export async function sendGraphAdminReply(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  inReplyToGraphId?: string;
  inReplyToInternetMessageId?: string;
}): Promise<{ ok: true; messageId?: string } | { ok: false; error: string }> {
  const config = getGraphMailConfig();
  if (!config) {
    return { ok: false, error: "Microsoft Graph is niet geconfigureerd." };
  }

  try {
    const accessToken = await getGraphAccessToken(config);

    if (options.inReplyToGraphId) {
      await graphFetch(
        usersPath(
          config.mailbox,
          `/messages/${encodeURIComponent(options.inReplyToGraphId)}/reply`,
        ),
        {
          method: "POST",
          accessToken,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              subject: options.subject,
              body: {
                contentType: "HTML",
                content: options.html,
              },
              toRecipients: [
                {
                  emailAddress: { address: options.to },
                },
              ],
              ...(options.replyTo
                ? {
                    replyTo: [
                      {
                        emailAddress: { address: options.replyTo },
                      },
                    ],
                  }
                : {}),
            },
          }),
        },
      );
      return { ok: true, messageId: options.inReplyToInternetMessageId };
    }

    await graphFetch(usersPath(config.mailbox, "/sendMail"), {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          subject: options.subject,
          body: {
            contentType: "HTML",
            content: options.html,
          },
          toRecipients: [
            {
              emailAddress: { address: options.to },
            },
          ],
          ...(options.replyTo
            ? {
                replyTo: [
                  {
                    emailAddress: { address: options.replyTo },
                  },
                ],
              }
            : {}),
        },
        saveToSentItems: true,
      }),
    });

    return { ok: true };
  } catch (error) {
    const message =
      error instanceof FormInboxError
        ? error.message
        : error instanceof Error
          ? error.message.slice(0, 240)
          : "Graph send failed";
    console.error("[graph-mail] send failed", message);
    return { ok: false, error: message };
  }
}
