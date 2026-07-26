import { FIELD_LABELS_NL } from "@mccoy/domain";

export type ParsedFormField = {
  key: string;
  label: string;
  value: string;
};

const LABEL_TO_KEY: Record<string, string> = {};
for (const [key, label] of Object.entries(FIELD_LABELS_NL)) {
  LABEL_TO_KEY[label.toLowerCase()] = key;
}

/** English labels used in older / bilingual templates */
const ENGLISH_LABEL_TO_KEY: Record<string, string> = {
  name: "name",
  email: "email",
  phone: "phone",
  company: "company",
  message: "message",
  floors: "floors",
  windows: "windows",
  height: "height",
  access: "access",
  sides: "sides",
  frequency: "frequency",
  "item type": "item",
  item: "item",
  pieces: "pieces",
  material: "material",
  area: "area",
  "stains / notes": "stains",
  stains: "stains",
  role: "role",
  motivation: "motivation",
  cv: "cv",
  "cover letter": "letter",
  letter: "letter",
  photos: "photos",
};

/** Canonical labels we accept in Formuliergegevens (longest first for matching). */
const KNOWN_LABELS: string[] = Array.from(
  new Set([
    ...Object.values(FIELD_LABELS_NL),
    ...Object.keys(ENGLISH_LABEL_TO_KEY),
    "E-mail",
    "Functie",
    "Motivatie",
    "Motivatiebrief",
    "Type item",
    "Vlekken / notities",
    "Foto's",
  ]),
).sort((a, b) => b.length - a.length);

function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveKey(label: string): string {
  const normalized = label.toLowerCase().trim();
  return (
    LABEL_TO_KEY[normalized] ??
    ENGLISH_LABEL_TO_KEY[normalized] ??
    normalized.replace(/\s+/g, "_")
  );
}

function canonicalLabelForKey(key: string, fallback: string): string {
  return FIELD_LABELS_NL[key] ?? fallback;
}

/**
 * Turn mangled labels like
 * "McCoy Cleaning … Naam" into the clean field label "Naam".
 * Rejects email chrome that is not a real form field.
 */
export function normalizeFormFieldLabel(raw: string): string | null {
  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;

  // Skip known non-field chrome
  if (/^onderwerp$/i.test(trimmed) || /^subject$/i.test(trimmed)) return null;
  if (/^mccoy\s+cleaning$/i.test(trimmed)) return null;

  const lower = trimmed.toLowerCase();
  for (const known of KNOWN_LABELS) {
    if (lower === known.toLowerCase()) {
      const key = resolveKey(known);
      return canonicalLabelForKey(key, known);
    }
  }

  // Sausage ending with a known label (HTML/text chrome collapsed into the label cell)
  for (const known of KNOWN_LABELS) {
    const re = new RegExp(`(?:^|[\\s>:])${escapeRegExp(known)}\\s*$`, "i");
    if (!re.test(trimmed)) continue;
    // Require chrome before the label — avoid chopping short valid labels
    if (trimmed.length <= known.length + 2) continue;
    const key = resolveKey(known);
    return canonicalLabelForKey(key, known);
  }

  // Unknown short labels are kept; long unknown strings are chrome
  if (trimmed.length > 40) return null;
  if (/mccoy\s+cleaning|nieuwe\s+algemene|bezoeker\s+heeft|offerteaanvraag/i.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pushField(
  fields: ParsedFormField[],
  rawLabel: string,
  value: string,
): void {
  const label = normalizeFormFieldLabel(rawLabel);
  if (!label) return;
  const cleanedValue = value.replace(/\s+/g, " ").trim();
  if (!cleanedValue) return;
  // Drop values that are still template chrome
  if (/^mccoy\s+cleaning\b/i.test(cleanedValue) && cleanedValue.length > 80) return;

  const key = resolveKey(label);
  if (fields.some((f) => f.key === key)) return;
  fields.push({ key, label, value: cleanedValue });
}

/**
 * Extract label/value pairs from McCoy form notification HTML (two-column table rows).
 */
export function parseFormFieldsFromHtml(html: string | undefined | null): ParsedFormField[] {
  if (!html?.trim()) return [];

  const fields: ParsedFormField[] = [];
  const rowRe =
    /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = rowRe.exec(html)) !== null) {
    const rawLabel = stripTags(match[1] ?? "");
    const valueHtml = match[2] ?? "";
    const valueWithBreaks = stripTags(
      valueHtml.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n"),
    ).replace(/\s*\n\s*/g, "\n");
    pushField(fields, rawLabel, valueWithBreaks);
  }
  return fields;
}

/** Fallback when only plain text is available (label: value lines). */
export function parseFormFieldsFromText(text: string | undefined | null): ParsedFormField[] {
  if (!text?.trim()) return [];
  const fields: ParsedFormField[] = [];

  // Try "Label: value" lines first
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([^:]{2,80})\s*:\s*(.+)\s*$/);
    if (!m) continue;
    pushField(fields, m[1]!.trim(), m[2]!.trim());
  }
  if (fields.length > 0) return fields;

  // Last resort: split on known label tokens in a single blob
  const labelAlternation = KNOWN_LABELS.map(escapeRegExp).join("|");
  const blobRe = new RegExp(`(?:^|\\s)(${labelAlternation})\\s+`, "gi");
  const parts: { label: string; start: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = blobRe.exec(text)) !== null) {
    parts.push({ label: m[1]!, start: m.index + (m[0].startsWith(" ") ? 1 : 0) });
  }
  for (let i = 0; i < parts.length; i++) {
    const current = parts[i]!;
    const labelEnd = text.indexOf(current.label, current.start) + current.label.length;
    const valueStart = labelEnd;
    const valueEnd = i + 1 < parts.length ? parts[i + 1]!.start : text.length;
    const value = text.slice(valueStart, valueEnd).trim();
    pushField(fields, current.label, value);
  }
  return fields;
}

export function parseAttachmentNamesFromBody(text: string | undefined | null): string[] {
  if (!text) return [];
  const m = text.match(/(?:Bijlagen|Attachments)\s*:\s*([^\n<]+)/im);
  if (!m?.[1]) return [];
  return m[1]
    .split(",")
    .map((s) => s.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean);
}
