import { ImapFlow, type MessageEnvelopeObject } from "imapflow";
import { simpleParser, type AddressObject, type Attachment, type ParsedMail } from "mailparser";
import type { FormKind } from "@mccoy/domain";
import { FIELD_LABELS_NL, KIND_LABELS } from "@mccoy/domain";
import { readServerEnv } from "@mccoy/security";

import {
  classifyFormEmailSubject,
  extractFormScopeKeyFromSubject,
  extractRequestNumber,
  extractSubmitterNameFromSubject,
} from "./classify-form-email";
import { filterInboxMessages, buildInboxFacets, type InboxFacets } from "./filter-inbox-messages";
import {
  FormInboxConfigError,
  FormInboxError,
  type FormInboxAttachment,
  type FormInboxMessage,
  type FormInboxMessageSummary,
  type FormInboxThreadItem,
} from "./form-inbox-contracts";
import {
  formInboxConfigHelpMessage,
  shouldAllowImapInbox,
  shouldAttemptGraphMail,
  shouldFallbackFromGraph,
} from "./form-inbox-provider";
import {
  getGraphFormInboxAttachment,
  getGraphFormInboxMessage,
  getGraphFormInboxThread,
  listGraphFormInboxMessages,
} from "./graph-mail";
import {
  decodeInboxMessageId,
  encodeImapMessageId,
  type DecodedInboxMessageId,
} from "./inbox-message-id";
import {
  isMicrosoft365ImapHost,
  microsoft365ImapBasicAuthBlockedMessage,
} from "./m365-imap";
import {
  parseAttachmentNamesFromBody,
  parseFormFieldsFromHtml,
  parseFormFieldsFromText,
  normalizeFormFieldLabel,
  type ParsedFormField,
} from "./parse-form-fields";
import { escapeHtml } from "./templates";

export {
  FormInboxConfigError,
  FormInboxError,
  type FormInboxAttachment,
  type FormInboxMessage,
  type FormInboxMessageSummary,
  type FormInboxThreadItem,
} from "./form-inbox-contracts";
export {
  decodeInboxMessageId,
  encodeGraphMessageId,
  encodeImapMessageId,
  type DecodedInboxMessageId,
} from "./inbox-message-id";

const DEFAULT_HOST = "imap.gmail.com";
const DEFAULT_PORT = 993;
const DEFAULT_MAILBOX = "INBOX";
/** List page: keep small — full MIME is only fetched on detail open. */
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 80;
const MAX_THREAD_MESSAGES = 12;
const MAX_THREAD_CANDIDATES = 25;
const THREAD_LOOKBACK_DAYS = 60;
const MAX_ATTACHMENT_BYTES = 3.5 * 1024 * 1024;
const MAX_ATTACHMENTS = 8;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

type InboxConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  mailbox: string;
};

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/);
  return (match?.[1] || raw).trim().toLowerCase();
}

/** Prefer FORM_INBOX_*; otherwise map SMTP_HOST to the correct IMAP endpoint. */
function deriveImapHost(): string {
  const explicit = readServerEnv("FORM_INBOX_HOST");
  if (explicit) return explicit;

  const smtpHost = readServerEnv("SMTP_HOST").toLowerCase().trim();
  if (!smtpHost) return DEFAULT_HOST;

  // Microsoft 365 / Exchange Online — do NOT use imap.office365.com (ENOTFOUND).
  if (
    smtpHost === "smtp.office365.com" ||
    smtpHost === "smtp-mail.outlook.com" ||
    smtpHost.includes("office365") ||
    smtpHost.includes("outlook.com")
  ) {
    return "outlook.office365.com";
  }

  if (smtpHost === "smtp.gmail.com" || smtpHost.includes("gmail")) {
    return "imap.gmail.com";
  }

  if (smtpHost.startsWith("smtp.")) {
    return `imap.${smtpHost.slice("smtp.".length)}`;
  }

  return DEFAULT_HOST;
}

function inboxAuthUser(): string {
  // IMAP login must be the mailbox that owns the App Password (SMTP_USER / FROM),
  // not SMTP_REPLY_TO (often a different alias and causes AuthenticationFailed).
  const candidates = [
    readServerEnv("FORM_INBOX_USER"),
    readServerEnv("SMTP_USER"),
    readServerEnv("SMTP_FROM_EMAIL"),
    readServerEnv("FORM_TO_EMAIL"),
  ];
  for (const raw of candidates) {
    const email = extractEmailAddress(raw);
    if (email && EMAIL_RE.test(email)) return email;
  }
  return "";
}

function inboxAuthPass(): string {
  return (
    readServerEnv("FORM_INBOX_PASS") ||
    readServerEnv("SMTP_PASS") ||
    readServerEnv("SMTP_PASSWORD") ||
    ""
  );
}

function getInboxConfig(): InboxConfig | null {
  const user = inboxAuthUser();
  const pass = inboxAuthPass();
  if (!user || !pass) return null;

  const portRaw = readServerEnv("FORM_INBOX_PORT") || String(DEFAULT_PORT);
  const port = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw new FormInboxConfigError("FORM_INBOX_PORT must be a valid port number.");
  }

  return {
    host: deriveImapHost(),
    port,
    user,
    pass,
    mailbox: readServerEnv("FORM_INBOX_MAILBOX") || DEFAULT_MAILBOX,
  };
}

export function isFormInboxConfigured(): boolean {
  // Deterministic JSON-store inbox for Playwright (MCCOY_E2E=1).
  if (process.env.MCCOY_E2E === "1") return true;
  if (shouldAttemptGraphMail()) return true;
  if (shouldAllowImapInbox() && getInboxConfig() !== null) return true;
  return false;
}

/** @deprecated Prefer encodeImapMessageId — kept for existing IMAP call sites. */
export function encodeInboxMessageId(uid: number, mailbox = DEFAULT_MAILBOX): string {
  return encodeImapMessageId(uid, mailbox);
}

function addressListToText(value: AddressObject | AddressObject[] | undefined): string {
  if (!value) return "";
  const list = Array.isArray(value) ? value : [value];
  return list
    .flatMap((entry) => entry.value.map((a) => a.address || a.name || "").filter(Boolean))
    .join(", ");
}

function firstAddress(value: AddressObject | AddressObject[] | undefined): string | null {
  if (!value) return null;
  const list = Array.isArray(value) ? value : [value];
  for (const entry of list) {
    for (const addr of entry.value) {
      if (addr.address && EMAIL_RE.test(addr.address)) {
        return addr.address.trim().toLowerCase();
      }
    }
  }
  return null;
}

function firstName(value: AddressObject | AddressObject[] | undefined): string {
  if (!value) return "";
  const list = Array.isArray(value) ? value : [value];
  for (const entry of list) {
    for (const addr of entry.value) {
      if (addr.name?.trim()) return addr.name.trim();
    }
  }
  return "";
}

function configuredFromAddress(): string {
  const candidates = [
    readServerEnv("FORM_FROM_EMAIL"),
    readServerEnv("SMTP_FROM_EMAIL"),
    readServerEnv("SMTP_USER"),
    readServerEnv("FORM_INBOX_USER"),
  ];
  for (const raw of candidates) {
    const email = extractEmailAddress(raw);
    if (email && EMAIL_RE.test(email)) return email;
  }
  return "";
}

function configuredFromDisplayName(): string {
  return (readServerEnv("SMTP_FROM_NAME") || "McCoy Website").trim();
}

/**
 * Only McCoy website form notifications (From configured SMTP / "McCoy Website"),
 * not unrelated mail that happens to share a subject keyword.
 * Legacy `@resend.dev` senders are still recognized for historical mailbox messages.
 */
export function isMcCoyWebsiteFormNotification(parsed: ParsedMail): boolean {
  const fromName = firstName(parsed.from).toLowerCase();
  const fromAddr = firstAddress(parsed.from) || "";
  const configured = configuredFromAddress();
  const configuredName = configuredFromDisplayName().toLowerCase();

  if (fromName.includes("mccoy website")) return true;
  if (configuredName && fromName.includes(configuredName)) return true;
  if (configured && fromAddr === configured) return true;
  if (fromAddr.endsWith("@resend.dev") && fromName.includes("mccoy")) return true;

  const html = typeof parsed.html === "string" ? parsed.html : "";
  const text = parsed.text || "";
  if (
    /verstuurd via het mccoy websiteformulier/i.test(html) ||
    /verstuurd via het mccoy websiteformulier/i.test(text) ||
    /sent from the mccoy website form/i.test(html) ||
    /sent from the mccoy website form/i.test(text)
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

function bodyPlain(parsed: ParsedMail): string {
  if (parsed.text?.trim()) return parsed.text.trim();
  if (typeof parsed.html === "string" && parsed.html.trim()) {
    return stripHtmlToText(parsed.html);
  }
  return "";
}

function makeSnippet(text: string, max = 160): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1)}…`;
}

function resolveSubmitterName(
  subject: string,
  fields?: ParsedFormField[],
): string | null {
  const fromFields = fields?.find((f) => f.key === "name")?.value.trim();
  if (fromFields && fromFields.length <= 120) return fromFields;
  return extractSubmitterNameFromSubject(subject);
}

/** Prefer message body for list/snippet; never the branded email chrome. */
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

function bufferToBase64(buf: Buffer): string {
  return buf.toString("base64");
}

function mapAttachments(
  list: Attachment[] | undefined,
  options?: { includeContent?: boolean },
): FormInboxAttachment[] {
  if (!list?.length) return [];
  const includeContent = options?.includeContent !== false;
  const out: FormInboxAttachment[] = [];
  for (const att of list.slice(0, MAX_ATTACHMENTS)) {
    const filename = (att.filename || "bijlage").replace(/[^\w.\- ()[\]]+/g, "_");
    const contentType = att.contentType || "application/octet-stream";
    const content = att.content;
    const size =
      typeof att.size === "number"
        ? att.size
        : Buffer.isBuffer(content)
          ? content.length
          : 0;

    if (
      !includeContent ||
      !Buffer.isBuffer(content) ||
      size <= 0 ||
      size > MAX_ATTACHMENT_BYTES
    ) {
      out.push({
        filename,
        contentType,
        size,
        omitted: includeContent ? true : size > MAX_ATTACHMENT_BYTES || size <= 0,
      });
      continue;
    }
    out.push({
      filename,
      contentType,
      size,
      contentBase64: bufferToBase64(content),
    });
  }
  return out;
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

function parseFields(parsed: ParsedMail): ParsedFormField[] {
  const html = typeof parsed.html === "string" ? parsed.html : "";
  const fromHtml = sanitizeParsedFields(parseFormFieldsFromHtml(html));
  if (fromHtml.length > 0) return fromHtml;
  return sanitizeParsedFields(parseFormFieldsFromText(bodyPlain(parsed)));
}

function parseFieldsFromParts(text: string, html: string): ParsedFormField[] {
  const fromHtml = sanitizeParsedFields(parseFormFieldsFromHtml(html));
  if (fromHtml.length > 0) return fromHtml;
  return sanitizeParsedFields(parseFormFieldsFromText(text || stripHtmlToText(html)));
}

/**
 * Prefer Reply-To (notifications set this to the form submitter), then labeled body email,
 * then From when it is not our notification mailbox.
 */
export function resolveSubmitterEmail(
  parsed: ParsedMail,
  inboxUser: string,
): string | null {
  const replyTo = firstAddress(parsed.replyTo);
  if (replyTo) return replyTo;

  const fields = parseFields(parsed);
  const emailField = fields.find((f) => f.key === "email");
  if (emailField && EMAIL_RE.test(emailField.value)) {
    return emailField.value.trim().toLowerCase();
  }

  const fromBody = extractEmailFromText(bodyPlain(parsed));
  if (fromBody && fromBody !== inboxUser.toLowerCase()) return fromBody;

  const from = firstAddress(parsed.from);
  if (from && from !== inboxUser.toLowerCase()) return from;

  return null;
}

async function withImapClient<T>(fn: (client: ImapFlow, config: InboxConfig) => Promise<T>): Promise<T> {
  let config: InboxConfig | null;
  try {
    config = getInboxConfig();
  } catch (error) {
    if (error instanceof FormInboxConfigError) throw error;
    throw error;
  }
  if (!config) {
    throw new FormInboxConfigError(formInboxConfigHelpMessage());
  }

  // M365 disables IMAP basic auth — fail before a noisy connect attempt.
  if (isMicrosoft365ImapHost(config.host)) {
    throw new FormInboxError(microsoft365ImapBasicAuthBlockedMessage(config.user));
  }

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    logger: false,
    // Prevent hung Gmail sockets from taking down the Vite/Node process
    socketTimeout: 60_000,
    greetingTimeout: 20_000,
    connectionTimeout: 20_000,
    tls: {
      rejectUnauthorized: true,
    },
  });

  // CRITICAL: ImapFlow emits 'error' on socket timeout; without a listener Node crashes.
  let socketError: Error | null = null;
  client.on("error", (err: Error) => {
    socketError = err;
  });

  try {
    await client.connect();
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    const responseText =
      error && typeof error === "object" && "responseText" in error
        ? String((error as { responseText?: unknown }).responseText ?? "")
        : "";
    const authFailed =
      (error &&
        typeof error === "object" &&
        "authenticationFailed" in error &&
        Boolean((error as { authenticationFailed?: unknown }).authenticationFailed)) ||
      /auth|invalid credentials|login|authentication/i.test(`${detail} ${responseText}`);

    console.error("[form-inbox] IMAP connect failed", {
      host: config.host,
      port: config.port,
      user: config.user,
      error: detail,
      responseText: responseText.slice(0, 200) || undefined,
      authenticationFailed: authFailed,
    });
    try {
      client.close();
    } catch {
      // ignore
    }

    const isMicrosoft = isMicrosoft365ImapHost(config.host);

    if (isMicrosoft) {
      throw new FormInboxError(microsoft365ImapBasicAuthBlockedMessage(config.user));
    }

    throw new FormInboxError(
      authFailed
        ? `Mailbox-login mislukt voor ${config.user}. Gebruik SMTP_USER + SMTP_PASSWORD (App Password). SMTP_REPLY_TO is geen login.`
        : `Kon geen verbinding maken met ${config.host}:${config.port} als ${config.user}. (${(responseText || detail).slice(0, 160)})`,
    );
  }

  try {
    const result = await fn(client, config);
    if (socketError) {
      throw new FormInboxError(
        "Mailboxverbinding time-out. Probeer het bericht opnieuw te openen.",
      );
    }
    return result;
  } catch (error) {
    if (error instanceof FormInboxError || error instanceof FormInboxConfigError) throw error;
    const code = (error as { code?: string }).code;
    if (code === "ETIMEOUT" || socketError || (error instanceof Error && /timeout/i.test(error.message))) {
      throw new FormInboxError(
        "Mailboxverbinding time-out bij het laden van het bericht. Probeer opnieuw.",
      );
    }
    throw error;
  } finally {
    try {
      if (client.usable) {
        await client.logout();
      } else {
        client.close();
      }
    } catch {
      try {
        client.close();
      } catch {
        // ignore
      }
    }
  }
}

/** ImapFlow stores Content-Type as a single string (e.g. "text/html"), not type+subtype. */
type StructureNode = {
  part?: string;
  type?: string | null;
  subtype?: string | null;
  disposition?: string | null;
  dispositionParameters?: { [key: string]: string };
  parameters?: { [key: string]: string };
  size?: number;
  childNodes?: StructureNode[];
};

function nodeMime(node: StructureNode): { type: string; subtype: string; full: string } {
  const raw = (node.type || "").toLowerCase().trim();
  if (raw.includes("/")) {
    const [type = "", subtype = ""] = raw.split("/", 2);
    return { type, subtype, full: raw };
  }
  const subtype = (node.subtype || "").toLowerCase().trim();
  return {
    type: raw,
    subtype,
    full: subtype ? `${raw}/${subtype}` : raw,
  };
}

function nodeFilename(node: StructureNode): string | null {
  const raw =
    node.dispositionParameters?.filename ||
    node.parameters?.name ||
    node.dispositionParameters?.Filename ||
    node.parameters?.Name ||
    null;
  if (!raw?.trim()) return null;
  return raw.replace(/[^\w.\- ()[\]]+/g, "_").trim() || null;
}

/** Collect text/html part paths from BODYSTRUCTURE (skip attachments). */
function collectTextPartPaths(node: StructureNode | null | undefined, out: string[] = []): string[] {
  if (!node) return out;
  const disposition = (node.disposition || "").toLowerCase();
  const { type, subtype, full } = nodeMime(node);

  if (disposition === "attachment") {
    return out;
  }

  const isText =
    (type === "text" && (subtype === "plain" || subtype === "html")) ||
    full === "text/plain" ||
    full === "text/html";

  if (isText && node.part) {
    out.push(node.part);
  }

  if (Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) {
      collectTextPartPaths(child, out);
    }
  }
  return out;
}

/** Attachment metadata from BODYSTRUCTURE — no binary download. */
function collectAttachmentMetas(
  node: StructureNode | null | undefined,
  out: FormInboxAttachment[] = [],
): FormInboxAttachment[] {
  if (!node) return out;
  const disposition = (node.disposition || "").toLowerCase();
  const { type, full } = nodeMime(node);
  const filename = nodeFilename(node);
  const isMultipart = type === "multipart" || full.startsWith("multipart/");
  const isText = type === "text" || full.startsWith("text/");
  const isAttachment =
    disposition === "attachment" ||
    (!!filename && !isMultipart && !isText && disposition !== "inline") ||
    (disposition === "inline" && !!filename && !isText && !isMultipart);

  if (isAttachment && node.part && out.length < MAX_ATTACHMENTS) {
    out.push({
      filename: filename || `bijlage-${node.part}`,
      contentType: full || "application/octet-stream",
      size: typeof node.size === "number" ? node.size : 0,
      omitted: true,
      part: node.part,
    });
  }

  if (Array.isArray(node.childNodes)) {
    for (const child of node.childNodes) {
      collectAttachmentMetas(child, out);
    }
  }
  return out;
}

function mergeAttachmentLists(
  fromStructure: FormInboxAttachment[],
  fromBodyNames: string[],
): FormInboxAttachment[] {
  const out = [...fromStructure];
  const seen = new Set(out.map((a) => a.filename.toLowerCase()));
  for (const name of fromBodyNames) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      filename: name,
      contentType: "application/octet-stream",
      size: 0,
      omitted: true,
    });
    if (out.length >= MAX_ATTACHMENTS) break;
  }
  return out;
}

async function readDownloadStream(
  content: AsyncIterable<Buffer | Uint8Array> | NodeJS.ReadableStream,
  maxBytes: number,
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of content as AsyncIterable<Buffer | Uint8Array>) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buf);
    total += buf.length;
    if (total > maxBytes) break;
  }
  return Buffer.concat(chunks);
}

async function fetchMessageTextOnly(
  client: ImapFlow,
  uid: number,
): Promise<{
  text: string;
  html: string;
  envelope: MessageEnvelopeObject | null;
  flags: Set<string> | undefined;
  size: number;
  attachments: FormInboxAttachment[];
}> {
  let envelope: MessageEnvelopeObject | null = null;
  let flags: Set<string> | undefined;
  let size = 0;
  let structure: StructureNode | null = null;

  for await (const msg of client.fetch(
    String(uid),
    { uid: true, flags: true, envelope: true, bodyStructure: true, size: true },
    { uid: true },
  )) {
    envelope = msg.envelope ?? null;
    flags = msg.flags;
    size = typeof msg.size === "number" ? msg.size : 0;
    structure = (msg.bodyStructure as StructureNode | undefined) ?? null;
  }

  const parts = collectTextPartPaths(structure);
  const structureAttachments = collectAttachmentMetas(structure);

  let text = "";
  let html = "";

  // Prefer small full-source parse only when message is tiny (no big PDF)
  if (size > 0 && size <= 350_000 && parts.length === 0) {
    for await (const msg of client.fetch(String(uid), { uid: true, source: true }, { uid: true })) {
      if (!msg.source) break;
      const parsed = await simpleParser(msg.source);
      return {
        text: parsed.text || "",
        html: typeof parsed.html === "string" ? parsed.html : "",
        envelope,
        flags,
        size,
        attachments: mergeAttachmentLists(
          structureAttachments,
          mapAttachments(parsed.attachments, { includeContent: false }).map((a) => a.filename),
        ),
      };
    }
  }

  // Prefer HTML over plain when both exist
  const ordered = [...parts].sort((a, b) => {
    // keep discovery order but process later; download all and classify by meta
    return a.localeCompare(b, undefined, { numeric: true });
  });

  for (const part of ordered.slice(0, 6)) {
    try {
      const downloaded = await client.download(String(uid), part, { uid: true });
      const buf = await readDownloadStream(downloaded.content, 800_000);
      const content = buf.toString("utf8");
      const subtype = (downloaded.meta.contentType || "").toLowerCase();
      if (subtype.includes("html") || content.trimStart().startsWith("<")) {
        if (!html || content.length > html.length) html = content;
      } else if (!text || (subtype.includes("plain") && content.length > text.length)) {
        text = content;
      }
    } catch {
      // try next part
    }
  }

  // Last resort: small source fetch if we still have no body
  if (!text && !html && size <= 500_000) {
    for await (const msg of client.fetch(String(uid), { uid: true, source: true }, { uid: true })) {
      if (!msg.source) break;
      const parsed = await simpleParser(msg.source);
      text = parsed.text || text;
      html = typeof parsed.html === "string" ? parsed.html : html;
      return {
        text,
        html,
        envelope,
        flags,
        size,
        attachments: mergeAttachmentLists(
          structureAttachments,
          mapAttachments(parsed.attachments, { includeContent: false }).map((a) => a.filename),
        ),
      };
    }
  }

  return {
    text,
    html,
    envelope,
    flags,
    size,
    attachments: structureAttachments,
  };
}

function messageFromTextParts(
  uid: number,
  mailbox: string,
  inboxUser: string,
  envelope: MessageEnvelopeObject | null,
  flags: Set<string> | undefined,
  text: string,
  html: string,
  structureAttachments: FormInboxAttachment[] = [],
): FormInboxMessage | null {
  const subject = (envelope?.subject || "").trim() || "(geen onderwerp)";
  const kind = classifyFormEmailSubject(subject);
  if (!kind) return null;

  const fromName = envelopeFirstName(envelope?.from).toLowerCase();
  const fromAddr = envelopeFirstAddress(envelope?.from) || "";
  const configured = configuredFromAddress();
  const configuredName = configuredFromDisplayName().toLowerCase();
  const isMcCoy =
    fromName.includes("mccoy website") ||
    (configuredName.length > 0 && fromName.includes(configuredName)) ||
    (configured && fromAddr === configured) ||
    (fromAddr.endsWith("@resend.dev") && fromName.includes("mccoy")) ||
    /verstuurd via het mccoy websiteformulier|sent from the mccoy website form/i.test(
      `${text}\n${html}`,
    );
  // Subject already classified as a form kind; allow open even if From is odd
  if (!isMcCoy && !fromName && !fromAddr) return null;

  const fields = parseFieldsFromParts(text, html);
  const textBody = (text || stripHtmlToText(html)).trim();
  const flagSet = flags instanceof Set ? flags : new Set(flags ?? []);
  const submitterEmail =
    envelopeFirstAddress(envelope?.replyTo) ||
    fields.find((f) => f.key === "email")?.value.trim().toLowerCase() ||
    null;

  const attachments = mergeAttachmentLists(
    structureAttachments,
    parseAttachmentNamesFromBody(textBody),
  );

  return {
    id: encodeInboxMessageId(uid, mailbox),
    uid,
    kind,
    subject,
    from: envelopeAddressesText(envelope?.from) || "(onbekend)",
    to: envelopeAddressesText(envelope?.to) || inboxUser,
    date: (envelope?.date ?? new Date()).toISOString(),
    snippet: formMessageSnippet(fields, textBody, subject),
    unread: !flagSet.has("\\Seen"),
    submitterName: resolveSubmitterName(subject, fields),
    submitterEmail,
    requestNumber: extractRequestNumber(subject, textBody),
    scopeKey: extractFormScopeKeyFromSubject(subject),
    scopeLabel: fields.find((f) => f.label.toLowerCase() === "scope")?.value?.trim() || null,
    textBody,
    htmlSafePreview: "",
    replyToHeader: envelopeFirstAddress(envelope?.replyTo),
    messageId: envelope?.messageId ?? null,
    fields,
    attachments,
    thread: [
      {
        id: encodeInboxMessageId(uid, mailbox),
        uid,
        direction: "form",
        from: envelopeAddressesText(envelope?.from) || "(onbekend)",
        to: envelopeAddressesText(envelope?.to) || inboxUser,
        date: (envelope?.date ?? new Date()).toISOString(),
        subject,
        textBody,
        messageId: envelope?.messageId ?? null,
        attachments,
      },
    ],
  };
}

async function searchMcCoyFormUids(client: ImapFlow): Promise<number[]> {
  // IMAP SEARCH by known transactional From name / address (SMTP_FROM_* or legacy McCoy Website).
  const fromQueries = new Set<string>();
  fromQueries.add("McCoy Website");
  const displayName = configuredFromDisplayName();
  if (displayName) fromQueries.add(displayName);
  const fromAddr = configuredFromAddress();
  if (fromAddr) fromQueries.add(fromAddr);

  const uidSet = new Set<number>();
  for (const from of fromQueries) {
    try {
      const fromHits = await client.search({ from }, { uid: true });
      if (Array.isArray(fromHits)) {
        for (const uid of fromHits) {
          if (typeof uid === "number") uidSet.add(uid);
        }
      }
    } catch (error) {
      console.error("[form-inbox] from search failed", {
        from,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
  return [...uidSet].sort((a, b) => b - a);
}

function envelopeAddressesText(
  list: MessageEnvelopeObject["from"] | MessageEnvelopeObject["to"] | undefined,
): string {
  if (!list?.length) return "";
  return list
    .map((a) => {
      const email = a.address || "";
      const name = a.name || "";
      if (name && email) return `${name} <${email}>`;
      return email || name;
    })
    .filter(Boolean)
    .join(", ");
}

function envelopeFirstAddress(
  list: MessageEnvelopeObject["from"] | MessageEnvelopeObject["replyTo"] | undefined,
): string | null {
  if (!list?.length) return null;
  for (const a of list) {
    if (a.address && EMAIL_RE.test(a.address)) return a.address.trim().toLowerCase();
  }
  return null;
}

function envelopeFirstName(
  list: MessageEnvelopeObject["from"] | undefined,
): string {
  if (!list?.length) return "";
  return list[0]?.name?.trim() || "";
}

function isMcCoyEnvelope(envelope: MessageEnvelopeObject | undefined | null): boolean {
  if (!envelope) return false;
  const name = envelopeFirstName(envelope.from).toLowerCase();
  const addr = envelopeFirstAddress(envelope.from) || "";
  const configured = configuredFromAddress();
  const configuredName = configuredFromDisplayName().toLowerCase();
  if (name.includes("mccoy website")) return true;
  if (configuredName && name.includes(configuredName)) return true;
  if (configured && addr === configured) return true;
  if (addr.endsWith("@resend.dev") && name.includes("mccoy")) return true;
  return false;
}

function summaryFromEnvelope(
  uid: number,
  mailbox: string,
  envelope: MessageEnvelopeObject,
  flags: Set<string> | string[] | undefined,
  inboxUser: string,
): FormInboxMessageSummary | null {
  if (!isMcCoyEnvelope(envelope)) return null;
  const subject = (envelope.subject || "").trim() || "(geen onderwerp)";
  const kind = classifyFormEmailSubject(subject);
  if (!kind) return null;

  const flagSet = flags instanceof Set ? flags : new Set(flags ?? []);
  const submitterEmail = envelopeFirstAddress(envelope.replyTo);
  const from = envelopeAddressesText(envelope.from) || "(onbekend)";

  return {
    id: encodeInboxMessageId(uid, mailbox),
    uid,
    kind,
    subject,
    from,
    to: envelopeAddressesText(envelope.to) || inboxUser,
    date: (envelope.date ?? new Date()).toISOString(),
    snippet: submitterEmail || KIND_LABELS[kind],
    unread: !flagSet.has("\\Seen"),
    submitterName: extractSubmitterNameFromSubject(subject),
    submitterEmail,
    requestNumber: extractRequestNumber(subject),
    scopeKey: extractFormScopeKeyFromSubject(subject),
    scopeLabel: null,
  };
}

function classifyDirection(
  parsed: ParsedMail,
  inboxUser: string,
  submitterEmail: string | null,
): FormInboxThreadItem["direction"] {
  if (isMcCoyWebsiteFormNotification(parsed) && classifyFormEmailSubject(parsed.subject)) {
    return "form";
  }
  const from = firstAddress(parsed.from);
  if (submitterEmail && from === submitterEmail) return "customer";
  if (from === configuredFromAddress()) return "admin";
  if (from === inboxUser.toLowerCase()) return "admin";
  if (isMcCoyWebsiteFormNotification(parsed)) return "admin";
  return "customer";
}

function toThreadItem(
  uid: number,
  mailbox: string,
  parsed: ParsedMail,
  inboxUser: string,
  submitterEmail: string | null,
): FormInboxThreadItem {
  return {
    id: encodeInboxMessageId(uid, mailbox),
    uid,
    direction: classifyDirection(parsed, inboxUser, submitterEmail),
    from: addressListToText(parsed.from) || "(onbekend)",
    to: addressListToText(parsed.to) || inboxUser,
    date: (parsed.date ?? new Date()).toISOString(),
    subject: parsed.subject?.trim() || "(geen onderwerp)",
    textBody: bodyPlain(parsed),
    messageId: parsed.messageId ?? null,
    attachments: mapAttachments(parsed.attachments, { includeContent: false }),
  };
}

function parsedToFormMessage(
  uid: number,
  mailbox: string,
  parsed: ParsedMail,
  flags: Set<string> | string[] | undefined,
  inboxUser: string,
): FormInboxMessage | null {
  if (!isMcCoyWebsiteFormNotification(parsed)) return null;

  const subject = parsed.subject?.trim() || "(geen onderwerp)";
  const kind = classifyFormEmailSubject(subject);
  if (!kind) return null;

  const textBody = bodyPlain(parsed);
  const fields = parseFields(parsed);
  const submitterEmail = resolveSubmitterEmail(parsed, inboxUser);
  const flagSet = flags instanceof Set ? flags : new Set(flags ?? []);
  const unread = !flagSet.has("\\Seen");
  const attachments = mapAttachments(parsed.attachments, { includeContent: false });

  if (attachments.length === 0) {
    for (const name of parseAttachmentNamesFromBody(textBody)) {
      attachments.push({
        filename: name,
        contentType: "application/octet-stream",
        size: 0,
        omitted: true,
      });
    }
  }

  return {
    id: encodeInboxMessageId(uid, mailbox),
    uid,
    kind,
    subject,
    from: addressListToText(parsed.from) || "(onbekend)",
    to: addressListToText(parsed.to) || inboxUser,
    date: (parsed.date ?? new Date()).toISOString(),
    snippet: formMessageSnippet(fields, textBody, subject),
    unread,
    submitterName: resolveSubmitterName(subject, fields),
    submitterEmail,
    requestNumber: extractRequestNumber(subject, textBody),
    scopeKey: extractFormScopeKeyFromSubject(subject),
    scopeLabel: fields.find((f) => f.label.toLowerCase() === "scope")?.value?.trim() || null,
    textBody,
    htmlSafePreview: escapeHtml(textBody).replaceAll("\n", "<br />"),
    replyToHeader: firstAddress(parsed.replyTo),
    messageId: parsed.messageId ?? null,
    fields,
    attachments,
    thread: [],
  };
}

function normalizeMsgId(id: string | undefined | null): string {
  return (id ?? "").replace(/[<>\s]/g, "").toLowerCase();
}

function subjectCore(subject: string): string {
  return subject.replace(/^(re|fw|fwd)\s*:\s*/gi, "").trim().toLowerCase();
}

function lookbackDate(): Date {
  return new Date(Date.now() - THREAD_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
}

async function buildThread(
  client: ImapFlow,
  mailbox: string,
  root: FormInboxMessage,
  rootParsed: ParsedMail,
  inboxUser: string,
): Promise<FormInboxThreadItem[]> {
  const submitter = root.submitterEmail;
  const rootMsgId = normalizeMsgId(root.messageId);
  const coreSubject = subjectCore(root.subject);
  const wr = root.requestNumber?.toLowerCase() ?? "";
  const since = lookbackDate();

  const candidateUids = new Set<number>([root.uid]);

  if (submitter) {
    try {
      const fromHits = await client.search({ from: submitter, since }, { uid: true });
      if (Array.isArray(fromHits)) {
        for (const uid of fromHits) if (typeof uid === "number") candidateUids.add(uid);
      }
    } catch {
      // ignore
    }
    try {
      const toHits = await client.search({ to: submitter, since }, { uid: true });
      if (Array.isArray(toHits)) {
        for (const uid of toHits) if (typeof uid === "number") candidateUids.add(uid);
      }
    } catch {
      // ignore
    }
  }

  // Envelope pass first â€” avoid downloading full MIME for unrelated mail
  const recent = [...candidateUids].sort((a, b) => b - a).slice(0, MAX_THREAD_CANDIDATES);
  const matchedUids: number[] = [root.uid];

  for await (const msg of client.fetch(
    recent,
    { uid: true, envelope: true },
    { uid: true },
  )) {
    if (typeof msg.uid !== "number" || !msg.envelope) continue;
    if (msg.uid === root.uid) continue;

    const subj = subjectCore(msg.envelope.subject || "");
    const from = envelopeFirstAddress(msg.envelope.from);
    const to = envelopeFirstAddress(msg.envelope.to);
    const msgId = normalizeMsgId(msg.envelope.messageId);
    const inReplyTo = normalizeMsgId(msg.envelope.inReplyTo);

    const refsRoot =
      !!rootMsgId && (inReplyTo === rootMsgId || msgId === rootMsgId);
    const sameSubject = !!coreSubject && (subj === coreSubject || subj.includes(coreSubject));
    const involvesSubmitter =
      !!submitter && (from === submitter || to === submitter);
    const sameWr = !!wr && (msg.envelope.subject || "").toLowerCase().includes(wr);

    if (
      refsRoot ||
      (sameSubject && involvesSubmitter) ||
      (sameWr && involvesSubmitter)
    ) {
      matchedUids.push(msg.uid);
    }
  }

  const fetchUids = [...new Set(matchedUids)]
    .sort((a, b) => a - b)
    .slice(-MAX_THREAD_MESSAGES);

  const thread: FormInboxThreadItem[] = [];

  for await (const msg of client.fetch(
    fetchUids,
    { uid: true, source: true },
    { uid: true },
  )) {
    if (!msg.source || typeof msg.uid !== "number") continue;
    let parsed: ParsedMail;
    try {
      parsed = await simpleParser(msg.source);
    } catch {
      continue;
    }
    thread.push(toThreadItem(msg.uid, mailbox, parsed, inboxUser, submitter));
  }

  if (!thread.some((t) => t.uid === root.uid)) {
    thread.unshift(toThreadItem(root.uid, mailbox, rootParsed, inboxUser, submitter));
  }

  thread.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return thread;
}

export async function listFormInboxMessages(options?: {
  kind?: FormKind | "all";
  scopeKey?: string | "all";
  q?: string;
  limit?: number;
}): Promise<{ items: FormInboxMessageSummary[]; facets: InboxFacets }> {
  if (process.env.MCCOY_E2E === "1") {
    const { listE2eFormInboxMessages } = await import("./e2e-form-inbox");
    return listE2eFormInboxMessages(options);
  }

  if (shouldAttemptGraphMail()) {
    try {
      return await listGraphFormInboxMessages(options);
    } catch (error) {
      const imapConfig =
        shouldFallbackFromGraph() && shouldAllowImapInbox() ? getInboxConfig() : null;
      const canFallback =
        imapConfig !== null && !isMicrosoft365ImapHost(imapConfig.host);
      if (!canFallback) throw error;
      const message = error instanceof Error ? error.message.slice(0, 160) : "unknown";
      console.error("[form-inbox] Graph list failed; falling back to IMAP", { message });
    }
  }

  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  return withImapClient(async (client, config) => {
    const lock = await client.getMailboxLock(config.mailbox);
    try {
      const uids = await searchMcCoyFormUids(client);
      if (uids.length === 0) {
        return { items: [], facets: { kinds: [], scopes: [] } };
      }

      // Fetch only envelopes (no MIME body) — major speed win
      const candidates = uids.slice(0, Math.min(uids.length, MAX_LIMIT * 2));
      const windowMessages: FormInboxMessageSummary[] = [];

      for await (const msg of client.fetch(
        candidates,
        { uid: true, flags: true, envelope: true },
        { uid: true },
      )) {
        if (typeof msg.uid !== "number" || !msg.envelope) continue;
        const summary = summaryFromEnvelope(
          msg.uid,
          config.mailbox,
          msg.envelope,
          msg.flags,
          config.user,
        );
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
    } finally {
      lock.release();
    }
  });
}

export async function getFormInboxMessage(id: string): Promise<FormInboxMessage | null> {
  const decoded: DecodedInboxMessageId = decodeInboxMessageId(id);
  if (decoded.provider === "e2e") {
    const { getE2eFormInboxMessage } = await import("./e2e-form-inbox");
    return getE2eFormInboxMessage(id);
  }
  if (decoded.provider === "graph") {
    if (!shouldAttemptGraphMail()) {
      throw new FormInboxError(
        "Dit bericht komt van Microsoft Graph, maar Graph is uitgeschakeld (FORM_INBOX_PROVIDER=imap). Vernieuw de Aanvragen-lijst.",
      );
    }
    return getGraphFormInboxMessage(decoded.graphId, decoded.mailbox);
  }
  const { mailbox, uid } = decoded;

  return withImapClient(async (client, config) => {
    const lock = await client.getMailboxLock(mailbox || config.mailbox);
    try {
      const parts = await fetchMessageTextOnly(client, uid);

      let found = messageFromTextParts(
        uid,
        mailbox || config.mailbox,
        config.user,
        parts.envelope,
        parts.flags,
        parts.text,
        parts.html,
        parts.attachments,
      );

      if (!found) {
        return null;
      }

      if (found.unread) {
        try {
          await client.messageFlagsAdd({ uid }, ["\\Seen"], { uid: true });
          found = { ...found, unread: false };
        } catch {
          // non-fatal
        }
      }

      return found;
    } finally {
      lock.release();
    }
  });
}

/** Load conversation replies (separate call so opening a mail stays fast). */
export async function getFormInboxThread(id: string): Promise<FormInboxThreadItem[]> {
  const decoded: DecodedInboxMessageId = decodeInboxMessageId(id);
  if (decoded.provider === "e2e") {
    const { getE2eFormInboxThread } = await import("./e2e-form-inbox");
    return getE2eFormInboxThread(id);
  }
  if (decoded.provider === "graph") {
    if (!shouldAttemptGraphMail()) {
      throw new FormInboxError(
        "Dit gesprek komt van Microsoft Graph, maar Graph is uitgeschakeld (FORM_INBOX_PROVIDER=imap). Vernieuw de Aanvragen-lijst.",
      );
    }
    return getGraphFormInboxThread(decoded.graphId, decoded.mailbox);
  }
  const { mailbox, uid } = decoded;

  return withImapClient(async (client, config) => {
    const lock = await client.getMailboxLock(mailbox || config.mailbox);
    try {
      let root: FormInboxMessage | null = null;
      let rootParsed: ParsedMail | null = null;

      for await (const msg of client.fetch(
        String(uid),
        { uid: true, flags: true, source: true },
        { uid: true },
      )) {
        if (!msg.source || typeof msg.uid !== "number") continue;
        const parsed = await simpleParser(msg.source);
        root =
          parsedToFormMessage(msg.uid, mailbox || config.mailbox, parsed, msg.flags, config.user) ??
          null;
        rootParsed = parsed;
        if (!root) {
          const kind = classifyFormEmailSubject(parsed.subject);
          if (!kind) return [];
          root = {
            id: encodeInboxMessageId(msg.uid, mailbox || config.mailbox),
            uid: msg.uid,
            kind,
            subject: parsed.subject?.trim() || "(geen onderwerp)",
            from: addressListToText(parsed.from) || "(onbekend)",
            to: addressListToText(parsed.to) || config.user,
            date: (parsed.date ?? new Date()).toISOString(),
            snippet: "",
            unread: false,
            submitterName: resolveSubmitterName(
              parsed.subject?.trim() || "",
              parseFields(parsed),
            ),
            submitterEmail: resolveSubmitterEmail(parsed, config.user),
            requestNumber: extractRequestNumber(parsed.subject || "", bodyPlain(parsed)),
            scopeKey: extractFormScopeKeyFromSubject(parsed.subject),
            scopeLabel:
              parseFields(parsed).find((f) => f.label.toLowerCase() === "scope")?.value?.trim() ||
              null,
            textBody: bodyPlain(parsed),
            htmlSafePreview: "",
            replyToHeader: firstAddress(parsed.replyTo),
            messageId: parsed.messageId ?? null,
            fields: parseFields(parsed),
            attachments: [],
            thread: [],
          };
        }
      }

      if (!root || !rootParsed) return [];

      try {
        return await Promise.race([
          buildThread(client, mailbox || config.mailbox, root, rootParsed, config.user),
          new Promise<FormInboxThreadItem[]>((resolve) => {
            setTimeout(
              () =>
                resolve([
                  toThreadItem(
                    root!.uid,
                    mailbox || config.mailbox,
                    rootParsed!,
                    config.user,
                    root!.submitterEmail,
                  ),
                ]),
              8_000,
            );
          }),
        ]);
      } catch {
        return [
          toThreadItem(
            root.uid,
            mailbox || config.mailbox,
            rootParsed,
            config.user,
            root.submitterEmail,
          ),
        ];
      }
    } finally {
      lock.release();
    }
  });
}

/** Download one attachment by filename (on-demand — keeps detail RPC small). */
export async function getFormInboxAttachment(
  id: string,
  filename: string,
): Promise<FormInboxAttachment | null> {
  const decoded: DecodedInboxMessageId = decodeInboxMessageId(id);
  if (decoded.provider === "e2e") {
    const { getE2eFormInboxAttachment } = await import("./e2e-form-inbox");
    return getE2eFormInboxAttachment(id, filename);
  }
  if (decoded.provider === "graph") {
    if (!shouldAttemptGraphMail()) {
      throw new FormInboxError(
        "Deze bijlage komt van Microsoft Graph, maar Graph is uitgeschakeld (FORM_INBOX_PROVIDER=imap). Vernieuw de Aanvragen-lijst.",
      );
    }
    return getGraphFormInboxAttachment(decoded.graphId, filename, decoded.mailbox);
  }
  const { mailbox, uid } = decoded;
  const wanted = filename.trim().toLowerCase();

  return withImapClient(async (client, config) => {
    const lock = await client.getMailboxLock(mailbox || config.mailbox);
    try {
      let structure: StructureNode | null = null;
      let size = 0;

      for await (const msg of client.fetch(
        String(uid),
        { uid: true, bodyStructure: true, size: true },
        { uid: true },
      )) {
        structure = (msg.bodyStructure as StructureNode | undefined) ?? null;
        size = typeof msg.size === "number" ? msg.size : 0;
      }

      const metas = collectAttachmentMetas(structure);
      const meta =
        metas.find((a) => a.filename.toLowerCase() === wanted) ??
        metas.find((a) => a.filename.toLowerCase().includes(wanted));

      if (meta?.part) {
        try {
          const downloaded = await client.download(String(uid), meta.part, { uid: true });
          const buf = await readDownloadStream(downloaded.content, MAX_ATTACHMENT_BYTES + 1);
          if (buf.length > MAX_ATTACHMENT_BYTES) {
            return {
              filename: meta.filename,
              contentType: meta.contentType,
              size: meta.size || buf.length,
              omitted: true,
              part: meta.part,
            };
          }
          return {
            filename: meta.filename,
            contentType:
              downloaded.meta.contentType || meta.contentType || "application/octet-stream",
            size: buf.length,
            contentBase64: bufferToBase64(buf),
            part: meta.part,
          };
        } catch (error) {
          console.error("[form-inbox] attachment part download failed", {
            part: meta.part,
            error: error instanceof Error ? error.message : "unknown",
          });
        }
      }

      // Fallback: full source only for smaller messages
      if (size > 0 && size <= 2_500_000) {
        for await (const msg of client.fetch(
          String(uid),
          { uid: true, source: true },
          { uid: true },
        )) {
          if (!msg.source) continue;
          const parsed = await simpleParser(msg.source);
          const list = mapAttachments(parsed.attachments, { includeContent: true });
          const hit =
            list.find((a) => a.filename.toLowerCase() === wanted) ??
            list.find((a) => a.filename.toLowerCase().includes(wanted));
          return hit ?? null;
        }
      }

      return meta ? { ...meta, omitted: true } : null;
    } finally {
      lock.release();
    }
  });
}
