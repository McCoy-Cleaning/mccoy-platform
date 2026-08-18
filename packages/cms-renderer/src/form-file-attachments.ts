import {
  MAX_WEBSITE_FORM_ATTACHMENT_COUNT,
  MAX_WEBSITE_FORM_ATTACHMENT_FILE_BYTES,
  MAX_WEBSITE_FORM_ATTACHMENT_TOTAL_BYTES,
} from "@mccoy/domain";

export type PreparedFormFileAttachment = File;

export const MAX_FORM_ATTACHMENT_COUNT = MAX_WEBSITE_FORM_ATTACHMENT_COUNT;
export const MAX_FORM_ATTACHMENT_FILE_BYTES = MAX_WEBSITE_FORM_ATTACHMENT_FILE_BYTES;
export const MAX_FORM_ATTACHMENT_TOTAL_BYTES = MAX_WEBSITE_FORM_ATTACHMENT_TOTAL_BYTES;

function megabytes(bytes: number): number {
  return Math.round(bytes / (1024 * 1024));
}

/**
 * Validate browser files without converting them to Base64. The caller uploads
 * the original bytes directly to private storage, bypassing the host function
 * request limit. Every rejected selection produces a visible error.
 */
export async function prepareFormFileAttachments(files: File[]): Promise<File[]> {
  const nonEmpty = files.filter((file) => file.size > 0);
  if (nonEmpty.length > MAX_FORM_ATTACHMENT_COUNT) {
    throw new Error(`U kunt maximaal ${MAX_FORM_ATTACHMENT_COUNT} bestanden toevoegen.`);
  }

  let totalBytes = 0;
  for (const file of nonEmpty) {
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

  return nonEmpty;
}

export async function collectFormFileAttachments(
  form: HTMLFormElement,
  extraFiles: File[] = [],
): Promise<File[]> {
  const formData = new FormData(form);
  const seen = new Set<string>();
  const files: File[] = [];

  const append = (file: File) => {
    if (file.size <= 0) return;
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
