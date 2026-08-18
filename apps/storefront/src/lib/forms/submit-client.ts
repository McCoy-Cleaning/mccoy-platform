import { collectFormFileAttachments } from "@mccoy/cms-renderer";
import type { FormKind, WebsiteFormPayload } from "./types";
import { submitWebsiteForm } from "@/lib/api/forms.functions";
import { uploadWebsiteFormAttachments } from "@/lib/forms/upload-client";

/**
 * Collect string fields plus filename lists for named file inputs so Admin can
 * map CV / photo labels without reading Graph mail.
 */
export function fieldsFromForm(form: HTMLFormElement, extras: Record<string, string> = {}) {
  const fd = new FormData(form);
  const fields: Record<string, string> = { ...extras };
  const fileNamesByKey = new Map<string, string[]>();

  for (const [key, value] of fd.entries()) {
    if (typeof value === "string") {
      fields[key] = value;
      continue;
    }
    if (value instanceof File && value.size > 0 && value.name.trim()) {
      const list = fileNamesByKey.get(key) ?? [];
      list.push(value.name);
      fileNamesByKey.set(key, list);
    }
  }

  for (const [key, names] of fileNamesByKey) {
    if (!fields[key]?.trim()) {
      fields[key] = names.join(", ");
    }
  }

  return fields;
}

/** Filename lists for React-managed files that never appear as named form inputs. */
export function attachExtraFileFieldNames(
  fields: Record<string, string>,
  extraFiles: File[],
  fieldKey = "photos",
): Record<string, string> {
  if (!extraFiles.length || fields[fieldKey]?.trim()) return fields;
  const names = extraFiles
    .filter((file) => file.size > 0 && file.name.trim())
    .map((file) => file.name.trim());
  if (!names.length) return fields;
  return { ...fields, [fieldKey]: names.join(", ") };
}

export async function submitSiteForm(options: {
  kind: FormKind;
  pageId: string;
  sourceId: string;
  form: HTMLFormElement;
  extras?: Record<string, string>;
  extraFiles?: File[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    let fields = fieldsFromForm(options.form, options.extras);
    const website = fields.website ?? "";
    delete fields.website;

    const extraFiles = options.extraFiles ?? [];
    fields = attachExtraFileFieldNames(fields, extraFiles);

    const files = await collectFormFileAttachments(options.form, extraFiles);
    const uploadedAttachments =
      files.length > 0
        ? await uploadWebsiteFormAttachments({
            kind: options.kind,
            pageId: options.pageId,
            sourceId: options.sourceId,
            fields,
            files,
            website,
          })
        : [];

    const payload: WebsiteFormPayload = {
      kind: options.kind,
      pageId: options.pageId,
      sourceId: options.sourceId,
      fields,
      uploadedAttachments,
      website,
    };

    const result = await submitWebsiteForm({ data: payload });
    if (!result.ok) {
      return { ok: false, error: result.error };
    }
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.message
          ? error.message
          : "Bestanden konden niet worden geüpload.",
    };
  }
}
