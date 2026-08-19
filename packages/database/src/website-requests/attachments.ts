import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import {
  MAX_WEBSITE_FORM_ATTACHMENT_COUNT,
  MAX_WEBSITE_FORM_ATTACHMENT_FILE_BYTES,
  MAX_WEBSITE_FORM_ATTACHMENT_TOTAL_BYTES,
  type AttachmentMeta,
  type FormKind,
  type FormUploadFileIntent,
  type UploadedFormAttachment,
} from "@mccoy/domain";
import { assertSafeWebsiteFormUpload, canonicalWebsiteFormContentType } from "@mccoy/security";

import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "../supabase";

export const WEBSITE_REQUEST_ATTACHMENTS_BUCKET = "website-request-attachments";
export const WEBSITE_REQUEST_ATTACHMENT_MAX_BYTES = MAX_WEBSITE_FORM_ATTACHMENT_FILE_BYTES;
export const WEBSITE_REQUEST_ATTACHMENT_URL_TTL_SECONDS = 5 * 60;

export type WebsiteRequestAttachmentContent = {
  filename: string;
  contentType: string;
  contentBase64: string;
};

export type WebsiteRequestAttachmentUploadSlot = UploadedFormAttachment & {
  token: string;
};

export type StoreWebsiteRequestAttachmentsResult =
  | { status: "stored"; count: number }
  | { status: "not_configured"; count: 0 }
  | { status: "failed"; count: number; error: string };

export type WebsiteRequestAttachmentAccess = {
  contentUrl: string;
  downloadUrl: string;
  expiresAt: string;
  sizeBytes: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STAGED_PATH_RE = /^uploads\/[0-9a-f-]{36}\/\d{2}-[^/]+$/i;

/**
 * Storage object names must never contain URL-encoding (`%20`) or other
 * characters Supabase rejects with "Invalid key". Display names stay separate.
 */
export function sanitizeStorageObjectName(filename: string): string {
  const trimmed = filename.trim() || "bijlage";
  const lastDot = trimmed.lastIndexOf(".");
  const ext = lastDot > 0 ? trimmed.slice(lastDot + 1) : "";
  const stem = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
  const safeStem =
    stem
      .replace(/%[0-9A-Fa-f]{2}/g, "_")
      .replace(/%/g, "")
      .replace(/[^\w.\-]+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 160) || "bijlage";
  const safeExt = ext.replace(/[^A-Za-z0-9]+/g, "").slice(0, 16);
  const name = safeExt ? `${safeStem}.${safeExt}` : safeStem;
  if (!name || name.includes("%") || /[\\/]/.test(name)) {
    throw new Error("Invalid website request attachment filename.");
  }
  return name.slice(0, 180);
}

export function uniqueStorageObjectName(filename: string, used: Set<string>): string {
  const base = sanitizeStorageObjectName(filename);
  if (!used.has(base.toLowerCase())) {
    used.add(base.toLowerCase());
    return base;
  }
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  let n = 2;
  let candidate = `${stem}-${n}${ext}`;
  while (used.has(candidate.toLowerCase())) {
    n += 1;
    candidate = `${stem}-${n}${ext}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

/** Human-readable download name. Spaces are allowed; `%` and path chars are not. */
export function sanitizeAttachmentFilename(name: string): string {
  return (
    name
      .replace(/%[0-9A-Fa-f]{2}/g, " ")
      .replace(/%/g, "")
      .replace(/[^\w.\- ()[\]]+/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180) || "bijlage"
  );
}

export function websiteRequestAttachmentStoragePath(requestId: string, filename: string): string {
  const id = requestId.trim();
  if (!UUID_RE.test(id)) throw new Error("Invalid website request id.");
  const name = filename.trim();
  if (!name || name.length > 180 || /[\\/]/.test(name)) {
    throw new Error("Invalid website request attachment filename.");
  }
  const objectName = sanitizeStorageObjectName(name);
  return `${id}/${objectName}`;
}

export function isWebsiteRequestUploadStoragePath(path: string): boolean {
  const trimmed = path.trim();
  if (!STAGED_PATH_RE.test(trimmed) || trimmed.length > 500) return false;
  const batchId = trimmed.split("/")[1] ?? "";
  return UUID_RE.test(batchId);
}

export function websiteRequestUploadStorageFilename(path: string): string | null {
  if (!isWebsiteRequestUploadStoragePath(path)) return null;
  const objectName = path.trim().split("/")[2] ?? "";
  const raw = objectName.slice(3);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function assertReadableStoragePath(path: string): string {
  const trimmed = path.trim();
  if (isWebsiteRequestUploadStoragePath(trimmed)) return trimmed;
  const [requestId, objectName, extra] = trimmed.split("/");
  if (!extra && requestId && objectName && UUID_RE.test(requestId)) return trimmed;
  throw new Error("Invalid website request attachment storage path.");
}

function safeStorageError(message: string): string {
  return message.replace(/[\r\n]+/g, " ").slice(0, 180);
}

/** Create one-use, path-scoped upload tokens. File bytes never pass through Vercel. */
export async function createWebsiteRequestAttachmentUploadSlots(
  files: FormUploadFileIntent[],
): Promise<WebsiteRequestAttachmentUploadSlot[]> {
  if (!hasSupabaseServiceConfig()) {
    throw new Error("Private attachment storage is not configured.");
  }
  const supabase = createSupabaseServiceClient();
  const batchId = randomUUID();
  const slots: WebsiteRequestAttachmentUploadSlot[] = [];
  const usedObjectNames = new Set<string>();

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]!;
    const prefix = String(index + 1).padStart(2, "0");
    const objectName = uniqueStorageObjectName(file.filename, usedObjectNames);
    const storagePath = `uploads/${batchId}/${prefix}-${objectName}`;
    const { data, error } = await supabase.storage
      .from(WEBSITE_REQUEST_ATTACHMENTS_BUCKET)
      .createSignedUploadUrl(storagePath, { upsert: false });
    if (error || !data?.token) {
      throw new Error(
        `Private attachment upload could not be prepared: ${safeStorageError(error?.message ?? "missing token")}`,
      );
    }
    slots.push({
      filename: file.filename,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      storagePath,
      token: data.token,
    });
  }

  return slots;
}

/** Store legacy/mail-recovered bytes in the private bucket. */
export async function storeWebsiteRequestAttachments(
  requestId: string,
  attachments: WebsiteRequestAttachmentContent[],
): Promise<StoreWebsiteRequestAttachmentsResult> {
  if (!attachments.length) return { status: "stored", count: 0 };
  if (!hasSupabaseServiceConfig()) return { status: "not_configured", count: 0 };

  const supabase = createSupabaseServiceClient();
  const uploadedPaths: string[] = [];
  const usedObjectNames = new Set<string>();
  for (const attachment of attachments) {
    const objectName = uniqueStorageObjectName(attachment.filename, usedObjectNames);
    const path = websiteRequestAttachmentStoragePath(requestId, objectName);
    const bytes = Buffer.from(attachment.contentBase64, "base64");
    if (bytes.length <= 0 || bytes.length > WEBSITE_REQUEST_ATTACHMENT_MAX_BYTES) {
      if (uploadedPaths.length > 0) {
        await supabase.storage
          .from(WEBSITE_REQUEST_ATTACHMENTS_BUCKET)
          .remove(uploadedPaths)
          .catch(() => undefined);
      }
      return {
        status: "failed",
        count: uploadedPaths.length,
        error: "Attachment byte size is outside the private-storage limit.",
      };
    }

    const { error } = await supabase.storage
      .from(WEBSITE_REQUEST_ATTACHMENTS_BUCKET)
      .upload(path, bytes, {
        contentType: attachment.contentType,
        cacheControl: "0",
        upsert: false,
      });
    if (error && !/already exists|duplicate/i.test(error.message)) {
      if (uploadedPaths.length > 0) {
        await supabase.storage
          .from(WEBSITE_REQUEST_ATTACHMENTS_BUCKET)
          .remove(uploadedPaths)
          .catch(() => undefined);
      }
      return {
        status: "failed",
        count: uploadedPaths.length,
        error: safeStorageError(error.message),
      };
    }
    if (!error) uploadedPaths.push(path);
  }

  return { status: "stored", count: attachments.length };
}

/**
 * Move browser-staged uploads (`uploads/{batch}/…`) into the durable
 * `{requestId}/{filename}` prefix used by Admin Aanvragen downloads.
 */
export async function finalizeWebsiteRequestUploadedAttachments(
  requestId: string,
  uploaded: UploadedFormAttachment[],
  kind: FormKind,
): Promise<
  | { ok: true; attachments: AttachmentMeta[] }
  | { ok: false; error: string }
> {
  if (!uploaded.length) return { ok: true, attachments: [] };
  if (!hasSupabaseServiceConfig()) {
    return { ok: false, error: "Private attachment storage is not configured." };
  }
  if (uploaded.length > MAX_WEBSITE_FORM_ATTACHMENT_COUNT) {
    return { ok: false, error: `U kunt maximaal ${MAX_WEBSITE_FORM_ATTACHMENT_COUNT} bestanden toevoegen.` };
  }

  let totalBytes = 0;
  const prepared: Array<UploadedFormAttachment & { destPath: string }> = [];
  const usedNames = new Set<string>();
  const usedObjectNames = new Set<string>();

  for (const file of uploaded) {
    if (!isWebsiteRequestUploadStoragePath(file.storagePath)) {
      return { ok: false, error: "Ongeldig uploadpad voor bijlage." };
    }
    if (file.sizeBytes <= 0 || file.sizeBytes > MAX_WEBSITE_FORM_ATTACHMENT_FILE_BYTES) {
      return { ok: false, error: `Bestand “${file.filename}” heeft een ongeldige grootte.` };
    }
    const metaGate = assertSafeWebsiteFormUpload({
      kind,
      filename: file.filename,
      contentType: file.contentType,
    });
    if (!metaGate.ok) return { ok: false, error: metaGate.error };
    totalBytes += file.sizeBytes;
    if (totalBytes > MAX_WEBSITE_FORM_ATTACHMENT_TOTAL_BYTES) {
      return { ok: false, error: "De geselecteerde bestanden zijn samen te groot." };
    }

    let filename = sanitizeAttachmentFilename(file.filename);
    if (usedNames.has(filename.toLowerCase())) {
      const dot = filename.lastIndexOf(".");
      const stem = dot > 0 ? filename.slice(0, dot) : filename;
      const ext = dot > 0 ? filename.slice(dot) : "";
      let n = 2;
      while (usedNames.has(`${stem}-${n}${ext}`.toLowerCase())) n += 1;
      filename = `${stem}-${n}${ext}`;
    }
    usedNames.add(filename.toLowerCase());
    const objectName = uniqueStorageObjectName(filename, usedObjectNames);
    prepared.push({
      ...file,
      filename,
      destPath: websiteRequestAttachmentStoragePath(requestId, objectName),
    });
  }

  const supabase = createSupabaseServiceClient();
  const bucket = supabase.storage.from(WEBSITE_REQUEST_ATTACHMENTS_BUCKET);
  const moved: string[] = [];
  const stagedToRemove: string[] = [];
  const finalized: AttachmentMeta[] = [];

  const cleanupRejected = async (extra: string[]) => {
    const paths = [...new Set([...moved, ...stagedToRemove, ...extra])];
    if (paths.length > 0) {
      await bucket.remove(paths).catch(() => undefined);
    }
  };

  for (const file of prepared) {
    stagedToRemove.push(file.storagePath);
    const stored = await getStoredWebsiteRequestAttachmentByPath(file.storagePath);
    if (!stored) {
      await cleanupRejected([]);
      return {
        ok: false,
        error: `Bestand “${file.filename}” kon niet worden gecontroleerd.`,
      };
    }
    const gate = assertSafeWebsiteFormUpload({
      kind,
      filename: file.filename,
      contentType: file.contentType,
      bytes: stored.bytes,
    });
    if (!gate.ok) {
      await cleanupRejected([]);
      return { ok: false, error: gate.error };
    }

    const { error } = await bucket.move(file.storagePath, file.destPath);
    if (error) {
      await cleanupRejected([]);
      return {
        ok: false,
        error: `Bijlage “${file.filename}” kon niet worden opgeslagen: ${safeStorageError(error.message)}`,
      };
    }
    moved.push(file.destPath);
    const stagedIdx = stagedToRemove.indexOf(file.storagePath);
    if (stagedIdx >= 0) stagedToRemove.splice(stagedIdx, 1);
    const contentType = gate.detectedType
      ? canonicalWebsiteFormContentType(gate.detectedType)
      : file.contentType || "application/octet-stream";
    finalized.push({
      filename: file.filename,
      contentType,
      sizeBytes: stored.sizeBytes,
      storagePath: file.destPath,
    });
  }

  return { ok: true, attachments: finalized };
}

export async function getStoredWebsiteRequestAttachmentByPath(
  storagePath: string,
): Promise<{ bytes: Uint8Array; contentBase64: string; sizeBytes: number } | null> {
  if (!hasSupabaseServiceConfig()) return null;
  const path = assertReadableStoragePath(storagePath);
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase.storage
    .from(WEBSITE_REQUEST_ATTACHMENTS_BUCKET)
    .download(path);
  if (error || !data) return null;
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (bytes.length <= 0 || bytes.length > WEBSITE_REQUEST_ATTACHMENT_MAX_BYTES) return null;
  return {
    bytes,
    contentBase64: Buffer.from(bytes).toString("base64"),
    sizeBytes: bytes.length,
  };
}

function candidateStoragePaths(requestId: string, filename: string, storagePath?: string): string[] {
  const paths: string[] = [];
  if (storagePath?.trim()) {
    try {
      paths.push(assertReadableStoragePath(storagePath));
    } catch {
      /* ignore invalid stored path and fall back */
    }
  }
  const sanitized = websiteRequestAttachmentStoragePath(requestId, filename);
  if (!paths.includes(sanitized)) paths.push(sanitized);
  const legacyEncoded = `${requestId.trim()}/${encodeURIComponent(filename.trim())}`;
  if (legacyEncoded !== sanitized && !paths.includes(legacyEncoded)) {
    paths.push(legacyEncoded);
  }
  return paths;
}

/** Read one attachment server-side for validation or historical recovery. */
export async function getStoredWebsiteRequestAttachment(
  requestId: string,
  filename: string,
  storagePath?: string,
): Promise<{ contentBase64: string; sizeBytes: number } | null> {
  for (const path of candidateStoragePaths(requestId, filename, storagePath)) {
    try {
      const stored = await getStoredWebsiteRequestAttachmentByPath(path);
      if (stored) return { contentBase64: stored.contentBase64, sizeBytes: stored.sizeBytes };
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

/** Short-lived URLs are returned only after the Admin server has authorized the caller. */
export async function createStoredWebsiteRequestAttachmentAccess(input: {
  requestId: string;
  filename: string;
  storagePath?: string;
}): Promise<WebsiteRequestAttachmentAccess | null> {
  if (!hasSupabaseServiceConfig()) return null;
  const supabase = createSupabaseServiceClient();
  const bucket = supabase.storage.from(WEBSITE_REQUEST_ATTACHMENTS_BUCKET);

  for (const path of candidateStoragePaths(input.requestId, input.filename, input.storagePath)) {
    try {
      assertReadableStoragePath(path);
    } catch {
      continue;
    }
    const { data: info, error: infoError } = await bucket.info(path);
    const sizeBytes = Number(info?.size ?? 0);
    if (infoError || !info || sizeBytes <= 0 || sizeBytes > WEBSITE_REQUEST_ATTACHMENT_MAX_BYTES) {
      continue;
    }
    const [content, download] = await Promise.all([
      bucket.createSignedUrl(path, WEBSITE_REQUEST_ATTACHMENT_URL_TTL_SECONDS),
      bucket.createSignedUrl(path, WEBSITE_REQUEST_ATTACHMENT_URL_TTL_SECONDS, {
        download: input.filename,
      }),
    ]);
    if (content.error || download.error || !content.data || !download.data) continue;
    return {
      contentUrl: content.data.signedUrl,
      downloadUrl: download.data.signedUrl,
      expiresAt: new Date(Date.now() + WEBSITE_REQUEST_ATTACHMENT_URL_TTL_SECONDS * 1000).toISOString(),
      sizeBytes,
    };
  }
  return null;
}
