/**
 * Server-side CMS media compression for seed scripts (sharp).
 * Mirrors browser prepareCmsImageUpload budgets: ≤900 KB stored, profile edge caps.
 */
import sharp from "sharp";
import {
  CMS_MEDIA_MAX_STORED_BYTES,
  inspectCmsImageBytes,
  type CmsMediaProfile,
  type InspectCmsImageResult,
} from "@mccoy/database/server";

const PHOTO_MAX_EDGE = 2048;
const LOGO_MAX_EDGE = 1280;
const MIN_QUALITY = 45;
const QUALITY_STEP = 10;

export type CompressCmsSeedResult =
  | {
      ok: true;
      bytes: Uint8Array;
      inspected: Extract<InspectCmsImageResult, { ok: true }>;
      compressed: boolean;
    }
  | { ok: false; reason: string };

function maxEdgeFor(profile: CmsMediaProfile): number {
  if (profile === "logo" || profile === "gif") return LOGO_MAX_EDGE;
  return PHOTO_MAX_EDGE;
}

function inspectWithProfileFallback(
  bytes: Uint8Array,
  preferred: CmsMediaProfile,
): InspectCmsImageResult {
  let inspected = inspectCmsImageBytes(bytes, preferred);
  if (!inspected.ok && preferred === "logo") {
    inspected = inspectCmsImageBytes(bytes, "photo");
  }
  return inspected;
}

async function tryEncode(
  pipeline: sharp.Sharp,
  mime: "image/webp" | "image/jpeg" | "image/png",
  quality: number,
): Promise<Buffer> {
  if (mime === "image/png") {
    return pipeline.clone().png({ compressionLevel: 9, palette: false }).toBuffer();
  }
  if (mime === "image/webp") {
    return pipeline.clone().webp({ quality, alphaQuality: quality, effort: 4 }).toBuffer();
  }
  return pipeline.clone().jpeg({ quality, mozjpeg: true }).toBuffer();
}

/**
 * Ensure bytes pass inspectCmsImageBytes for the profile, compressing when over
 * stored size / edge limits. GIFs are not recompressed.
 */
export async function ensureCmsSeedImageFits(
  sourceBytes: Uint8Array,
  preferredProfile: CmsMediaProfile,
): Promise<CompressCmsSeedResult> {
  const direct = inspectWithProfileFallback(sourceBytes, preferredProfile);
  if (direct.ok) {
    return { ok: true, bytes: sourceBytes, inspected: direct, compressed: false };
  }

  if (preferredProfile === "gif" || direct.code === "svg_rejected" || direct.code === "empty") {
    return { ok: false, reason: direct.reason };
  }

  // Source larger than 12MB hard gate — refuse.
  if (direct.code === "too_large" && sourceBytes.byteLength > 12 * 1024 * 1024) {
    return { ok: false, reason: direct.reason };
  }

  let meta: sharp.Metadata;
  try {
    meta = await sharp(sourceBytes, { failOn: "none" }).metadata();
  } catch {
    return { ok: false, reason: "Afbeelding kon niet worden gelezen voor compressie." };
  }

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  if (width < 1 || height < 1) {
    return { ok: false, reason: "Afbeelding heeft geen geldige afmetingen." };
  }

  const hasAlpha = Boolean(meta.hasAlpha);
  const profile: CmsMediaProfile =
    preferredProfile === "logo" && (hasAlpha || meta.format === "png" || meta.format === "webp")
      ? "logo"
      : preferredProfile === "gif"
        ? "gif"
        : "photo";

  if (profile === "gif") {
    return { ok: false, reason: direct.reason };
  }

  const maxEdge = maxEdgeFor(profile);
  const longest = Math.max(width, height);
  const targetW =
    longest > maxEdge ? Math.max(1, Math.round((width * maxEdge) / longest)) : width;
  const targetH =
    longest > maxEdge ? Math.max(1, Math.round((height * maxEdge) / longest)) : height;

  const base = sharp(sourceBytes, { failOn: "none" }).rotate().resize(targetW, targetH, {
    fit: "inside",
    withoutEnlargement: true,
  });

  const mimeCandidates: Array<"image/webp" | "image/png" | "image/jpeg"> =
    profile === "logo" || hasAlpha
      ? ["image/webp", "image/png", "image/jpeg"]
      : ["image/webp", "image/jpeg"];

  let best: Buffer | null = null;

  for (const mime of mimeCandidates) {
    if (mime === "image/png") {
      const buf = await tryEncode(base, mime, 100);
      if (buf.byteLength <= CMS_MEDIA_MAX_STORED_BYTES) {
        best = buf;
        break;
      }
      if (!best || buf.byteLength < best.byteLength) best = buf;
      continue;
    }

    for (let q = 82; q >= MIN_QUALITY; q -= QUALITY_STEP) {
      const buf = await tryEncode(base, mime, q);
      if (buf.byteLength <= CMS_MEDIA_MAX_STORED_BYTES) {
        best = buf;
        break;
      }
      if (!best || buf.byteLength < best.byteLength) best = buf;
    }
    if (best && best.byteLength <= CMS_MEDIA_MAX_STORED_BYTES) break;
  }

  if (!best) {
    return { ok: false, reason: "Compressie produceerde geen uitvoer." };
  }

  const out = new Uint8Array(best);
  const inspected = inspectWithProfileFallback(out, preferredProfile);
  if (!inspected.ok) {
    return {
      ok: false,
      reason: `Na compressie nog ongeldig (${best.byteLength} B): ${inspected.reason}`,
    };
  }

  return { ok: true, bytes: out, inspected, compressed: true };
}
