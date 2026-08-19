import {
  MAX_WEBSITE_FORM_ATTACHMENT_COUNT,
  MAX_WEBSITE_FORM_ATTACHMENT_FILE_BYTES,
  MAX_WEBSITE_FORM_ATTACHMENT_TOTAL_BYTES,
} from "@mccoy/domain";

export type PreparedFormFileAttachment = File;

export const MAX_FORM_ATTACHMENT_COUNT = MAX_WEBSITE_FORM_ATTACHMENT_COUNT;
export const MAX_FORM_ATTACHMENT_FILE_BYTES = MAX_WEBSITE_FORM_ATTACHMENT_FILE_BYTES;
export const MAX_FORM_ATTACHMENT_TOTAL_BYTES = MAX_WEBSITE_FORM_ATTACHMENT_TOTAL_BYTES;

/** Offerte / inquiry photos + plattegrond. No SVG wildcard. */
export const WEBSITE_FORM_MEDIA_FILE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,application/pdf,.pdf";

export const WEBSITE_FORM_CV_FILE_ACCEPT = ".pdf,.doc,.docx";

function megabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

/** Named File entries count as real upload selections for limit checks. */
function isNamedUploadCandidate(file: File): boolean {
  return Boolean(file.name?.trim());
}

/**
 * Validate browser files without converting them to Base64. The caller uploads
 * the original bytes directly to private storage, bypassing the host function
 * request limit. Every rejected selection produces a visible error.
 *
 * Count and size limits are enforced on named files before empty/zero-size
 * junk is filtered out.
 */
export async function prepareFormFileAttachments(files: File[]): Promise<File[]> {
  const candidates = files.filter(isNamedUploadCandidate);

  if (candidates.length > MAX_FORM_ATTACHMENT_COUNT) {
    throw new Error(`U kunt maximaal ${MAX_FORM_ATTACHMENT_COUNT} bestanden toevoegen.`);
  }

  let totalBytes = 0;
  for (const file of candidates) {
    if (file.size > MAX_FORM_ATTACHMENT_FILE_BYTES) {
      throw new Error(
        `Bestand “${file.name}” is te groot. Het maximum is ${megabytes(MAX_FORM_ATTACHMENT_FILE_BYTES)} MB per bestand.`,
      );
    }
    totalBytes += file.size;
  }

  if (totalBytes > MAX_FORM_ATTACHMENT_TOTAL_BYTES) {
    throw new Error(
      `De geselecteerde bestanden zijn samen te groot. Het maximum is ${megabytes(MAX_FORM_ATTACHMENT_TOTAL_BYTES)} MB.`,
    );
  }

  return candidates.filter((file) => file.size > 0);
}

export async function collectFormFileAttachments(
  form: HTMLFormElement,
  extraFiles: File[] = [],
): Promise<File[]> {
  const formData = new FormData(form);
  const seen = new Set<string>();
  const files: File[] = [];

  const append = (file: File) => {
    if (!isNamedUploadCandidate(file)) return;
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) return;
    seen.add(key);
    files.push(file);
  };

  for (const value of formData.values()) {
    if (value instanceof File) append(value);
  }
  for (const file of extraFiles) append(file);

  return prepareFormFileAttachments(files);
}
