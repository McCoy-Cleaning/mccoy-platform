/**
 * Shared Aanvragen attachment download helpers (Graph + request-backed).
 * Pure classification / matching — no I/O.
 */

import type { FormInboxAttachment } from "./form-inbox-contracts";

/** Soft cap for on-demand inbox attachment downloads (base64 RPC payload). */
export const MAX_FORM_INBOX_ATTACHMENT_BYTES = 3.5 * 1024 * 1024;

export type FormInboxAttachmentDownloadClass =
  | { status: "ok"; attachment: FormInboxAttachment }
  | { status: "not_found" }
  | { status: "too_large"; attachment: FormInboxAttachment }
  | { status: "unavailable"; attachment: FormInboxAttachment };

/** Sanitize Graph / form filenames the same way list metadata does. */
export function sanitizeAttachmentFilename(name: string): string {
  return decodeAttachmentFilename(name).replace(/[^\w.\- ()[\]]+/g, "_") || "bijlage";
}

/** Strip wrapping quotes / RFC 2231 `UTF-8''` prefixes Graph sometimes returns. */
export function decodeAttachmentFilename(name: string): string {
  let value = (name || "").trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  const rfc2231 = value.match(/^(?:filename\*)?utf-8''(.+)$/i);
  if (rfc2231?.[1]) {
    try {
      value = decodeURIComponent(rfc2231[1]);
    } catch {
      value = rfc2231[1];
    }
  }
  return value.trim() || "bijlage";
}

export function normalizeAttachmentFilename(name: string): string {
  return sanitizeAttachmentFilename(name).trim().toLowerCase();
}

export function isImageContentType(contentType: string | null | undefined): boolean {
  return (contentType || "").trim().toLowerCase().startsWith("image/");
}

/** Graph reported size can include MIME overhead — allow a small delta. */
export function attachmentSizesMatch(left: number, right: number): boolean {
  if (left <= 0 || right <= 0) return false;
  const delta = Math.abs(left - right);
  return delta <= Math.max(512, Math.min(left, right) * 0.08);
}

/** Match requested download name against Graph/IMAP metadata (sanitized + includes). */
export function attachmentFilenamesMatch(wanted: string, candidate: string): boolean {
  const a = normalizeAttachmentFilename(wanted).normalize("NFC");
  const b = normalizeAttachmentFilename(candidate).normalize("NFC");
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const compact = (value: string) => value.replace(/[\s._-]+/g, "");
  return compact(a) === compact(b);
}

/**
 * Choose which listed attachment to download. Graph sometimes renames the file;
 * a single non-inline part on the form notification is still that CV/PDF/photo.
 */
export function pickFormInboxAttachmentForDownload(
  attachments: FormInboxAttachment[],
  wantedFilename: string,
  wantedSize?: number,
): FormInboxAttachment | null {
  if (!attachments.length) return null;
  const wanted = wantedFilename.trim();
  if (!wanted) return null;
  const named = attachments.find((item) => attachmentFilenamesMatch(wanted, item.filename));
  if (named) return named;
  if (wantedSize && wantedSize > 0) {
    const sized = attachments.find((item) => attachmentSizesMatch(item.size, wantedSize));
    if (sized) return sized;
  }
  const downloadable = attachments.filter(
    (item) => !item.omitted || Boolean(item.contentBase64) || Boolean(item.part),
  );
  if (downloadable.length === 1) return downloadable[0] ?? null;
  if (attachments.length === 1) return attachments[0] ?? null;
  return null;
}

export function mergeFormInboxAttachmentLists(
  primary: FormInboxAttachment[],
  extra: FormInboxAttachment[],
): FormInboxAttachment[] {
  // Preserve every request-backed attachment. Equal-size photos are common and
  // must not collapse into one row merely because their byte counts match.
  const out: FormInboxAttachment[] = primary.slice(0, 8).map((item) => ({
    filename: item.filename,
    contentType: item.contentType,
    size: item.size,
    omitted: true,
    part: item.part,
  }));

  for (const item of extra) {
    const duplicate = out.some(
      (existing) =>
        attachmentFilenamesMatch(existing.filename, item.filename) &&
        (existing.size <= 0 || item.size <= 0 || attachmentSizesMatch(existing.size, item.size)),
    );
    if (duplicate) continue;
    out.push({
      filename: item.filename,
      contentType: item.contentType,
      size: item.size,
      omitted: true,
      part: item.part,
    });
    if (out.length >= 8) break;
  }
  return out;
}

export function approxBytesFromBase64(contentBase64: string): number {
  if (!contentBase64) return 0;
  const padding = contentBase64.endsWith("==") ? 2 : contentBase64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((contentBase64.length * 3) / 4) - padding);
}

/**
 * Decide whether an attachment payload is downloadable, missing, or over the size cap.
 * Used by Admin download RPC and unit tests.
 */
export function classifyFormInboxAttachmentDownload(
  attachment: FormInboxAttachment | null | undefined,
): FormInboxAttachmentDownloadClass {
  if (!attachment) return { status: "not_found" };

  if (attachment.downloadUrl || attachment.contentUrl) {
    return { status: "ok", attachment: { ...attachment, omitted: false } };
  }

  const content = attachment.contentBase64?.trim() ?? "";
  if (content) {
    const size = attachment.size > 0 ? attachment.size : approxBytesFromBase64(content);
    if (size > MAX_FORM_INBOX_ATTACHMENT_BYTES) {
      return {
        status: "too_large",
        attachment: { ...attachment, size, omitted: true, contentBase64: undefined },
      };
    }
    return {
      status: "ok",
      attachment: { ...attachment, size, contentBase64: content, omitted: false },
    };
  }

  const size = attachment.size > 0 ? attachment.size : 0;
  if (size > MAX_FORM_INBOX_ATTACHMENT_BYTES) {
    return { status: "too_large", attachment };
  }

  return { status: "unavailable", attachment };
}

export function formInboxAttachmentDownloadErrorMessage(
  classification: FormInboxAttachmentDownloadClass,
): string {
  switch (classification.status) {
    case "too_large": {
      const kb = Math.max(
        1,
        Math.round((classification.attachment.size || MAX_FORM_INBOX_ATTACHMENT_BYTES) / 1024),
      );
      return `Bijlage is te groot om te downloaden (${kb} KB; maximum 3,5 MB).`;
    }
    case "not_found":
      return "Bijlage niet gevonden in de mailbox. De aanvraag bevat alleen de bestandsnaam.";
    case "unavailable":
      return "Bijlage gevonden maar de inhoud kon niet worden gedownload. Probeer het opnieuw.";
    case "ok":
      return "";
  }
}
