import type { FormAttachment, FormKind, WebsiteFormPayload } from "./types";
import { submitWebsiteForm } from "@/lib/api/forms.functions";

const MAX_FILE_BYTES = 4 * 1024 * 1024;

async function fileToAttachment(file: File): Promise<FormAttachment | null> {
  if (file.size <= 0 || file.size > MAX_FILE_BYTES) return null;
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return {
    filename: file.name,
    contentBase64: btoa(binary),
    contentType: file.type || "application/octet-stream",
  };
}

export async function collectFormFiles(
  form: HTMLFormElement,
  extraFiles: File[] = [],
): Promise<FormAttachment[]> {
  const fd = new FormData(form);
  const seen = new Set<string>();
  const files: File[] = [];

  for (const value of fd.values()) {
    if (value instanceof File && value.size > 0) {
      const key = `${value.name}:${value.size}:${value.lastModified}`;
      if (seen.has(key)) continue;
      seen.add(key);
      files.push(value);
    }
  }

  for (const file of extraFiles) {
    const key = `${file.name}:${file.size}:${file.lastModified}`;
    if (seen.has(key)) continue;
    seen.add(key);
    files.push(file);
  }

  const attachments: FormAttachment[] = [];
  for (const file of files.slice(0, 8)) {
    const attachment = await fileToAttachment(file);
    if (attachment) attachments.push(attachment);
  }
  return attachments;
}

export function fieldsFromForm(form: HTMLFormElement, extras: Record<string, string> = {}) {
  const fd = new FormData(form);
  const fields: Record<string, string> = { ...extras };
  for (const [key, value] of fd.entries()) {
    if (typeof value === "string") {
      fields[key] = value;
    }
  }
  return fields;
}

export async function submitSiteForm(options: {
  kind: FormKind;
  pageId: string;
  sourceId: string;
  form: HTMLFormElement;
  extras?: Record<string, string>;
  extraFiles?: File[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const fields = fieldsFromForm(options.form, options.extras);
  const attachments = await collectFormFiles(options.form, options.extraFiles ?? []);

  const payload: WebsiteFormPayload = {
    kind: options.kind,
    pageId: options.pageId,
    sourceId: options.sourceId,
    fields,
    attachments,
    website: fields.website ?? "",
  };

  delete payload.fields.website;

  const result = await submitWebsiteForm({ data: payload });
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  return { ok: true };
}
