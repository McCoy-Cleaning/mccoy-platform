import { createBrowserSupabaseClient } from "@mccoy/database/client";
import type { FormKind, UploadedFormAttachment } from "@mccoy/domain";

import { prepareWebsiteFormAttachments } from "@/lib/api/forms.functions";

const BUCKET = "website-request-attachments";

export async function uploadWebsiteFormAttachments(options: {
  kind: FormKind;
  pageId: string;
  sourceId: string;
  fields: Record<string, string>;
  files: File[];
  website?: string;
}): Promise<UploadedFormAttachment[]> {
  if (!options.files.length) return [];
  const prepared = await prepareWebsiteFormAttachments({
    data: {
      kind: options.kind,
      pageId: options.pageId,
      sourceId: options.sourceId,
      fields: options.fields,
      files: options.files.map((file) => ({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      })),
      website: options.website ?? "",
    },
  });
  if (!prepared.ok) throw new Error(prepared.error);
  if (prepared.slots.length !== options.files.length) {
    throw new Error("Bestandsupload kon niet worden voorbereid. Probeer het opnieuw.");
  }
  const supabase = createBrowserSupabaseClient({ storageKey: "mccoy-form-upload" });
  if (!supabase) throw new Error("Bestandsuploads zijn tijdelijk niet beschikbaar.");
  const uploaded: UploadedFormAttachment[] = [];
  for (let index = 0; index < prepared.slots.length; index += 1) {
    const slot = prepared.slots[index]!;
    const file = options.files[index]!;
    const { error } = await supabase.storage
      .from(BUCKET)
      .uploadToSignedUrl(slot.storagePath, slot.token, file, {
        cacheControl: "0",
        contentType: slot.contentType,
      });
    if (error) throw new Error(`Upload van “${file.name}” is mislukt. Probeer het opnieuw.`);
    uploaded.push({
      filename: slot.filename,
      contentType: slot.contentType,
      sizeBytes: slot.sizeBytes,
      storagePath: slot.storagePath,
    });
  }
  return uploaded;
}
