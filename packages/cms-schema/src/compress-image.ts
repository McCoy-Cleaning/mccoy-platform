/**
 * Browser-side CMS image preparation: validate, optionally raster-compress, emit a data URL
 * suitable for localStorage + cms-sync (no new dependencies — Canvas API only).
 */

import { cropAndNormalizeLogoMark, LOGO_NORMALIZE_TARGET_EDGE, removeSolidLogoBackground } from "./remove-logo-background";
import { logoBackdropFromPlateMatte, type LogoBackdropResolved } from "./infer-logo-backdrop";

/** Max size of the original file the user may select (before compression). */
export const CMS_MAX_SOURCE_IMAGE_BYTES = 12 * 1024 * 1024;

/** Soft storage budget for the resulting data URL payload (decoded bytes). */
export const CMS_MAX_STORED_IMAGE_BYTES = 900 * 1024;

/**
 * @deprecated Prefer {@link CMS_MAX_SOURCE_IMAGE_BYTES}. Kept so existing imports keep working;
 * now means source-file max (not the old hard 2MB gate).
 */
export const CMS_MAX_IMAGE_UPLOAD_BYTES = CMS_MAX_SOURCE_IMAGE_BYTES;

const PHOTO_MAX_EDGE = 2048;
const LOGO_MAX_EDGE = 1280;
const MIN_QUALITY = 0.45;
/** Logos: do not crush WebP as hard as photos — soft encodes look pixelated on cards. */
const LOGO_MIN_QUALITY = 0.82;
const LOGO_START_QUALITY = 0.95;
const PHOTO_START_QUALITY = 0.85;
const QUALITY_STEP = 0.1;

export type CmsImageCompressProfile = "photo" | "logo";

export type PrepareCmsImageResult =
  | {
      ok: true;
      dataUrl: string;
      mimeType: string;
      compressed: boolean;
      bytesApprox: number;
      /** Present for logo profile: plate color removed (or white if none). */
      logoBackdrop?: LogoBackdropResolved;
    }
  | { ok: false; reason: string };

export function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return dataUrl.length;
  const meta = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  if (/;base64$/i.test(meta)) {
    const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
  }
  try {
    return decodeURIComponent(payload).length;
  } catch {
    return payload.length;
  }
}

export function scaleToMaxEdge(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { width: 1, height: 1 };
  }
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width: Math.round(width), height: Math.round(height) };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function pickOutputMime(inputMime: string, profile: CmsImageCompressProfile, hasAlpha: boolean): string {
  const mime = inputMime.toLowerCase();
  // Logos: prefer lossless PNG so partner marks stay crisp after normalize → encode.
  if (profile === "logo") {
    return "image/png";
  }
  if (hasAlpha) {
    // Prefer WebP with alpha when available; PNG as safe fallback for transparency.
    if (mime === "image/png" || mime === "image/webp" || hasAlpha) {
      return "image/webp";
    }
  }
  if (mime === "image/webp") return "image/webp";
  return "image/jpeg";
}

export function validateImageUploadFile(file: File): string | null {
  if (!file.type.startsWith("image/")) {
    return "Alleen afbeeldingsbestanden zijn toegestaan.";
  }
  if (file.size > CMS_MAX_SOURCE_IMAGE_BYTES) {
    const mb = Math.round(CMS_MAX_SOURCE_IMAGE_BYTES / (1024 * 1024));
    return `Bestand groter dan ${mb}MB. Kies een kleiner bestand.`;
  }
  return null;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Bestand lezen mislukt"));
    reader.readAsDataURL(file);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Bestand lezen mislukt"));
    reader.readAsDataURL(blob);
  });
}

function isRasterSkippable(mime: string): boolean {
  return mime === "image/svg+xml" || mime === "image/gif";
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Afbeelding laden mislukt"));
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function sampleHasAlpha(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    const stepX = Math.max(1, Math.floor(width / 16));
    const stepY = Math.max(1, Math.floor(height / 16));
    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        if (pixel[3] < 250) return true;
      }
    }
  } catch {
    // Cross-origin / tainted canvas — fall back to mime-based alpha guess.
  }
  return false;
}

async function encodeWithinBudget(
  canvas: HTMLCanvasElement,
  preferredMime: string,
  targetBytes: number,
  options?: { profile?: CmsImageCompressProfile },
): Promise<{ blob: Blob; mimeType: string } | null> {
  const profile = options?.profile ?? "photo";
  const isLogo = profile === "logo";
  const candidates =
    preferredMime === "image/png"
      ? isLogo
        ? ["image/png", "image/webp"]
        : ["image/png", "image/webp", "image/jpeg"]
      : preferredMime === "image/webp"
        ? ["image/webp", "image/png", "image/jpeg"]
        : ["image/webp", "image/jpeg"];

  const startQuality = isLogo ? LOGO_START_QUALITY : PHOTO_START_QUALITY;
  const minQuality = isLogo ? LOGO_MIN_QUALITY : MIN_QUALITY;

  for (const mime of candidates) {
    // PNG is lossless — quality arg is ignored by browsers; keep undefined.
    let quality = mime === "image/png" ? undefined : startQuality;
    for (;;) {
      const blob = await canvasToBlob(canvas, mime, quality ?? 0.92);
      if (!blob) break;
      if (blob.size <= targetBytes) {
        return { blob, mimeType: mime };
      }
      if (mime === "image/png" || quality === undefined) break;
      if (quality <= minQuality) break;
      quality = Math.max(minQuality, quality - QUALITY_STEP);
    }
  }
  return null;
}

/**
 * Compress / resize a raster image for CMS storage. SVG and GIF skip rasterization
 * (GIF animation would be lost; SVG stays vector) but still enforce the storage budget.
 */
export async function prepareCmsImageUpload(
  file: File,
  options?: { profile?: CmsImageCompressProfile },
): Promise<PrepareCmsImageResult> {
  const validationError = validateImageUploadFile(file);
  if (validationError) {
    return { ok: false, reason: validationError };
  }

  const profile = options?.profile ?? "photo";
  const mime = (file.type || "image/jpeg").toLowerCase();

  if (isRasterSkippable(mime)) {
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const bytesApprox = estimateDataUrlBytes(dataUrl);
      if (bytesApprox > CMS_MAX_STORED_IMAGE_BYTES) {
        return {
          ok: false,
          reason:
            mime === "image/svg+xml"
              ? "SVG is te groot voor opslag. Vereenvoudig het bestand of gebruik PNG/WebP."
              : "GIF is te groot voor opslag. Gebruik JPG/WebP of een kleinere GIF.",
        };
      }
      return { ok: true, dataUrl, mimeType: mime, compressed: false, bytesApprox };
    } catch {
      return { ok: false, reason: "Bestand lezen mislukt. Probeer een ander bestand." };
    }
  }

  if (typeof document === "undefined" || typeof HTMLCanvasElement === "undefined") {
    return { ok: false, reason: "Afbeelding comprimeren is alleen in de browser beschikbaar." };
  }

  try {
    const img = await loadImageElement(file);
    const maxEdge = profile === "logo" ? LOGO_MAX_EDGE : PHOTO_MAX_EDGE;
    const sourceW = img.naturalWidth || img.width;
    const sourceH = img.naturalHeight || img.height;
    let { width, height } = scaleToMaxEdge(sourceW, sourceH, maxEdge);
    /** Logo normalize long-edge; shrinks on over-budget retries (never re-upscales after shrink). */
    let logoTargetEdge = LOGO_NORMALIZE_TARGET_EDGE;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) {
      return { ok: false, reason: "Canvas niet beschikbaar voor compressie." };
    }

    const mimeHintAlpha = mime === "image/png" || mime === "image/webp";
    let lastBlob: Blob | null = null;
    let lastMime = "image/jpeg";
    let logoBackdrop: LogoBackdropResolved | undefined;

    for (let attempt = 0; attempt < 4; attempt++) {
      // Photos shrink the draw size; logos always redraw from source then normalize to logoTargetEdge.
      if (profile === "logo") {
        ({ width, height } = scaleToMaxEdge(sourceW, sourceH, maxEdge));
      }

      canvas.width = width;
      canvas.height = height;
      ctx.clearRect(0, 0, width, height);
      // High-quality browser resample for the initial draw (not nearest-neighbor).
      ctx.imageSmoothingEnabled = true;
      if ("imageSmoothingQuality" in ctx) {
        ctx.imageSmoothingQuality = "high";
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Logo uploads: strip flat plates, tight-crop, bicubic-normalize to target box.
      if (profile === "logo") {
        const imageData = ctx.getImageData(0, 0, width, height);
        const removal = removeSolidLogoBackground(imageData);
        logoBackdrop = logoBackdropFromPlateMatte(removal.matte);
        const normalized = cropAndNormalizeLogoMark(imageData, {
          minEdge: logoTargetEdge,
          maxEdge: logoTargetEdge,
        });
        if (normalized) {
          width = normalized.width;
          height = normalized.height;
          canvas.width = width;
          canvas.height = height;
          ctx.clearRect(0, 0, width, height);
          const out = ctx.createImageData(width, height);
          out.data.set(normalized.data);
          ctx.putImageData(out, 0, 0);
        } else {
          ctx.putImageData(imageData, 0, 0);
        }
      }

      const hasAlpha =
        profile === "logo" || mimeHintAlpha || sampleHasAlpha(ctx, width, height);
      const preferredMime = pickOutputMime(mime, profile, hasAlpha);
      const encoded = await encodeWithinBudget(canvas, preferredMime, CMS_MAX_STORED_IMAGE_BYTES, {
        profile,
      });
      if (encoded) {
        const dataUrl = await blobToDataUrl(encoded.blob);
        return {
          ok: true,
          dataUrl,
          mimeType: encoded.mimeType,
          compressed: true,
          bytesApprox: encoded.blob.size,
          ...(logoBackdrop ? { logoBackdrop } : {}),
        };
      }

      // Shrink further and retry.
      // Logos: high-quality WebP snapshot of current canvas, then lower normalize target.
      const fallbackQuality = profile === "logo" ? LOGO_MIN_QUALITY : 0.5;
      const fallbackMime =
        preferredMime === "image/png"
          ? profile === "logo"
            ? "image/webp"
            : "image/png"
          : preferredMime;
      lastBlob = await canvasToBlob(canvas, fallbackMime, fallbackQuality);
      lastMime = fallbackMime;
      if (profile === "logo") {
        logoTargetEdge = Math.max(384, Math.round(logoTargetEdge * 0.75));
      } else {
        width = Math.max(1, Math.round(width * 0.75));
        height = Math.max(1, Math.round(height * 0.75));
        if (width < 32 && height < 32) break;
      }
    }

    if (lastBlob && lastBlob.size <= CMS_MAX_STORED_IMAGE_BYTES) {
      const dataUrl = await blobToDataUrl(lastBlob);
      return {
        ok: true,
        dataUrl,
        mimeType: lastMime,
        compressed: true,
        bytesApprox: lastBlob.size,
        ...(logoBackdrop ? { logoBackdrop } : {}),
      };
    }

    // Absolute fallback: original file if already under budget (small PNGs etc.).
    if (file.size <= CMS_MAX_STORED_IMAGE_BYTES) {
      const dataUrl = await readFileAsDataUrl(file);
      return {
        ok: true,
        dataUrl,
        mimeType: mime,
        compressed: false,
        bytesApprox: estimateDataUrlBytes(dataUrl),
      };
    }

    return {
      ok: false,
      reason:
        "Afbeelding is na compressie nog te groot voor opslag. Kies een kleinere of eenvoudigere afbeelding.",
    };
  } catch {
    return { ok: false, reason: "Comprimeren mislukt. Probeer een ander bestand." };
  }
}

/** Infer logo vs photo from PrototypeImageField preferTags. */
export function compressProfileFromTags(tags: string[] | undefined): CmsImageCompressProfile {
  if (!tags?.length) return "photo";
  const logoHints = new Set(["logo", "nav", "brand", "partners"]);
  return tags.some((t) => logoHints.has(t)) ? "logo" : "photo";
}
