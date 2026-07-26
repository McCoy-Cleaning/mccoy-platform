import { uploadedImage, type CmsImage } from "@mccoy/cms-schema";
import {
  CMS_MAX_IMAGE_UPLOAD_BYTES,
  CMS_MAX_SOURCE_IMAGE_BYTES,
  CMS_MAX_STORED_IMAGE_BYTES,
  prepareCmsImageUpload,
  validateImageUploadFile,
  type CmsImageCompressProfile,
  type PrepareCmsImageResult,
} from "./compress-image";

export {
  CMS_MAX_IMAGE_UPLOAD_BYTES,
  CMS_MAX_SOURCE_IMAGE_BYTES,
  CMS_MAX_STORED_IMAGE_BYTES,
  prepareCmsImageUpload,
  validateImageUploadFile,
  type CmsImageCompressProfile,
  type PrepareCmsImageResult,
};

const STORAGE_KEY = "mccoy_cms_uploaded_images_v1";

export type CmsUploadedImageEntry = {
  id: string;
  label: string;
  image: CmsImage;
  createdAt: number;
  tags: string[];
};

function uid(): string {
  return `upload_${Math.random().toString(36).slice(2, 10)}`;
}

export function readUploadedImages(): CmsUploadedImageEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isUploadedEntry);
  } catch {
    return [];
  }
}

function isUploadedEntry(value: unknown): value is CmsUploadedImageEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as CmsUploadedImageEntry;
  return (
    typeof e.id === "string" &&
    typeof e.label === "string" &&
    typeof e.createdAt === "number" &&
    Array.isArray(e.tags) &&
    !!e.image &&
    typeof e.image === "object" &&
    typeof e.image.assetId === "string" &&
    typeof e.image.src === "string" &&
    typeof e.image.alt === "string" &&
    typeof e.image.decorative === "boolean"
  );
}

export function writeUploadedImages(entries: CmsUploadedImageEntry[]): { ok: true } | { ok: false; reason: string } {
  if (typeof window === "undefined") {
    return { ok: false, reason: "Uploads zijn alleen in de browser beschikbaar." };
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: "Kon uploadbibliotheek niet opslaan — mogelijk te groot voor localStorage.",
    };
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Bestand lezen mislukt"));
    reader.readAsDataURL(file);
  });
}

export function addUploadedImage(input: {
  dataUrl: string;
  label: string;
  alt?: string;
  tags?: string[];
}): { ok: true; entry: CmsUploadedImageEntry } | { ok: false; reason: string } {
  const id = uid();
  const image = uploadedImage(input.dataUrl, input.alt ?? input.label, id);
  if (!image) {
    return { ok: false, reason: "Ongeldig afbeeldingsbestand." };
  }
  const entry: CmsUploadedImageEntry = {
    id,
    label: input.label.trim() || "Upload",
    image,
    createdAt: Date.now(),
    tags: input.tags ?? [],
  };
  const next = [entry, ...readUploadedImages()];
  const wrote = writeUploadedImages(next);
  if (!wrote.ok) return wrote;
  return { ok: true, entry };
}

export function removeUploadedImage(id: string): { ok: true } | { ok: false; reason: string } {
  const next = readUploadedImages().filter((e) => e.id !== id);
  return writeUploadedImages(next);
}
