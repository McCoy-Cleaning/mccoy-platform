import type { FormInboxAttachment, ParsedFormField } from "@mccoy/email/contracts";

const PREVIEWABLE_IMAGE_TYPES = new Set([
  "image/avif",
  "image/bmp",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const IMAGE_FIELD_KEYS = new Set([
  "photos",
  "photo",
  "images",
  "image",
  "foto",
  "fotos",
  "foto's",
]);

const DATA_URL_IMAGE_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,/i;
const IMAGE_EXTENSION_RE = /\.(avif|bmp|gif|jpe?g|png|webp)$/i;

export const FORM_PHOTOS_FIELD_KEY = "photos";
export const FORM_PHOTOS_FIELD_LABEL = "Foto's";

export function isPreviewableImageAttachment(attachment: FormInboxAttachment): boolean {
  const type = attachment.contentType.trim().toLowerCase();
  if (PREVIEWABLE_IMAGE_TYPES.has(type)) return true;
  if (type.startsWith("image/")) return IMAGE_EXTENSION_RE.test(attachment.filename);
  return IMAGE_EXTENSION_RE.test(attachment.filename);
}

function isDataUrlImageValue(value: string): boolean {
  return DATA_URL_IMAGE_RE.test(value.trim());
}

function isImageFormFieldKey(fieldKey: string): boolean {
  return IMAGE_FIELD_KEYS.has(fieldKey.trim().toLowerCase());
}

function normalizeFormAttachmentFilename(name: string): string {
  return name.trim().toLowerCase().normalize("NFC");
}

function formAttachmentFilenamesMatch(wanted: string, candidate: string): boolean {
  const a = normalizeFormAttachmentFilename(wanted);
  const b = normalizeFormAttachmentFilename(candidate);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const compact = (value: string) => value.replace(/[\s._-]+/g, "");
  return compact(a) === compact(b);
}

function filenameStem(filename: string): string {
  const trimmed = filename.trim();
  const dot = trimmed.lastIndexOf(".");
  return (dot > 0 ? trimmed.slice(0, dot) : trimmed).toLowerCase();
}

function filenamesListedInValue(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("data:")) return [];
  return trimmed
    .split(/[,;\n]+/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part.length > 0 &&
        part.length <= 180 &&
        !part.includes(" ") &&
        IMAGE_EXTENSION_RE.test(part),
    );
}

export function shouldHideAttachmentFieldText(
  value: string,
  mappedImages: FormInboxAttachment[],
): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (isDataUrlImageValue(trimmed)) return true;
  if (mappedImages.length === 0) return false;
  const names = filenamesListedInValue(trimmed);
  if (names.length === 0) return false;
  const looksLikeFilenames = names.every(
    (name) => name.includes(".") && !name.includes(" ") && name.length <= 180,
  );
  if (!looksLikeFilenames) return false;
  return names.every((name) =>
    mappedImages.some((image) => formAttachmentFilenamesMatch(name, image.filename)),
  );
}

function imageMatchesField(field: ParsedFormField, image: FormInboxAttachment): boolean {
  if (filenameStem(image.filename) === field.key.toLowerCase()) return true;
  return filenamesListedInValue(field.value).some((name) =>
    formAttachmentFilenamesMatch(name, image.filename),
  );
}

export function partitionFormAttachments(
  fields: ParsedFormField[],
  attachments: FormInboxAttachment[],
): {
  imagesByFieldKey: Map<string, FormInboxAttachment[]>;
  unmappedImages: FormInboxAttachment[];
  fileAttachments: FormInboxAttachment[];
} {
  const images = attachments.filter(isPreviewableImageAttachment);
  const fileAttachments = attachments.filter((item) => !isPreviewableImageAttachment(item));
  const assigned = images.map(() => false);
  const imagesByFieldKey = new Map<string, FormInboxAttachment[]>();

  const assign = (fieldKey: string, index: number) => {
    if (assigned[index]) return;
    assigned[index] = true;
    const image = images[index];
    if (!image) return;
    const current = imagesByFieldKey.get(fieldKey) ?? [];
    current.push(image);
    imagesByFieldKey.set(fieldKey, current);
  };

  for (const field of fields) {
    images.forEach((image, index) => {
      if (imageMatchesField(field, image)) assign(field.key, index);
    });
  }

  const imageFields = fields.filter((field) => isImageFormFieldKey(field.key));
  if (imageFields.length === 1) {
    const fieldKey = imageFields[0]!.key;
    images.forEach((_, index) => assign(fieldKey, index));
  }

  const unmappedImages = images.filter((_, index) => !assigned[index]);
  return { imagesByFieldKey, unmappedImages, fileAttachments };
}
