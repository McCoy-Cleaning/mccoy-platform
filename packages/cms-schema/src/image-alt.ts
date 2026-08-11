import type { CmsImage } from "./cms-image";
import { replaceCmsImagesInTree } from "./content";

/**
 * Generic / placeholder alts that must not ship on content-bearing public images.
 * Intentionally short and language-agnostic — not geo-keyword stuffing.
 */
const GENERIC_IMAGE_ALTS = new Set([
  "image",
  "img",
  "photo",
  "picture",
  "afbeelding",
  "foto",
  "plaatje",
  "hero",
  "placeholder",
  "logo",
]);

/** True when alt is empty or a known generic placeholder label. */
export function isGenericImageAlt(alt: string | null | undefined): boolean {
  const trimmed = (alt ?? "").trim().toLowerCase();
  if (!trimmed) return true;
  return GENERIC_IMAGE_ALTS.has(trimmed);
}

/**
 * Public-facing alt for a CMS image.
 * Decorative → `""`. Meaningful CMS alt when present; otherwise `fallback`.
 */
export function resolvePublicImageAlt(
  image: Pick<CmsImage, "alt" | "decorative"> | null | undefined,
  fallback: string,
): string {
  if (!image || image.decorative) return "";
  const alt = image.alt?.trim() ?? "";
  if (!alt || isGenericImageAlt(alt)) {
    return fallback.trim();
  }
  return alt;
}

/** Returns a shallow copy with alt resolved for public render (CmsImageView-safe). */
export function withResolvedPublicImageAlt<T extends CmsImage>(image: T, fallback: string): T {
  if (image.decorative) {
    return { ...image, alt: "" };
  }
  return { ...image, alt: resolvePublicImageAlt(image, fallback) };
}

/**
 * Derive a concise descriptive alt from a media path when CMS only stored a
 * generic label. Returns "" for UUID-like / empty basenames.
 */
export function descriptiveAltFromSrc(src: string | null | undefined): string {
  if (!src?.trim()) return "";
  try {
    const path = /^https?:\/\//i.test(src) ? new URL(src).pathname : src;
    const base = decodeURIComponent(path.split("/").pop() || "");
    const stem = base.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    if (!stem || stem.length < 3) return "";
    // UUID / hash object keys are not descriptive.
    if (/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(stem)) return "";
    if (/^[0-9a-f]{16,}$/i.test(stem.replace(/\s/g, ""))) return "";
    if (/^(media|image|img|photo|file|upload)(\s+\d+)?$/i.test(stem)) return "";
    return stem.replace(/\b\w/g, (ch) => ch.toUpperCase());
  } catch {
    return "";
  }
}

/**
 * Walk a CMS value tree and replace generic/empty non-decorative alts for public delivery.
 * Does not invent geo keywords; falls back to filename stem or a short brand phrase.
 */
export function sanitizePublicCmsImageTree<T>(value: T, brandFallback = "McCoy Cleaning"): T {
  return replaceCmsImagesInTree(value, (image) => {
    if (image.decorative) {
      return { ...image, alt: "" };
    }
    if (!isGenericImageAlt(image.alt)) return image;
    const fromSrc = descriptiveAltFromSrc(image.src);
    const nextAlt = fromSrc && !isGenericImageAlt(fromSrc) ? fromSrc : brandFallback;
    return { ...image, alt: nextAlt };
  }) as T;
}
