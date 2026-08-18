/**
 * Microsoft Graph mailbox adapter for Admin → Aanvragen.
 * Application permissions (client credentials) against a shared mailbox.
 */
import type { FormKind } from "@mccoy/domain";
import { FIELD_LABELS_NL, FORM_KINDS, FORM_SCOPE_KEY_PATTERN } from "@mccoy/domain";
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
import { formatGraphApiError, formatGraphMailWriteError } from "./graph-errors";
import {
  blockedGraphQuery,
  illegalGraphMailQueryReason,
  logIllegalGraphQuery,
  logSkippedBlockedGraphQuery,
  parseGraphQuery,
  recordGraphQueryFailure,
} from "./graph-query-guard";
import {
  encodeGraphMessageId,
  graphIdToSyntheticUid,
} from "./inbox-message-id";
import { isReplyOrForwardSubject } from "./form-mail-subject";
import type { GraphInboxSyncCandidate } from "./graph-inbox-sync-types";
import {
  buildConversationReceivedFilter,
  buildConversationSentFilter,
} from "./graph-odata-filters";
import { buildGraphReplyDraftPatch } from "./graph-reply-draft";
import { extractSimpleReplyBody, dedupeInquiryThreadItems, stripQuotedReplyBody } from "./inquiry-thread-dedupe";

export type { GraphInboxSyncCandidate } from "./graph-inbox-sync-types";
import {
  normalizeFormFieldLabel,
  parseFormFieldsFromHtml,
  parseFormFieldsFromText,
  toDisplayParsedFields,
  type ParsedFormField,
} from "./parse-form-fields";
import { escapeHtml } from "./templates";

export { isReplyOrForwardSubject } from "./form-mail-subject";

const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 80;
const MAX_THREAD_MESSAGES = 12;
const MAX_ATTACHMENT_BYTES = 3.5 * 1024 * 1024;
const MAX_ATTACHMENTS = 8;
const LIST_PAGE_SIZE = 50;
const LIST_MAX_PAGES = 4;

export type InboxLoadMetrics = {
  graphRequestCount: number;
  returnedItemCount: number;
  listDurationMs: number;
  detailRequestCount: number;
};
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

type GraphEmailAddress = {
  name?: string | null;
  address?: string | null;
};

type GraphRecipient = {
  emailAddress?: GraphEmailAddress | null;
};

type GraphInternetMessageHeader = {
  name?: string | null;
  value?: string | null;
};

type GraphMessage = {
  id?: string;
  subject?: string | null;
  bodyPreview?: string | null;
  receivedDateTime?: string | null;
  sentDateTime?: string | null;
  isRead?: boolean;
  hasAttachments?: boolean;
  internetMessageId?: string | null;
  conversationId?: string | null;
  conversationIndex?: string | null;
  from?: GraphRecipient | null;
  replyTo?: GraphRecipient[] | null;
  toRecipients?: GraphRecipient[] | null;
  internetMessageHeaders?: GraphInternetMessageHeader[] | null;
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

/**
 * All addresses that may appear as From when our servers send form mail.
 * SMTP auth user (e.g. sander@) often differs from SMTP_FROM_EMAIL / GRAPH_MAILBOX
 * (e.g. info@ shared mailbox) — Exchange may deliver with either address.
 */
function configuredSenderAddresses(): string[] {
  const candidates = [
    readServerEnv("FORM_FROM_EMAIL"),
    readServerEnv("SMTP_FROM_EMAIL"),
    readServerEnv("SMTP_USER"),
    readServerEnv("FORM_INBOX_USER"),
    readServerEnv("GRAPH_MAILBOX"),
    readServerEnv("FORM_TO_EMAIL"),
    readServerEnv("SMTP_REPLY_TO"),
  ];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of candidates) {
    const email = extractEmail(raw);
    if (!email || !EMAIL_RE.test(email) || seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

function configuredFromAddress(): string {
  return configuredSenderAddresses()[0] || "";
}

function configuredFromDisplayName(): string {
  return (readServerEnv("SMTP_FROM_NAME") || "McCoy Website").trim();
}

/** Dev/debug: list every Graph mailbox message, not only McCoy form notifications. */
export function showAllGraphInboxMessages(): boolean {
  const raw = readServerEnv("FORM_INBOX_SHOW_ALL").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function readInternetHeader(
  headers: GraphInternetMessageHeader[] | null | undefined,
  name: string,
): string | null {
  if (!headers?.length) return null;
  const wanted = name.trim().toLowerCase();
  for (const header of headers) {
    if ((header.name?.trim() || "").toLowerCase() !== wanted) continue;
    const value = header.value?.trim();
    if (value) return value;
  }
  return null;
}

/**
 * Sender/display-name markers for McCoy form notifications.
 * Does not treat quoted body footers as proof — applicants quote those in replies.
 */
export function isMcCoyWebsiteFormNotificationBySender(input: {
  fromName: string;
  fromAddress: string;
}): boolean {
  const fromName = input.fromName.toLowerCase();
  const fromAddr = input.fromAddress.toLowerCase();
  const senders = configuredSenderAddresses();
  const configuredName = configuredFromDisplayName().toLowerCase();

  if (fromName.includes("mccoy website")) return true;
  if (configuredName && fromName.includes(configuredName)) return true;
  if (fromAddr && senders.includes(fromAddr)) return true;
  if (fromAddr.endsWith("@resend.dev") && fromName.includes("mccoy")) return true;
  return false;
}

/**
 * Website form notifications set X-McCoy-Form-* headers (incl. future custom forms).
 * Exported for unit tests.
 */
export function hasMcCoyFormMarkerHeaders(
  headers: GraphInternetMessageHeader[] | null | undefined,
): boolean {
  if (!headers?.length) return false;
  return headers.some((header) => {
    const name = header.name?.trim() || "";
    if (!/^x-mccoy-form-(kind|id|submission-id)$/i.test(name)) return false;
    return Boolean(header.value?.trim());
  });
}

/**
 * Prefer X-McCoy-Form-Kind for category tabs. Unknown/custom kinds fall back to
 * `inquiry` (Algemeen) when other form marker headers are present.
 */
export function formKindFromInternetHeaders(
  headers: GraphInternetMessageHeader[] | null | undefined,
): FormKind | null {
  const raw = readInternetHeader(headers, "x-mccoy-form-kind")?.toLowerCase() || "";
  if (raw && (FORM_KINDS as readonly string[]).includes(raw)) {
    return raw as FormKind;
  }
  if (hasMcCoyFormMarkerHeaders(headers)) {
    return "inquiry";
  }
  return null;
}

function formScopeFromInternetHeaders(
  headers: GraphInternetMessageHeader[] | null | undefined,
): { key: string | null; label: string | null } {
  const keyRaw = readInternetHeader(headers, "x-mccoy-form-scope-key")?.toLowerCase() || "";
  const key = keyRaw && FORM_SCOPE_KEY_PATTERN.test(keyRaw) ? keyRaw : null;
  const label = readInternetHeader(headers, "x-mccoy-form-scope-label");
  return { key, label };
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
    .replace(/<\/(div|h[1-6]|li|blockquote)>/gi, "\n")
    .replace(/<(blockquote)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#65279;/gi, "")
    .replace(/&#xfeff;/gi, "")
    .replace(/&#(\d+);/g, (_, digits: string) => {
      const code = Number(digits);
      if (!Number.isFinite(code) || code <= 0) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      if (!Number.isFinite(code) || code <= 0) return "";
      try {
        return String.fromCodePoint(code);
      } catch {
        return "";
      }
    })
    .replace(/\uFEFF/g, "")
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
  return toDisplayParsedFields(out);
}

function parseFieldsFromParts(text: string, html: string): ParsedFormField[] {
  const fromHtml = sanitizeParsedFields(parseFormFieldsFromHtml(html));
  if (fromHtml.length > 0) return fromHtml;
  return sanitizeParsedFields(parseFormFieldsFromText(text || stripHtmlToText(html)));
}

function hasMcCoyFormFooter(text: string, html: string): boolean {
  return (
    /verstuurd via het mccoy websiteformulier/i.test(html) ||
    /verstuurd via het mccoy websiteformulier/i.test(text) ||
    /sent from the mccoy website form/i.test(html) ||
    /sent from the mccoy website form/i.test(text)
  );
}

/**
 * Detect McCoy website form notification From/footer markers.
 * Does not treat arbitrary @mccoy.nl mail as a form submission.
 * Exported for unit tests.
 */
export function isMcCoyWebsiteFormNotificationGraph(input: {
  fromName: string;
  fromAddress: string;
  text: string;
  html: string;
}): boolean {
  if (isMcCoyWebsiteFormNotificationBySender(input)) return true;
  if (hasMcCoyFormFooter(input.text, input.html)) return true;
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
  extraHeaders?: GraphInternetMessageHeader[] | null,
): string | null {
  const inbox = inboxUser.trim().toLowerCase();
  const ourAddresses = new Set(
    [...configuredSenderAddresses(), inbox].filter(Boolean),
  );

  const isExternal = (addr: string | null | undefined): addr is string =>
    Boolean(addr && EMAIL_RE.test(addr) && !ourAddresses.has(addr.toLowerCase()));

  for (const header of extraHeaders ?? []) {
    if (!/^x-mccoy-submitter-email$/i.test(header.name?.trim() || "")) continue;
    const value = header.value?.trim().toLowerCase() || "";
    if (isExternal(value)) return value;
  }

  const replyTo = recipientAddress(msg.replyTo?.[0]);
  if (isExternal(replyTo)) return replyTo;

  const emailField = fields.find((f) => f.key === "email");
  const fieldEmail = emailField?.value.trim().toLowerCase() || null;
  if (isExternal(fieldEmail)) return fieldEmail;

  const fromBody = extractEmailFromText(textBody);
  if (isExternal(fromBody)) return fromBody;

  const from = recipientAddress(msg.from);
  if (isExternal(from)) return from;

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

/**
 * One form submit can appear twice in Graph when saveToSentItems duplicated a
 * self-addressed notification (Inbox + Sent Items). Keep a single list row per
 * McCoy request number when present. Prefer the original form notification over
 * a later reply that incorrectly shared the WR- number.
 */
export function dedupeFormInboxSummaries(
  items: FormInboxMessageSummary[],
): FormInboxMessageSummary[] {
  const withoutNumber: FormInboxMessageSummary[] = [];
  const byNumber = new Map<string, FormInboxMessageSummary>();

  for (const item of items) {
    const number = item.requestNumber?.trim();
    if (!number) {
      withoutNumber.push(item);
      continue;
    }
    const existing = byNumber.get(number);
    if (!existing) {
      byNumber.set(number, item);
      continue;
    }
    const existingReply = isReplyOrForwardSubject(existing.subject);
    const itemReply = isReplyOrForwardSubject(item.subject);
    if (existingReply !== itemReply) {
      byNumber.set(number, existingReply ? item : existing);
      continue;
    }
    const keepExisting =
      new Date(existing.date).getTime() >= new Date(item.date).getTime();
    byNumber.set(number, keepExisting ? existing : item);
  }

  return [...byNumber.values(), ...withoutNumber].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
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
        Prefer: 'IdType="ImmutableId"',
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
    try {
      const parsed = parseGraphQuery(url);
      recordGraphQueryFailure(parsed, response.status, code);
    } catch {
      // Query logging must never break error handling.
    }
    // InefficientFilter is an expected Graph limitation for some conversation
    // queries; callers fall back to a recent-mail scan. Keep logs quiet.
    if (code === "InefficientFilter") {
      console.warn("[graph-mail] InefficientFilter", { status: response.status });
    } else {
      console.error("[graph-mail] API error", {
        status: response.status,
        code,
      });
    }
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

function mapAttachmentMeta(
  att: GraphAttachment,
  options?: { includeInline?: boolean },
): FormInboxAttachment | null {
  const odataType = att["@odata.type"] || "";
  if (odataType.includes("itemAttachment") || odataType.includes("referenceAttachment")) {
    return null;
  }
  if (att.isInline && !options?.includeInline) return null;
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

function mapAttachments(
  list: GraphAttachment[] | undefined,
  options?: { includeInline?: boolean },
): FormInboxAttachment[] {
  if (!list?.length) return [];
  const out: FormInboxAttachment[] = [];
  for (const att of list) {
    const mapped = mapAttachmentMeta(att, options);
    if (mapped) out.push(mapped);
  }
  return out;
}

/**
 * List-path filter: keep only website form notifications (headers, or
 * form subject + McCoy sender). Replies/forwards are excluded.
 * Quoted form footers in bodyPreview must not create new Aanvragen rows.
 * Exported for unit tests.
 */
export function looksLikeFormCandidate(msg: {
  subject?: string | null;
  bodyPreview?: string | null;
  from?: GraphRecipient | null;
  internetMessageHeaders?: GraphInternetMessageHeader[] | null;
}): boolean {
  if (hasMcCoyFormMarkerHeaders(msg.internetMessageHeaders)) return true;
  const subject = msg.subject || "";
  if (isReplyOrForwardSubject(subject)) return false;
  if (!classifyFormEmailSubject(subject)) return false;
  const fromName = recipientName(msg.from);
  const fromAddr = recipientAddress(msg.from) || "";
  // Sender only — never body footer (applicant replies quote the form footer).
  return isMcCoyWebsiteFormNotificationBySender({
    fromName,
    fromAddress: fromAddr,
  });
}

function resolveFormKind(
  subject: string,
  headers: GraphInternetMessageHeader[] | null | undefined,
  showAll: boolean,
): FormKind | null {
  const headerKind = formKindFromInternetHeaders(headers);
  if (headerKind) return headerKind;
  if (!isReplyOrForwardSubject(subject)) {
    const subjectKind = classifyFormEmailSubject(subject);
    if (subjectKind) return subjectKind;
  }
  return showAll ? ("inquiry" as FormKind) : null;
}

function toSummary(
  msg: GraphMessage,
  mailbox: string,
  fields?: ParsedFormField[],
  textBody?: string,
): FormInboxMessageSummary | null {
  if (!msg.id) return null;
  const subject = (msg.subject || "").trim() || "(geen onderwerp)";
  const showAll = showAllGraphInboxMessages();
  const kind = resolveFormKind(subject, msg.internetMessageHeaders, showAll);
  if (!kind) return null;

  const fromName = recipientName(msg.from);
  const fromAddr = recipientAddress(msg.from) || "";
  const { text, html } = textBody != null
    ? { text: textBody, html: "" }
    : bodyPlainFromGraph(msg);

  if (!showAll) {
    const headerMarksForm = hasMcCoyFormMarkerHeaders(msg.internetMessageHeaders);
    if (isReplyOrForwardSubject(subject) && !headerMarksForm) return null;

    const senderOk = isMcCoyWebsiteFormNotificationBySender({
      fromName,
      fromAddress: fromAddr,
    });
    const isForm = headerMarksForm || senderOk;
    if (!isForm) return null;
  }

  const parsedFields = fields ?? [];
  const submitterEmail = resolveSubmitterEmailGraph(
    msg,
    parsedFields,
    text || msg.bodyPreview || "",
    mailbox,
    msg.internetMessageHeaders,
  );
  const headerScope = formScopeFromInternetHeaders(msg.internetMessageHeaders);
  const scopeFromField =
    parsedFields.find((f) => f.label.toLowerCase() === "scope")?.value?.trim() || null;

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
    scopeKey: headerScope.key ?? extractFormScopeKeyFromSubject(subject),
    scopeLabel: headerScope.label ?? scopeFromField,
  };
}

/**
 * Classify a Graph conversation item. Form notifications are From our mailbox
 * (info@…), so mailbox/from checks alone would mis-label them as admin and
 * duplicate the structured fields in the UI. Outbound `Re:` replies must stay
 * "admin" even though From is the same mailbox.
 */
export function classifyGraphThreadDirection(input: {
  fromAddress: string | null;
  fromName: string;
  subject: string;
  text: string;
  inboxUser: string;
  submitter: string | null;
}): FormInboxThreadItem["direction"] {
  const from = (input.fromAddress || "").toLowerCase();
  const subject = input.subject.trim();
  const isReplySubject = isReplyOrForwardSubject(subject);
  const hasFormFooter =
    /verstuurd via het mccoy websiteformulier/i.test(input.text) ||
    /sent from the mccoy website form/i.test(input.text);
  const isFormNotification =
    !isReplySubject &&
    Boolean(classifyFormEmailSubject(subject)) &&
    (hasFormFooter ||
      isMcCoyWebsiteFormNotificationGraph({
        fromName: input.fromName,
        fromAddress: from,
        text: input.text,
        html: "",
      }));

  if (isFormNotification) return "form";
  if (input.submitter && from === input.submitter.toLowerCase()) return "customer";
  if (from && from === input.inboxUser.trim().toLowerCase()) return "admin";
  if (from && configuredSenderAddresses().includes(from)) return "admin";
  return "customer";
}

function toThreadItem(
  msg: GraphMessage,
  mailbox: string,
  submitter: string | null,
): FormInboxThreadItem | null {
  if (!msg.id) return null;
  const { text } = bodyPlainFromGraph(msg);
  const fromAddr = recipientAddress(msg.from);
  const fromName = msg.from?.emailAddress?.name?.trim() || "";
  const subject = (msg.subject || "").trim() || "(geen onderwerp)";
  const direction = classifyGraphThreadDirection({
    fromAddress: fromAddr,
    fromName,
    subject,
    text,
    inboxUser: mailbox,
    submitter,
  });
  return {
    id: encodeGraphMessageId(msg.id, mailbox),
    uid: graphIdToSyntheticUid(msg.id),
    direction,
    from: formatRecipient(msg.from) || "(onbekend)",
    to: formatRecipients(msg.toRecipients) || mailbox,
    date: msg.receivedDateTime || new Date().toISOString(),
    subject,
    textBody:
      direction === "admin"
        ? extractSimpleReplyBody(text)
        : direction === "customer"
          ? stripQuotedReplyBody(text)
          : text,
    messageId: msg.internetMessageId ?? null,
    attachments: [],
  };
}

async function listRecentMessages(
  config: GraphMailConfig,
  accessToken: string,
  options?: { stopWhen?: (accumulated: GraphMessage[]) => boolean; signal?: AbortSignal },
): Promise<{ messages: GraphMessage[]; pageCount: number }> {
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
  let pageCount = 0;
  for (let page = 0; page < LIST_MAX_PAGES; page++) {
    const data = await graphFetch<GraphListResponse<GraphMessage>>(url, {
      accessToken,
      signal: options?.signal,
    });
    pageCount += 1;
    const batch = data.value ?? [];
    all.push(...batch);
    if (options?.stopWhen?.(all)) break;
    if (!data["@odata.nextLink"] || batch.length === 0) break;
    url = data["@odata.nextLink"];
  }
  return { messages: all, pageCount };
}

export async function listGraphFormInboxMessages(options?: {
  kind?: FormKind | "all";
  scopeKey?: string | "all";
  q?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<{
  items: FormInboxMessageSummary[];
  facets: InboxFacets;
  metrics?: InboxLoadMetrics;
  /** Raw page candidates for thread-identity sync (caller owns side effects). */
  syncCandidates?: GraphInboxSyncCandidate[];
}> {
  const config = getGraphMailConfig();
  if (!config) {
    throw new FormInboxError("Microsoft Graph is niet geconfigureerd.");
  }

  const started = Date.now();
  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const accessToken = await getGraphAccessToken(config, { signal: options?.signal });
  const showAll = showAllGraphInboxMessages();

  const { messages: recent, pageCount } = await listRecentMessages(config, accessToken, {
    signal: options?.signal,
    stopWhen: (accumulated) => {
      if (showAll) return accumulated.length >= limit;
      let formCount = 0;
      for (const msg of accumulated) {
        if (looksLikeFormCandidate(msg)) formCount += 1;
        if (formCount >= limit) return true;
      }
      return false;
    },
  });

  const windowMessages: FormInboxMessageSummary[] = [];
  const syncCandidates: GraphInboxSyncCandidate[] = [];
  for (const msg of recent) {
    if (!msg.id) continue;
    const formCandidate = looksLikeFormCandidate(msg);
    syncCandidates.push({
      id: msg.id,
      subject: msg.subject,
      bodyPreview: msg.bodyPreview,
      receivedDateTime: msg.receivedDateTime,
      isRead: msg.isRead,
      internetMessageId: msg.internetMessageId,
      conversationId: msg.conversationId,
      fromAddress: recipientAddress(msg.from),
      isFormCandidate: formCandidate,
    });
    if (!showAll && !formCandidate) continue;
    const summary = toSummary(msg, config.mailbox);
    if (!summary) continue;
    windowMessages.push(summary);
  }

  windowMessages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const deduped = dedupeFormInboxSummaries(windowMessages);
  const facets = buildInboxFacets(deduped);
  const filtered = filterInboxMessages(deduped, {
    kind: options?.kind,
    scopeKey: options?.scopeKey,
    q: options?.q,
  });
  const items = filtered.slice(0, limit);
  return {
    items,
    facets,
    metrics: {
      graphRequestCount: pageCount,
      returnedItemCount: items.length,
      listDurationMs: Date.now() - started,
      detailRequestCount: 0,
    },
    syncCandidates,
  };
}

/**
 * Confirm a Graph message may be deleted without fetching the HTML/text body.
 */
export async function assertGraphFormInboxMessageDeletable(
  graphId: string,
  mailbox?: string,
): Promise<void> {
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
    "from",
    "internetMessageId",
    "conversationId",
  ].join(",");

  let msg: GraphMessage;
  try {
    msg = await graphFetch<GraphMessage>(
      usersPath(
        box,
        `/messages/${encodeURIComponent(graphId)}?$select=${encodeURIComponent(select)}`,
      ),
      { accessToken },
    );
  } catch (error) {
    if (error instanceof FormInboxError && /404|not found|niet gevonden/i.test(error.message)) {
      throw new FormInboxError("Bericht niet gevonden of geen McCoy-formulier-e-mail.");
    }
    throw error;
  }

  if (!msg?.id) {
    throw new FormInboxError("Bericht niet gevonden of geen McCoy-formulier-e-mail.");
  }
  if (!showAllGraphInboxMessages() && !looksLikeFormCandidate(msg)) {
    throw new FormInboxError("Bericht niet gevonden of geen McCoy-formulier-e-mail.");
  }
}

/**
 * Lightweight subject/preview read to correlate a Graph message with a WR- number
 * during Aanvragen delete (no body fetch).
 */
export async function peekGraphMessageRequestNumber(
  graphId: string,
  mailbox?: string,
): Promise<string | null> {
  const config = getGraphMailConfig();
  if (!config) return null;
  const box = mailbox || config.mailbox;
  const accessToken = await getGraphAccessToken(config);
  const select = "id,subject,bodyPreview";
  try {
    const msg = await graphFetch<GraphMessage>(
      usersPath(
        box,
        `/messages/${encodeURIComponent(graphId)}?$select=${encodeURIComponent(select)}`,
      ),
      { accessToken },
    );
    return extractRequestNumber(msg.subject || "", msg.bodyPreview || "") || null;
  } catch {
    return null;
  }
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

  // Graph requires internetMessageHeaders as the sole $select property.
  let headers: GraphInternetMessageHeader[] = [];
  try {
    const headerMsg = await graphFetch<GraphMessage>(
      usersPath(
        box,
        `/messages/${encodeURIComponent(graphId)}?$select=internetMessageHeaders`,
      ),
      { accessToken },
    );
    headers = headerMsg.internetMessageHeaders ?? [];
  } catch {
    headers = [];
  }
  msg.internetMessageHeaders = headers;

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

/** Lightweight Graph message used when syncing a website-request conversation. */
export type GraphConversationSyncMessage = {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  receivedDateTime: string | null;
  isRead: boolean;
  internetMessageId: string | null;
  conversationId: string | null;
  fromAddress: string | null;
  fromName: string;
  toAddresses: string[];
  textBody: string;
};

function toConversationSyncMessage(msg: GraphMessage): GraphConversationSyncMessage | null {
  if (!msg.id) return null;
  const { text } = bodyPlainFromGraph(msg);
  return {
    id: msg.id,
    subject: msg.subject ?? null,
    bodyPreview: msg.bodyPreview ?? null,
    receivedDateTime: msg.receivedDateTime ?? null,
    isRead: msg.isRead !== false,
    internetMessageId: msg.internetMessageId ?? null,
    conversationId: msg.conversationId ?? null,
    fromAddress: recipientAddress(msg.from),
    fromName: msg.from?.emailAddress?.name?.trim() || "",
    toAddresses: (msg.toRecipients ?? [])
      .map((r) => recipientAddress(r))
      .filter((addr): addr is string => Boolean(addr)),
    textBody: text,
  };
}

/**
 * List messages in a Graph conversation (Inbox + Sent Items via /messages).
 * Used by request-detail sync so applicant replies appear on `req:` Aanvragen.
 *
 * Strategy (Graph InefficientFilter is common on conversationId filters):
 * 1. $filter only (no $orderby) — sort client-side
 * 2. $filter + $orderby with correct property order
 * 3. Scan recent mailbox messages and keep matching conversationId
 */
export async function listGraphConversationSyncMessages(options: {
  conversationId: string;
  mailbox?: string;
  top?: number;
}): Promise<GraphConversationSyncMessage[]> {
  const config = getGraphMailConfig();
  if (!config) {
    throw new FormInboxError("Microsoft Graph is niet geconfigureerd.");
  }
  const box = options.mailbox || config.mailbox;
  const accessToken = await getGraphAccessToken(config);
  const conversationId = options.conversationId.trim();
  if (!conversationId) return [];

  const filter = buildConversationReceivedFilter(conversationId);
  const top = Math.min(Math.max(options.top ?? MAX_THREAD_MESSAGES, 1), 40);
  const select =
    "id,subject,from,toRecipients,replyTo,receivedDateTime,internetMessageId,conversationId,body,bodyPreview,isRead";

  const mapList = (value: GraphMessage[] | undefined): GraphConversationSyncMessage[] =>
    (value ?? [])
      .map((msg) => toConversationSyncMessage(msg))
      .filter((msg): msg is GraphConversationSyncMessage => Boolean(msg))
      .sort(
        (a, b) =>
          new Date(a.receivedDateTime || 0).getTime() -
          new Date(b.receivedDateTime || 0).getTime(),
      );

  // 1) Filter without $orderby — avoids most InefficientFilter cases.
  try {
    const data = await graphFetch<GraphListResponse<GraphMessage>>(
      usersPath(
        box,
        `/messages?$filter=${encodeURIComponent(filter)}` +
          `&$select=${encodeURIComponent(select)}` +
          `&$top=${top}`,
      ),
      { accessToken },
    );
    const mapped = mapList(data.value);
    if (mapped.length > 0) return mapped;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/InefficientFilter|ErrorInvalidArgument/i.test(message)) throw error;
  }

  // 2) Filter + orderby with Graph-required property order.
  try {
    const data = await graphFetch<GraphListResponse<GraphMessage>>(
      usersPath(
        box,
        `/messages?$filter=${encodeURIComponent(filter)}` +
          `&$select=${encodeURIComponent(select)}` +
          `&$orderby=${encodeURIComponent("receivedDateTime asc")}` +
          `&$top=${top}`,
      ),
      { accessToken },
    );
    const mapped = mapList(data.value);
    if (mapped.length > 0) return mapped;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/InefficientFilter|ErrorInvalidArgument/i.test(message)) throw error;
    console.warn(
      "[graph-mail] conversation filter rejected; falling back to recent scan",
      message.slice(0, 120),
    );
  }

  // 3) Client-side match against recent mailbox messages (always works).
  return listRecentGraphSyncMessages({
    mailbox: box,
    maxMessages: Math.max(top * 4, 80),
  }).then((recent) =>
    recent
      .filter((msg) => msg.conversationId === conversationId)
      .slice(-top),
  );
}

/**
 * Recent mailbox messages for Aanvraag detail sync fallbacks.
 * Uses bodyPreview as text when full body is not selected (fast path).
 */
export async function listRecentGraphSyncMessages(options?: {
  mailbox?: string;
  maxMessages?: number;
}): Promise<GraphConversationSyncMessage[]> {
  const config = getGraphMailConfig();
  if (!config) {
    throw new FormInboxError("Microsoft Graph is niet geconfigureerd.");
  }
  const box = options?.mailbox || config.mailbox;
  const accessToken = await getGraphAccessToken(config);
  const maxMessages = Math.min(Math.max(options?.maxMessages ?? 100, 20), 200);

  const { messages } = await listRecentMessages(config, accessToken, {
    stopWhen: (accumulated) => accumulated.length >= maxMessages,
  });

  return messages
    .slice(0, maxMessages)
    .map((msg) => {
      if (!msg.id) return null;
      return {
        id: msg.id,
        subject: msg.subject ?? null,
        bodyPreview: msg.bodyPreview ?? null,
        receivedDateTime: msg.receivedDateTime ?? null,
        isRead: msg.isRead !== false,
        internetMessageId: msg.internetMessageId ?? null,
        conversationId: msg.conversationId ?? null,
        fromAddress: recipientAddress(msg.from),
        fromName: msg.from?.emailAddress?.name?.trim() || "",
        toAddresses: (msg.toRecipients ?? [])
          .map((r) => recipientAddress(r))
          .filter((addr): addr is string => Boolean(addr)),
        textBody: (msg.bodyPreview || "").trim(),
      } satisfies GraphConversationSyncMessage;
    })
    .filter((msg): msg is GraphConversationSyncMessage => Boolean(msg));
}

/** Resolve conversation / RFC ids for a known Graph message. */
export async function getGraphMessageSyncMeta(
  graphId: string,
  mailbox?: string,
): Promise<{
  id: string;
  conversationId: string | null;
  internetMessageId: string | null;
} | null> {
  const config = getGraphMailConfig();
  if (!config) return null;
  const box = mailbox || config.mailbox;
  const accessToken = await getGraphAccessToken(config);
  try {
    const msg = await graphFetch<GraphMessage>(
      usersPath(
        box,
        `/messages/${encodeURIComponent(graphId)}?$select=${encodeURIComponent(
          "id,conversationId,internetMessageId",
        )}`,
      ),
      { accessToken },
    );
    if (!msg.id) return null;
    return {
      id: msg.id,
      conversationId: msg.conversationId ?? null,
      internetMessageId: msg.internetMessageId ?? null,
    };
  } catch {
    return null;
  }
}

/** Full plain-text body for an inbound reply (avoids bodyPreview quoting artefacts). */
export async function getGraphMessagePlainBody(
  graphId: string,
  mailbox?: string,
): Promise<string | null> {
  const config = getGraphMailConfig();
  if (!config) return null;
  const box = mailbox || config.mailbox;
  const accessToken = await getGraphAccessToken(config);
  try {
    const msg = await graphFetch<GraphMessage>(
      usersPath(
        box,
        `/messages/${encodeURIComponent(graphId)}?$select=${encodeURIComponent(
          "id,body,bodyPreview",
        )}`,
      ),
      { accessToken },
    );
    if (!msg.id) return null;
    const { text } = bodyPlainFromGraph(msg);
    return text || (msg.bodyPreview || "").trim() || null;
  } catch {
    return null;
  }
}

/** Find a mailbox message by RFC Message-ID (Sent Items / Inbox). */
export async function findGraphMessageByInternetMessageId(
  internetMessageId: string,
  mailbox?: string,
): Promise<{
  id: string;
  conversationId: string | null;
  internetMessageId: string | null;
} | null> {
  const config = getGraphMailConfig();
  if (!config) return null;
  const box = mailbox || config.mailbox;
  const normalised = internetMessageId.trim();
  if (!normalised) return null;
  const accessToken = await getGraphAccessToken(config);
  const filter = `internetMessageId eq '${normalised.replace(/'/g, "''")}'`;
  try {
    const data = await graphFetch<GraphListResponse<GraphMessage>>(
      usersPath(
        box,
        `/messages?$filter=${encodeURIComponent(filter)}` +
          `&$select=${encodeURIComponent("id,conversationId,internetMessageId")}` +
          `&$top=1`,
      ),
      { accessToken },
    );
    const hit = data.value?.[0];
    if (!hit?.id) return null;
    return {
      id: hit.id,
      conversationId: hit.conversationId ?? null,
      internetMessageId: hit.internetMessageId ?? null,
    };
  } catch {
    return null;
  }
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

  let rootHeaders: GraphInternetMessageHeader[] = [];
  try {
    const headerMsg = await graphFetch<GraphMessage>(
      usersPath(
        box,
        `/messages/${encodeURIComponent(graphId)}?$select=internetMessageHeaders`,
      ),
      { accessToken },
    );
    rootHeaders = headerMsg.internetMessageHeaders ?? [];
  } catch {
    rootHeaders = [];
  }

  const submitter = resolveSubmitterEmailGraph(
    root,
    fields,
    rootText,
    box,
    rootHeaders,
  );
  const conversationId = root.conversationId;

  if (!conversationId) {
    const single = toThreadItem(root, box, submitter);
    return single ? [single] : [];
  }

  const synced = await listGraphConversationSyncMessages({
    conversationId,
    mailbox: box,
  });

  const thread: FormInboxThreadItem[] = synced.map((msg) => {
    const subject = (msg.subject || "").trim() || "(geen onderwerp)";
    const direction = classifyGraphThreadDirection({
      fromAddress: msg.fromAddress,
      fromName: msg.fromName,
      subject,
      text: msg.textBody,
      inboxUser: box,
      submitter,
    });
    return {
      id: encodeGraphMessageId(msg.id, box),
      uid: graphIdToSyntheticUid(msg.id),
      direction,
      from: msg.fromAddress
        ? msg.fromName
          ? `${msg.fromName} <${msg.fromAddress}>`
          : msg.fromAddress
        : "(onbekend)",
      to: msg.toAddresses.join(", ") || box,
      date: msg.receivedDateTime || new Date().toISOString(),
      subject,
      textBody:
        direction === "admin"
          ? extractSimpleReplyBody(msg.textBody)
          : direction === "customer"
            ? stripQuotedReplyBody(msg.textBody)
            : msg.textBody,
      messageId: msg.internetMessageId,
      attachments: [],
    };
  });

  if (!thread.some((t) => t.id === encodeGraphMessageId(graphId, box))) {
    const rootItem = toThreadItem(root, box, submitter);
    if (rootItem) thread.unshift(rootItem);
  }

  if (thread.length === 0) {
    const single = toThreadItem(root, box, submitter);
    return single ? [single] : [];
  }

  thread.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return dedupeInquiryThreadItems(thread).slice(-MAX_THREAD_MESSAGES);
}

/**
 * Locate the form-notification message by WR- number when mail_messages has no
 * graph_message_id. Uses a plain quoted $search phrase only (no KQL prefixes).
 */
export async function findGraphFormNotificationByRequestNumber(options: {
  requestNumber: string;
  mailbox?: string;
  createdAt?: string;
  filename?: string;
}): Promise<{ id: string; mailbox: string; subject?: string } | null> {
  const config = getGraphMailConfig();
  if (!config) return null;
  const box = (options.mailbox || config.mailbox).trim() || config.mailbox;
  const number = options.requestNumber.trim();
  if (!number) return null;

  const searchPath = usersPath(
    box,
    `/messages?$search=${encodeURIComponent(`"${number}"`)}&$top=25`,
  );
  const parsed = parseGraphQuery(searchPath);
  const illegal = illegalGraphMailQueryReason(parsed);
  if (illegal) {
    logIllegalGraphQuery(parsed, illegal);
    return null;
  }
  const blocked = blockedGraphQuery(parsed);
  if (blocked) {
    logSkippedBlockedGraphQuery(parsed, blocked);
    return null;
  }

  try {
    const accessToken = await getGraphAccessToken(config);
    const data = await graphFetch<GraphListResponse<GraphMessage>>(searchPath, { accessToken });
    const rows = data.value ?? [];
    const hit =
      rows.find((msg) => {
        const haystack = `${msg.subject || ""} ${msg.bodyPreview || ""}`;
        return haystack.includes(number);
      }) ?? rows[0];
    if (!hit?.id) return null;
    return { id: hit.id, mailbox: box, subject: hit.subject ?? undefined };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/http_400|badrequest/i.test(message)) {
      recordGraphQueryFailure(parsed, 400, "BadRequest");
    }
    return null;
  }
}

export async function getGraphFormInboxAttachment(
  graphId: string,
  filename: string,
  mailbox?: string,
  options?: { sizeBytes?: number; maxBytes?: number },
): Promise<FormInboxAttachment | null> {
  const config = getGraphMailConfig();
  if (!config) {
    throw new FormInboxError("Microsoft Graph is niet geconfigureerd.");
  }
  const box = mailbox || config.mailbox;
  const accessToken = await getGraphAccessToken(config);

  const data = await graphFetch<GraphListResponse<GraphAttachment>>(
    usersPath(box, `/messages/${encodeURIComponent(graphId)}/attachments`),
    { accessToken },
  );

  // Include inline images so form photos (sometimes marked inline by Graph) download.
  const list = mapAttachments(data.value, { includeInline: true });
  const { pickFormInboxAttachmentForDownload } = await import("./form-inbox-attachment");
  const hit = pickFormInboxAttachmentForDownload(
    list,
    filename,
    options?.sizeBytes,
  );

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
    const mapped = mapAttachmentMeta(att, { includeInline: true });
    if (mapped?.contentBase64) return mapped;
    if (mapped) return { ...mapped, omitted: true };
  }

  return { ...hit, omitted: true };
}

/**
 * Move a form notification to Deleted Items (soft-delete).
 * Requires Mail.ReadWrite on the Graph application.
 */
async function deleteGraphFormInboxMessageWithToken(
  graphId: string,
  box: string,
  accessToken: string,
  mailboxForErrors: string,
): Promise<void> {
  const movePath = usersPath(box, `/messages/${encodeURIComponent(graphId)}/move`);
  const deletePath = usersPath(box, `/messages/${encodeURIComponent(graphId)}`);

  try {
    await graphFetch(movePath, {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destinationId: "deleteditems" }),
    });
    return;
  } catch (error) {
    if (!(error instanceof FormInboxError)) throw error;
  }

  try {
    await graphFetch(deletePath, {
      method: "DELETE",
      accessToken,
    });
  } catch (error) {
    if (!(error instanceof FormInboxError)) throw error;
    throw new FormInboxError(
      rewriteGraphMailWriteErrorMessage(error.message, mailboxForErrors),
    );
  }
}

function rewriteGraphMailWriteErrorMessage(message: string, mailbox: string): string {
  const lower = message.toLowerCase();
  if (
    /toegang geweigerd|accessdenied|forbidden|authorization_requestdenied|http_403/i.test(
      lower,
    )
  ) {
    return formatGraphMailWriteError({
      status: 403,
      code: "ErrorAccessDenied",
      detail: message,
      mailbox,
    });
  }
  return message;
}

export async function deleteGraphFormInboxMessage(
  graphId: string,
  mailbox?: string,
): Promise<void> {
  const config = getGraphMailConfig();
  if (!config) {
    throw new FormInboxError("Microsoft Graph is niet geconfigureerd.");
  }
  const box = mailbox || config.mailbox;
  const accessToken = await getGraphAccessToken(config);
  await deleteGraphFormInboxMessageWithToken(graphId, box, accessToken, config.mailbox);
}

export type GraphSendAttachment = {
  filename: string;
  contentBase64: string;
  contentType?: string;
  /** When set with isInline, embeds as cid: in HTML (staff brand logo). */
  contentId?: string;
  isInline?: boolean;
};

export type GraphSendReplyResult =
  | {
      ok: true;
      /** RFC Message-ID when resolved from Sent Items / draft. */
      messageId?: string;
      graphMessageId?: string;
      internetMessageId?: string;
      conversationId?: string;
      conversationIndex?: string;
      sentAt?: string;
      identityPending?: boolean;
    }
  | { ok: false; error: string };

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve the Sent Items copy after a reply/send. Graph is eventually consistent.
 */
async function resolveSentReplyIdentity(options: {
  accessToken: string;
  mailbox: string;
  conversationId: string | null | undefined;
  toAddress: string;
  subject: string;
}): Promise<{
  graphMessageId?: string;
  internetMessageId?: string;
  conversationId?: string;
  conversationIndex?: string;
  sentAt?: string;
} | null> {
  const to = options.toAddress.trim().toLowerCase();
  const select =
    "id,internetMessageId,conversationId,conversationIndex,sentDateTime,subject,toRecipients";

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await sleepMs(400 * 2 ** (attempt - 1));

    let url: string;
    if (options.conversationId) {
      // sentDateTime must lead $filter when it is used in $orderby.
      const filter = buildConversationSentFilter(
        options.conversationId,
        new Date(Date.now() - 15 * 60_000).toISOString(),
      );
      url =
        usersPath(options.mailbox, "/mailFolders/sentitems/messages") +
        `?$filter=${encodeURIComponent(filter)}` +
        `&$select=${encodeURIComponent(select)}` +
        `&$orderby=${encodeURIComponent("sentDateTime desc")}` +
        `&$top=5`;
    } else {
      url =
        usersPath(options.mailbox, "/mailFolders/sentitems/messages") +
        `?$select=${encodeURIComponent(select)}` +
        `&$orderby=${encodeURIComponent("sentDateTime desc")}` +
        `&$top=8`;
    }

    try {
      const data = await graphFetch<GraphListResponse<GraphMessage>>(url, {
        accessToken: options.accessToken,
      });
      const candidates = data.value ?? [];
      const hit =
        candidates.find((msg) =>
          (msg.toRecipients ?? []).some(
            (r) => recipientAddress(r)?.toLowerCase() === to,
          ),
        ) ??
        candidates.find((msg) =>
          (msg.subject || "").toLowerCase().includes(
            options.subject.replace(/^re:\s*/i, "").trim().toLowerCase().slice(0, 40),
          ),
        ) ??
        candidates[0];
      if (!hit?.id) continue;
      return {
        graphMessageId: hit.id,
        internetMessageId: hit.internetMessageId ?? undefined,
        conversationId: hit.conversationId ?? options.conversationId ?? undefined,
        conversationIndex: hit.conversationIndex ?? undefined,
        sentAt: hit.sentDateTime ?? hit.receivedDateTime ?? new Date().toISOString(),
      };
    } catch {
      /* retry */
    }
  }
  return null;
}

export async function sendGraphAdminReply(options: {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  /** BCC so Aanvragen can show the outbound reply in the conversation list. */
  bcc?: string | string[];
  /** When set, uses createReply → patch recipients/body → send (preserves Graph thread). */
  inReplyToGraphId?: string;
  inReplyToInternetMessageId?: string;
  /** Custom x-* internet headers (Graph only allows extension headers). */
  headers?: Record<string, string>;
  attachments?: GraphSendAttachment[];
  /** Default true — staff replies. Form notifications pass false to avoid Sent Items dupes. */
  saveToSentItems?: boolean;
}): Promise<GraphSendReplyResult> {
  const config = getGraphMailConfig();
  if (!config) {
    return { ok: false, error: "Microsoft Graph is niet geconfigureerd." };
  }

  try {
    const accessToken = await getGraphAccessToken(config);

    const internetMessageHeaders = Object.entries(options.headers ?? {})
      .filter(([name, value]) => name.trim() && value.trim())
      .map(([name, value]) => {
        const headerName = name.trim();
        // Graph only accepts extension headers (must start with x- / X-).
        const safeName = /^x-/i.test(headerName) ? headerName : `x-${headerName}`;
        return { name: safeName, value: value.trim().slice(0, 500) };
      });

    const fileAttachments = (options.attachments ?? [])
      .filter((a) => a.filename && a.contentBase64)
      .slice(0, 8)
      .map((a) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.filename.slice(0, 180),
        contentType: a.contentType || "application/octet-stream",
        contentBytes: a.contentBase64,
        ...(a.isInline && a.contentId
          ? { isInline: true, contentId: a.contentId.slice(0, 180) }
          : {}),
      }));

    const bccList = (Array.isArray(options.bcc) ? options.bcc : options.bcc ? [options.bcc] : [])
      .map((addr) => addr.trim().toLowerCase())
      .filter((addr) => addr.length > 0 && addr !== options.to.trim().toLowerCase());

    const replyDraftPatch = buildGraphReplyDraftPatch({
      html: options.html,
      to: options.to,
      replyTo: options.replyTo,
      bcc: bccList,
    });

    const messageBase = {
      subject: options.subject,
      ...replyDraftPatch,
      ...(fileAttachments.length > 0 ? { attachments: fileAttachments } : {}),
    };

    if (options.inReplyToGraphId) {
      // Prefer createReply so Graph keeps conversationId / In-Reply-To.
      // Override toRecipients to the website visitor (form notifications are From our mailbox).
      // Never PATCH internetMessageHeaders — Graph returns ErrorInvalidPropertySet.
      let draft: GraphMessage;
      try {
        draft = await graphFetch<GraphMessage>(
          usersPath(
            config.mailbox,
            `/messages/${encodeURIComponent(options.inReplyToGraphId)}/createReply`,
          ),
          {
            method: "POST",
            accessToken,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        );
      } catch (createReplyError) {
        // Parent may be deleted / immutable-id stale — fall through to sendMail.
        console.warn(
          "[graph-mail] createReply failed; using sendMail",
          createReplyError instanceof Error
            ? createReplyError.message.slice(0, 160)
            : "unknown",
        );
        draft = { id: undefined };
      }

      if (!draft?.id) {
        // Fallback: /reply with message override, then sendMail if that also fails.
        try {
          await graphFetch(
            usersPath(
              config.mailbox,
              `/messages/${encodeURIComponent(options.inReplyToGraphId)}/reply`,
            ),
            {
              method: "POST",
              accessToken,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: replyDraftPatch }),
            },
          );
          const resolved = await resolveSentReplyIdentity({
            accessToken,
            mailbox: config.mailbox,
            conversationId: draft?.conversationId ?? null,
            toAddress: options.to,
            subject: options.subject,
          });
          return {
            ok: true,
            messageId: resolved?.internetMessageId ?? options.inReplyToInternetMessageId,
            graphMessageId: resolved?.graphMessageId,
            internetMessageId: resolved?.internetMessageId,
            conversationId: resolved?.conversationId,
            sentAt: resolved?.sentAt,
            identityPending: !resolved?.internetMessageId,
          };
        } catch (replyError) {
          console.warn(
            "[graph-mail] /reply failed; using sendMail",
            replyError instanceof Error ? replyError.message.slice(0, 160) : "unknown",
          );
          // fall through to sendMail below
        }
      } else {
        await graphFetch(
          usersPath(config.mailbox, `/messages/${encodeURIComponent(draft.id)}`),
          {
            method: "PATCH",
            accessToken,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(replyDraftPatch),
          },
        );

        if (fileAttachments.length > 0) {
          for (const attachment of fileAttachments) {
            await graphFetch(
              usersPath(
                config.mailbox,
                `/messages/${encodeURIComponent(draft.id)}/attachments`,
              ),
              {
                method: "POST",
                accessToken,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(attachment),
              },
            );
          }
        }

        await graphFetch(
          usersPath(config.mailbox, `/messages/${encodeURIComponent(draft.id)}/send`),
          {
            method: "POST",
            accessToken,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({}),
          },
        );

        const resolved = await resolveSentReplyIdentity({
          accessToken,
          mailbox: config.mailbox,
          conversationId: draft.conversationId ?? null,
          toAddress: options.to,
          subject: options.subject,
        });

        return {
          ok: true,
          messageId: resolved?.internetMessageId ?? options.inReplyToInternetMessageId,
          graphMessageId: resolved?.graphMessageId,
          internetMessageId: resolved?.internetMessageId,
          conversationId: resolved?.conversationId ?? draft.conversationId ?? undefined,
          sentAt: resolved?.sentAt ?? new Date().toISOString(),
          identityPending: !resolved?.graphMessageId,
        };
      }
    }

    await graphFetch(usersPath(config.mailbox, "/sendMail"), {
      method: "POST",
      accessToken,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          ...messageBase,
          ...(internetMessageHeaders.length > 0 ? { internetMessageHeaders } : {}),
        },
        saveToSentItems: options.saveToSentItems !== false,
      }),
    });

    // Persist Sent Items identity so applicant replies can be correlated later.
    // Without this, standalone sendMail leaves conversationId unknown on the inquiry.
    const resolved =
      options.saveToSentItems === false
        ? null
        : await resolveSentReplyIdentity({
            accessToken,
            mailbox: config.mailbox,
            conversationId: null,
            toAddress: options.to,
            subject: options.subject,
          });

    return {
      ok: true,
      messageId: resolved?.internetMessageId,
      graphMessageId: resolved?.graphMessageId,
      internetMessageId: resolved?.internetMessageId,
      conversationId: resolved?.conversationId,
      sentAt: resolved?.sentAt ?? new Date().toISOString(),
      identityPending: Boolean(options.saveToSentItems !== false && !resolved?.graphMessageId),
    };
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
