/**
 * Server-side image byte validation for CMS media uploads.
 * Does not trust browser-supplied MIME types — inspects magic bytes and dimensions.
 */

export const CMS_MEDIA_BUCKET = "cms-media";

export const CMS_MEDIA_MAX_SOURCE_BYTES = 12 * 1024 * 1024;
export const CMS_MEDIA_MAX_STORED_BYTES = 900 * 1024;

/** Max pixels (width * height) to mitigate decompression bombs. */
export const CMS_MEDIA_MAX_PIXELS = 12_000_000;

export const CMS_MEDIA_PHOTO_MAX_EDGE = 2048;
export const CMS_MEDIA_LOGO_MAX_EDGE = 1280;
export const CMS_MEDIA_GIF_MAX_EDGE = 1280;

export type CmsMediaProfile = "photo" | "logo" | "gif";
export type CmsMediaMime = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export type InspectedCmsImage = {
  mimeType: CmsMediaMime;
  extension: "jpg" | "png" | "webp" | "gif";
  width: number;
  height: number;
  byteSize: number;
};

export type InspectCmsImageFailure = {
  ok: false;
  reason: string;
  code:
    | "empty"
    | "too_large"
    | "unsupported"
    | "svg_rejected"
    | "malformed"
    | "dimensions"
    | "pixels";
};

export type InspectCmsImageResult =
  | ({ ok: true } & InspectedCmsImage)
  | InspectCmsImageFailure;

function readUInt32BE(buf: Uint8Array, offset: number): number {
  return (
    ((buf[offset]! << 24) | (buf[offset + 1]! << 16) | (buf[offset + 2]! << 8) | buf[offset + 3]!) >>>
    0
  );
}

function readUInt16LE(buf: Uint8Array, offset: number): number {
  return buf[offset]! | (buf[offset + 1]! << 8);
}

function readUInt16BE(buf: Uint8Array, offset: number): number {
  return (buf[offset]! << 8) | buf[offset + 1]!;
}

function looksLikeSvg(buf: Uint8Array): boolean {
  const head = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 256)).trimStart();
  return /^<\?xml/i.test(head) || /^<svg[\s>]/i.test(head) || /xmlns=["']http:\/\/www\.w3\.org\/2000\/svg/i.test(head);
}

function parsePng(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  if (
    buf[0] !== 0x89 ||
    buf[1] !== 0x50 ||
    buf[2] !== 0x4e ||
    buf[3] !== 0x47 ||
    buf[4] !== 0x0d ||
    buf[5] !== 0x0a ||
    buf[6] !== 0x1a ||
    buf[7] !== 0x0a
  ) {
    return null;
  }
  // IHDR starts at byte 8; width/height at 16/20
  const width = readUInt32BE(buf, 16);
  const height = readUInt32BE(buf, 20);
  if (width < 1 || height < 1) return null;
  return { width, height };
}

function parseGif(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length < 10) return null;
  const sig = String.fromCharCode(buf[0]!, buf[1]!, buf[2]!, buf[3]!, buf[4]!, buf[5]!);
  if (sig !== "GIF87a" && sig !== "GIF89a") return null;
  const width = readUInt16LE(buf, 6);
  const height = readUInt16LE(buf, 8);
  if (width < 1 || height < 1) return null;
  return { width, height };
}

function parseJpeg(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1]!;
    if (marker === 0xd8 || marker === 0xd9) {
      i += 2;
      continue;
    }
    const length = readUInt16BE(buf, i + 2);
    if (length < 2 || i + 2 + length > buf.length) return null;
    // SOF0–SOF3, SOF5–SOF7, SOF9–SOF11, SOF13–SOF15
    const isSof =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isSof) {
      const height = readUInt16BE(buf, i + 5);
      const width = readUInt16BE(buf, i + 7);
      if (width < 1 || height < 1) return null;
      return { width, height };
    }
    i += 2 + length;
  }
  return null;
}

function parseWebp(buf: Uint8Array): { width: number; height: number } | null {
  if (buf.length < 30) return null;
  if (
    buf[0] !== 0x52 ||
    buf[1] !== 0x49 ||
    buf[2] !== 0x46 ||
    buf[3] !== 0x46 ||
    buf[8] !== 0x57 ||
    buf[9] !== 0x45 ||
    buf[10] !== 0x42 ||
    buf[11] !== 0x50
  ) {
    return null;
  }
  const chunk = String.fromCharCode(buf[12]!, buf[13]!, buf[14]!, buf[15]!);
  if (chunk === "VP8X" && buf.length >= 30) {
    const width = 1 + buf[24]! + (buf[25]! << 8) + (buf[26]! << 16);
    const height = 1 + buf[27]! + (buf[28]! << 8) + (buf[29]! << 16);
    if (width < 1 || height < 1) return null;
    return { width, height };
  }
  if (chunk === "VP8 " && buf.length >= 30) {
    // Lossy bitstream: width/height in frame header after 3-byte frame tag + start code
    const width = readUInt16LE(buf, 26) & 0x3fff;
    const height = readUInt16LE(buf, 28) & 0x3fff;
    if (width < 1 || height < 1) return null;
    return { width, height };
  }
  if (chunk === "VP8L" && buf.length >= 25) {
    const b0 = buf[21]!;
    const b1 = buf[22]!;
    const b2 = buf[23]!;
    const b3 = buf[24]!;
    const width = 1 + (((b1 & 0x3f) << 8) | b0);
    const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    if (width < 1 || height < 1) return null;
    return { width, height };
  }
  return null;
}

export function detectImageFormat(buf: Uint8Array): {
  mimeType: CmsMediaMime;
  extension: InspectedCmsImage["extension"];
  width: number;
  height: number;
} | null {
  if (looksLikeSvg(buf)) return null;

  const png = parsePng(buf);
  if (png) return { mimeType: "image/png", extension: "png", ...png };

  const gif = parseGif(buf);
  if (gif) return { mimeType: "image/gif", extension: "gif", ...gif };

  const jpeg = parseJpeg(buf);
  if (jpeg) return { mimeType: "image/jpeg", extension: "jpg", ...jpeg };

  const webp = parseWebp(buf);
  if (webp) return { mimeType: "image/webp", extension: "webp", ...webp };

  return null;
}

function maxEdgeForProfile(profile: CmsMediaProfile): number {
  if (profile === "logo") return CMS_MEDIA_LOGO_MAX_EDGE;
  if (profile === "gif") return CMS_MEDIA_GIF_MAX_EDGE;
  return CMS_MEDIA_PHOTO_MAX_EDGE;
}

function allowedMimesForProfile(profile: CmsMediaProfile): readonly CmsMediaMime[] {
  if (profile === "logo") return ["image/png", "image/webp"];
  if (profile === "gif") return ["image/gif"];
  return ["image/jpeg", "image/png", "image/webp"];
}

/**
 * Inspect and validate raw image bytes for a CMS media profile.
 */
export function inspectCmsImageBytes(
  bytes: Uint8Array,
  profile: CmsMediaProfile,
): InspectCmsImageResult {
  if (!bytes.length) {
    return { ok: false, reason: "Leeg bestand.", code: "empty" };
  }
  if (bytes.byteLength > CMS_MEDIA_MAX_SOURCE_BYTES) {
    return {
      ok: false,
      reason: `Bestand is groter dan ${Math.round(CMS_MEDIA_MAX_SOURCE_BYTES / (1024 * 1024))} MB.`,
      code: "too_large",
    };
  }
  if (bytes.byteLength > CMS_MEDIA_MAX_STORED_BYTES) {
    return {
      ok: false,
      reason: `Opgeslagen afbeelding mag maximaal ${Math.round(CMS_MEDIA_MAX_STORED_BYTES / 1024)} KB zijn. Comprimeer eerst.`,
      code: "too_large",
    };
  }
  if (looksLikeSvg(bytes)) {
    return {
      ok: false,
      reason: "SVG-uploads zijn niet toegestaan. Gebruik PNG, JPEG, WebP of GIF.",
      code: "svg_rejected",
    };
  }

  const detected = detectImageFormat(bytes);
  if (!detected) {
    return {
      ok: false,
      reason: "Bestand is geen geldige JPEG, PNG, WebP of GIF.",
      code: "malformed",
    };
  }

  const allowed = allowedMimesForProfile(profile);
  if (!allowed.includes(detected.mimeType)) {
    return {
      ok: false,
      reason: `Formaat ${detected.mimeType} past niet bij profiel “${profile}”.`,
      code: "unsupported",
    };
  }

  const pixels = detected.width * detected.height;
  if (pixels > CMS_MEDIA_MAX_PIXELS) {
    return {
      ok: false,
      reason: "Afbeelding heeft te veel pixels (decompressierisico).",
      code: "pixels",
    };
  }

  const maxEdge = maxEdgeForProfile(profile);
  if (detected.width > maxEdge || detected.height > maxEdge) {
    return {
      ok: false,
      reason: `Maximale afmeting is ${maxEdge}px aan de langste zijde.`,
      code: "dimensions",
    };
  }

  return {
    ok: true,
    mimeType: detected.mimeType,
    extension: detected.extension,
    width: detected.width,
    height: detected.height,
    byteSize: bytes.byteLength,
  };
}

export function sanitizeOriginalFilename(name: string | undefined | null): string | null {
  if (!name) return null;
  const base = name.replace(/\\/g, "/").split("/").pop()?.trim() ?? "";
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_").slice(0, 180);
  return cleaned.length > 0 ? cleaned : null;
}

export function buildCmsMediaStoragePath(opts: {
  siteId: string;
  assetId: string;
  extension: InspectedCmsImage["extension"];
}): string {
  return `media/${opts.siteId}/${opts.assetId}.${opts.extension}`;
}

export function deriveCmsMediaPublicUrl(opts: {
  supabaseUrl: string;
  bucketId: string;
  storagePath: string;
}): string {
  const base = opts.supabaseUrl.replace(/\/$/, "");
  const path = opts.storagePath.replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${opts.bucketId}/${path}`;
}
