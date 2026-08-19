/**
 * Stored Graph attachment metadata on website_request_mail_messages.attachments.
 * Pure mapping — no I/O. Bytes stay in the mailbox.
 */
import type { FormInboxAttachment } from "./form-inbox-contracts";
import { isRejectedReplyAttachment } from "./form-inbox-attachment";

export type StoredMailAttachment = {
  filename: string;
  contentType: string;
  size: number;
  graphAttachmentId?: string | null;
};

const MAX_STORED_ATTACHMENTS = 40;
const MAX_FILENAME_CHARS = 240;
const MAX_CONTENT_TYPE_CHARS = 200;
const MAX_GRAPH_ATTACHMENT_ID_CHARS = 512;

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function readSize(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

export function storedMailAttachmentsToInbox(stored: unknown): FormInboxAttachment[] {
  if (!Array.isArray(stored) || stored.length === 0) return [];
  const out: FormInboxAttachment[] = [];
  for (const item of stored.slice(0, MAX_STORED_ATTACHMENTS)) {
    const rec = asRecord(item);
    if (!rec) continue;
    const filename = readString(rec.filename, MAX_FILENAME_CHARS);
    if (!filename) continue;
    const contentType =
      readString(rec.contentType, MAX_CONTENT_TYPE_CHARS) || "application/octet-stream";
    if (isRejectedReplyAttachment({ filename, contentType })) continue;
    const graphAttachmentId =
      readString(rec.graphAttachmentId, MAX_GRAPH_ATTACHMENT_ID_CHARS) ||
      readString(rec.part, MAX_GRAPH_ATTACHMENT_ID_CHARS);
    out.push({
      filename,
      contentType,
      size: readSize(rec.size),
      omitted: false,
      ...(graphAttachmentId ? { part: graphAttachmentId } : {}),
    });
  }
  return out;
}

export function inboxAttachmentsToStored(
  attachments: FormInboxAttachment[],
): StoredMailAttachment[] {
  const out: StoredMailAttachment[] = [];
  for (const item of attachments.slice(0, MAX_STORED_ATTACHMENTS)) {
    const filename = readString(item.filename, MAX_FILENAME_CHARS);
    if (!filename) continue;
    const contentType =
      readString(item.contentType, MAX_CONTENT_TYPE_CHARS) || "application/octet-stream";
    if (isRejectedReplyAttachment({ filename, contentType })) continue;
    const graphAttachmentId = readString(item.part, MAX_GRAPH_ATTACHMENT_ID_CHARS);
    out.push({
      filename,
      contentType,
      size: readSize(item.size),
      graphAttachmentId: graphAttachmentId || null,
    });
  }
  return out;
}

export function mailRowHasStoredAttachments(row: { attachments?: unknown }): boolean {
  return storedMailAttachmentsToInbox(row.attachments).length > 0;
}
