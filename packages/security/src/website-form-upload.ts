/**
 * Fail-closed website-form upload gate.
 * Allowlist + magic-byte + dangerous-content checks. No third-party AV.
 */

export type WebsiteFormUploadKind =
  | "inquiry"
  | "glass_washing"
  | "furniture_cleaning"
  | "job_application"
  | "newsletter";

export type WebsiteFormDetectedType =
  | "jpeg"
  | "png"
  | "gif"
  | "webp"
  | "heic"
  | "heif"
  | "pdf"
  | "docx"
  | "doc";

export type SafeWebsiteFormUploadResult =
  | { ok: true; detectedType?: WebsiteFormDetectedType }
  | { ok: false; error: string };

/** Offerte / inquiry photo + plattegrond. SVG is not included. */
export const WEBSITE_FORM_MEDIA_FILE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,application/pdf,.pdf";

/** Vacancy CV / cover letter. */
export const WEBSITE_FORM_CV_FILE_ACCEPT = ".pdf,.doc,.docx";

const MEDIA_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "heic", "heif", "pdf"]);
const CV_EXTS = new Set(["pdf", "doc", "docx"]);

const MEDIA_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const CV_MIMES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/x-zip-compressed",
  "application/zip",
]);

const GENERIC_MIMES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

const ALWAYS_BLOCKED_EXTS = new Set([
  "exe",
  "dll",
  "js",
  "mjs",
  "cjs",
  "html",
  "htm",
  "shtml",
  "svg",
  "xml",
  "xsl",
  "xslt",
  "zip",
  "iso",
  "img",
  "lnk",
  "vbs",
  "vbe",
  "ps1",
  "psd1",
  "psm1",
  "jar",
  "msi",
  "msp",
  "bat",
  "cmd",
  "com",
  "scr",
  "pif",
  "cpl",
  "sys",
  "drv",
  "cab",
  "rar",
  "7z",
  "xz",
  "gz",
  "tar",
  "php",
  "asp",
  "aspx",
  "jsp",
  "sh",
  "bash",
  "hta",
  "wsf",
  "wsh",
  "app",
  "dmg",
  "pkg",
  "so",
  "dylib",
]);

const ALWAYS_BLOCKED_MIMES = new Set([
  "image/svg+xml",
  "text/html",
  "application/xhtml+xml",
  "text/xml",
  "application/xml",
  "application/javascript",
  "text/javascript",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-dosexec",
  "application/vnd.microsoft.portable-executable",
]);

const EXT_TO_TYPE: Record<string, WebsiteFormDetectedType> = {
  jpg: "jpeg",
  jpeg: "jpeg",
  png: "png",
  gif: "gif",
  webp: "webp",
  heic: "heic",
  heif: "heif",
  pdf: "pdf",
  docx: "docx",
  doc: "doc",
};

const MIME_TO_TYPE: Record<string, WebsiteFormDetectedType> = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/pjpeg": "jpeg",
  "image/png": "png",
  "image/x-png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
  "application/x-pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

const TYPE_TO_MIME: Record<WebsiteFormDetectedType, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  doc: "application/msword",
};

const HEIF_BRANDS = new Set(["heif", "mif1", "msf1"]);
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis"]);

const PDF_DANGER_TOKENS = [
  "/JavaScript",
  "/JS",
  "/Launch",
  "/EmbeddedFile",
  "/OpenAction",
  "/RichMedia",
];

const MACRO_TOKENS = ["vbaProject.bin", "word/vbaData", "_VBA_PROJECT"];
const OLE_MACRO_TOKENS = ["_VBA_PROJECT", "Macros"];

const SCAN_HEAD_BYTES = 2 * 1024 * 1024;
const SCAN_TAIL_BYTES = 64 * 1024;

function quoteName(filename: string): string {
  const name = filename.trim() || "bestand";
  return `Bestand “${name}”`;
}

function fileExt(filename: string): string {
  const trimmed = filename.trim();
  const base = trimmed.split(/[/\\]/).pop() ?? trimmed;
  const dot = base.lastIndexOf(".");
  if (dot <= 0 || dot === base.length - 1) return "";
  return base.slice(dot + 1).toLowerCase();
}

function normalizeMime(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

function allowlistForKind(kind: string): { exts: Set<string>; mimes: Set<string> } | "none" | "unknown" {
  switch (kind) {
    case "inquiry":
    case "glass_washing":
    case "furniture_cleaning":
      return { exts: MEDIA_EXTS, mimes: MEDIA_MIMES };
    case "job_application":
      return { exts: CV_EXTS, mimes: CV_MIMES };
    case "newsletter":
      return "none";
    default:
      return "unknown";
  }
}

function kindAllowsType(kind: string, detected: WebsiteFormDetectedType): boolean {
  if (kind === "job_application") return detected === "pdf" || detected === "doc" || detected === "docx";
  if (kind === "inquiry" || kind === "glass_washing" || kind === "furniture_cleaning") {
    return (
      detected === "jpeg" ||
      detected === "png" ||
      detected === "gif" ||
      detected === "webp" ||
      detected === "heic" ||
      detected === "heif" ||
      detected === "pdf"
    );
  }
  return false;
}

function toBytes(input: Uint8Array | ArrayBuffer): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input);
}

function asciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  if (offset < 0 || offset + text.length > bytes.length) return false;
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

function latin1Window(bytes: Uint8Array, start: number, end: number): string {
  const slice = bytes.subarray(start, Math.min(end, bytes.length));
  let out = "";
  const step = 0x8000;
  for (let i = 0; i < slice.length; i += step) {
    out += String.fromCharCode(...slice.subarray(i, i + step));
  }
  return out;
}

function scanWindows(bytes: Uint8Array, tokens: readonly string[]): boolean {
  if (!bytes.length) return false;
  const headEnd = Math.min(bytes.length, SCAN_HEAD_BYTES);
  const tailStart = Math.max(0, bytes.length - SCAN_TAIL_BYTES);
  const windows = [latin1Window(bytes, 0, headEnd)];
  if (tailStart > headEnd) windows.push(latin1Window(bytes, tailStart, bytes.length));
  return windows.some((chunk) => tokens.some((token) => chunk.includes(token)));
}

function skipBomAndWs(bytes: Uint8Array, max = 1024): number {
  let i = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;
  while (i < bytes.length && i < max) {
    const b = bytes[i]!;
    if (b === 0x00 || b === 0x09 || b === 0x0a || b === 0x0d || b === 0x20) {
      i += 1;
      continue;
    }
    break;
  }
  return i;
}

function looksLikeHtmlOrXml(bytes: Uint8Array): boolean {
  const i = skipBomAndWs(bytes);
  if (bytes[i] !== 0x3c) return false;
  const head = latin1Window(bytes, i, i + 512).toLowerCase();
  return (
    head.startsWith("<?xml") ||
    head.startsWith("<!doctype") ||
    head.startsWith("<html") ||
    head.startsWith("<svg") ||
    head.startsWith("<xhtml") ||
    head.startsWith("<script") ||
    head.includes("<svg") ||
    head.includes("<html")
  );
}

function isZip(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07)
  );
}

function looksLikeOfficeZip(bytes: Uint8Array): boolean {
  return scanWindows(bytes, ["[Content_Types].xml", "word/"]);
}

function ftypBrand(bytes: Uint8Array): string {
  if (bytes.length < 12 || !asciiAt(bytes, 4, "ftyp")) return "";
  return String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!).toLowerCase();
}

type MagicHit =
  | { kind: "type"; type: WebsiteFormDetectedType }
  | { kind: "mz" }
  | { kind: "html_xml" }
  | { kind: "unknown" };

function detectMagic(bytes: Uint8Array): MagicHit {
  if (bytes.length < 3) {
    if (looksLikeHtmlOrXml(bytes)) return { kind: "html_xml" };
    return { kind: "unknown" };
  }

  if (bytes[0] === 0x4d && bytes[1] === 0x5a) return { kind: "mz" };

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { kind: "type", type: "jpeg" };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { kind: "type", type: "png" };
  }
  if (asciiAt(bytes, 0, "GIF87a") || asciiAt(bytes, 0, "GIF89a")) {
    return { kind: "type", type: "gif" };
  }
  if (asciiAt(bytes, 0, "RIFF") && bytes.length >= 12 && asciiAt(bytes, 8, "WEBP")) {
    return { kind: "type", type: "webp" };
  }

  const pdfAt = skipBomAndWs(bytes);
  if (asciiAt(bytes, pdfAt, "%PDF")) return { kind: "type", type: "pdf" };

  const brand = ftypBrand(bytes);
  if (HEIC_BRANDS.has(brand)) return { kind: "type", type: "heic" };
  if (HEIF_BRANDS.has(brand)) return { kind: "type", type: "heif" };

  if (
    bytes.length >= 4 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  ) {
    return { kind: "type", type: "doc" };
  }

  if (isZip(bytes)) {
    if (looksLikeOfficeZip(bytes)) return { kind: "type", type: "docx" };
    return { kind: "unknown" };
  }

  if (looksLikeHtmlOrXml(bytes)) return { kind: "html_xml" };
  return { kind: "unknown" };
}

function hasDocxMacros(bytes: Uint8Array): boolean {
  return scanWindows(bytes, MACRO_TOKENS);
}

function hasDocMacros(bytes: Uint8Array): boolean {
  return scanWindows(bytes, OLE_MACRO_TOKENS);
}

function hasDangerousPdf(bytes: Uint8Array): boolean {
  return scanWindows(bytes, PDF_DANGER_TOKENS);
}

function mimeAllowedForExt(
  kind: string,
  mime: string,
  ext: string,
): boolean {
  if (GENERIC_MIMES.has(mime)) return true;
  if (kind === "job_application" && ext === "docx" && (mime === "application/zip" || mime === "application/x-zip-compressed")) {
    return true;
  }
  const fromMime = MIME_TO_TYPE[mime];
  const fromExt = EXT_TO_TYPE[ext];
  if (!fromMime || !fromExt) return false;
  if (fromMime === fromExt) return true;
  if ((fromMime === "heic" || fromMime === "heif") && (fromExt === "heic" || fromExt === "heif")) {
    return true;
  }
  return false;
}

export function websiteFormFileAccept(kind: string): string {
  if (kind === "job_application") return WEBSITE_FORM_CV_FILE_ACCEPT;
  if (kind === "inquiry" || kind === "glass_washing" || kind === "furniture_cleaning") {
    return WEBSITE_FORM_MEDIA_FILE_ACCEPT;
  }
  return "";
}

export function canonicalWebsiteFormContentType(detected: WebsiteFormDetectedType): string {
  return TYPE_TO_MIME[detected];
}

/**
 * Kind allowlist always. Magic-byte + content scan when `bytes` are present.
 * Fail-closed on unknown types, MZ, macros, and dangerous PDF actions.
 */
export function assertSafeWebsiteFormUpload(input: {
  kind: WebsiteFormUploadKind | string;
  filename: string;
  contentType: string;
  bytes?: Uint8Array | ArrayBuffer;
}): SafeWebsiteFormUploadResult {
  const filename = input.filename.trim() || "bestand";
  const ext = fileExt(filename);
  const mime = normalizeMime(input.contentType ?? "");
  const allow = allowlistForKind(input.kind);

  if (allow === "none") {
    return { ok: false, error: `${quoteName(filename)} kan niet worden geüpload bij dit formulier.` };
  }
  if (allow === "unknown") {
    return { ok: false, error: `${quoteName(filename)} is geen toegestaan bestandstype.` };
  }
  if (!ext) {
    return { ok: false, error: `${quoteName(filename)} is geen toegestaan bestandstype.` };
  }
  if (ALWAYS_BLOCKED_EXTS.has(ext) || ALWAYS_BLOCKED_MIMES.has(mime)) {
    return { ok: false, error: `${quoteName(filename)} is geen toegestaan bestandstype.` };
  }
  if (!allow.exts.has(ext)) {
    return { ok: false, error: `${quoteName(filename)} is geen toegestaan bestandstype.` };
  }
  if (!GENERIC_MIMES.has(mime) && !allow.mimes.has(mime) && !(input.kind === "job_application" && ext === "docx" && (mime === "application/zip" || mime === "application/x-zip-compressed"))) {
    return { ok: false, error: `${quoteName(filename)} is geen toegestaan bestandstype.` };
  }
  if (!mimeAllowedForExt(input.kind, mime, ext)) {
    return { ok: false, error: `${quoteName(filename)} komt niet overeen met het opgegeven type.` };
  }

  if (input.bytes == null) {
    return { ok: true };
  }

  const bytes = toBytes(input.bytes);
  if (bytes.length <= 0) {
    return { ok: false, error: `${quoteName(filename)} heeft een ongeldige grootte.` };
  }

  const magic = detectMagic(bytes);
  if (magic.kind === "mz") {
    return { ok: false, error: `${quoteName(filename)} is onveilig en is geblokkeerd.` };
  }
  if (magic.kind === "html_xml") {
    return { ok: false, error: `${quoteName(filename)} is geen toegestaan bestandstype.` };
  }
  if (magic.kind === "unknown") {
    return { ok: false, error: `${quoteName(filename)} is geen toegestaan bestandstype.` };
  }

  const detected = magic.type;
  if (!kindAllowsType(input.kind, detected)) {
    return { ok: false, error: `${quoteName(filename)} is geen toegestaan bestandstype.` };
  }

  const expectedFromExt = EXT_TO_TYPE[ext];
  if (expectedFromExt && expectedFromExt !== detected) {
    if (!((expectedFromExt === "heic" || expectedFromExt === "heif") && (detected === "heic" || detected === "heif"))) {
      return { ok: false, error: `${quoteName(filename)} komt niet overeen met het opgegeven type.` };
    }
  }
  const expectedFromMime = MIME_TO_TYPE[mime];
  if (expectedFromMime && expectedFromMime !== detected) {
    if (!((expectedFromMime === "heic" || expectedFromMime === "heif") && (detected === "heic" || detected === "heif"))) {
      return { ok: false, error: `${quoteName(filename)} komt niet overeen met het opgegeven type.` };
    }
  }

  if (detected === "docx" && hasDocxMacros(bytes)) {
    return { ok: false, error: `${quoteName(filename)} bevat onveilige inhoud.` };
  }
  if (detected === "doc" && hasDocMacros(bytes)) {
    return { ok: false, error: `${quoteName(filename)} bevat onveilige inhoud.` };
  }
  if (detected === "pdf" && hasDangerousPdf(bytes)) {
    return { ok: false, error: `${quoteName(filename)} bevat onveilige inhoud.` };
  }

  return { ok: true, detectedType: detected };
}