/**
 * Strip common LLM wrappers (markdown fences, leading labels) and return plain text.
 */
export function stripModelWrappers(raw: string): string {
  let text = raw.trim();
  if (!text) return "";

  // Remove zero-width / BOM first so fence matching is reliable.
  text = text.replace(/^\uFEFF/, "").replace(/[\u200B-\u200D\uFEFF]/g, "").trim();

  // Exact fence: ```json ... ``` or ``` ... ```
  const fullFence = /^```(?:json|text|markdown)?\s*\r?\n?([\s\S]*?)\r?\n?```$/i.exec(text);
  if (fullFence?.[1]) {
    return fullFence[1].trim();
  }

  // Fence embedded in prose (model often adds a short lead-in/outro).
  const embeddedFence = /```(?:json|text|markdown)?\s*\r?\n?([\s\S]*?)\r?\n?```/i.exec(text);
  if (embeddedFence?.[1]) {
    return embeddedFence[1].trim();
  }

  return text.trim();
}

/** Remove HTML tags and collapse whitespace for CMS plain-text fields. */
export function sanitizePlainText(raw: string, maxChars: number): string {
  let text = stripModelWrappers(raw);
  text = text.replace(/<[^>]*>/g, " ");
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Collapse 3+ newlines to 2
  text = text.replace(/\n{3,}/g, "\n\n");
  // Collapse horizontal whitespace (keep newlines)
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();
  if (text.length > maxChars) {
    text = text.slice(0, maxChars).trimEnd();
  }
  return text;
}

/** Decorative underline / hr-like line (underscores, dashes, box-drawing). */
const SEPARATOR_LINE_RE = /^[\s]*([_\u2013\u2014\u2212\-]{3,}|[═─━﹣－]{3,})[\s]*$/;
/** Separator run glued to end of a sentence (e.g. `progress!____`). */
const GLUED_SEPARATOR_RE =
  /^(.*[^_\u2013\u2014\u2212\-═─━﹣－\s])[ \t]*([_\u2013\u2014\u2212\-]{3,}|[═─━﹣－]{3,})\s*$/;
/** Leading list bullet used in CMS plain-text bodies. */
const BULLET_LEAD_RE = /^([•\u2022])\s*/;

const QUOTE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['"', '"'],
  ["'", "'"],
  ["„", '"'],
  ["„", "“"],
  ["«", "»"],
  ["“", "”"],
  ["‘", "’"],
];

function normalizeNewlines(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function isSeparatorLine(line: string): boolean {
  return SEPARATOR_LINE_RE.test(line);
}

function lineLooksQuoted(line: string): boolean {
  const t = line.trim();
  if (t.length < 3) return false;
  return QUOTE_PAIRS.some(
    ([open, close]) =>
      t.startsWith(open) &&
      t.endsWith(close) &&
      t.length > open.length + close.length,
  );
}

function wrapWithAsciiQuotes(line: string): string {
  const t = line.trim();
  if (lineLooksQuoted(t)) return t;
  return `"${t}"`;
}

function extractBulletPrefix(line: string): string | null {
  const m = BULLET_LEAD_RE.exec(line.trim());
  return m ? `${m[1]} ` : null;
}

/**
 * Compact line-role fingerprint for tests / debugging.
 * B=blank, S=separator, •=bullet, Q=quoted, P=prose.
 */
export function lineSkeletonFingerprint(text: string): string {
  return normalizeNewlines(text)
    .split("\n")
    .map((line) => {
      if (!line.trim()) return "B";
      if (isSeparatorLine(line)) return "S";
      const t = line.trim();
      if (BULLET_LEAD_RE.test(t)) return "•";
      if (lineLooksQuoted(t)) return "Q";
      return "P";
    })
    .join("");
}

type TrailingSeparators = {
  /** Separator lines as they appear in the Dutch source (trimmed). */
  lines: string[];
  /** Blank lines between last content line and the first separator. */
  blankLinesBefore: number;
};

function extractTrailingSeparators(source: string): TrailingSeparators | null {
  const lines = normalizeNewlines(source).split("\n");
  let end = lines.length - 1;
  while (end >= 0 && lines[end]!.trim() === "") end -= 1;
  if (end < 0 || !isSeparatorLine(lines[end]!)) return null;

  const sepLines: string[] = [];
  while (end >= 0 && isSeparatorLine(lines[end]!)) {
    sepLines.unshift(lines[end]!.trim());
    end -= 1;
  }

  let blankLinesBefore = 0;
  while (end >= 0 && lines[end]!.trim() === "") {
    blankLinesBefore += 1;
    end -= 1;
  }

  return { lines: sepLines, blankLinesBefore };
}

function stripTrailingSeparatorsFromTarget(text: string): string {
  const lines = normalizeNewlines(text).split("\n");
  while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") {
    lines.pop();
  }
  while (lines.length > 0 && isSeparatorLine(lines[lines.length - 1]!)) {
    lines.pop();
    while (lines.length > 0 && lines[lines.length - 1]!.trim() === "") {
      lines.pop();
    }
  }
  if (lines.length > 0) {
    const last = lines[lines.length - 1]!;
    const glued = GLUED_SEPARATOR_RE.exec(last);
    if (glued?.[1]) {
      lines[lines.length - 1] = glued[1].trimEnd();
    }
  }
  return lines.join("\n").trimEnd();
}

function isContentLine(line: string): boolean {
  return Boolean(line.trim()) && !isSeparatorLine(line);
}

function alignLineDecorations(nlLine: string, enLine: string): string {
  const nlTrim = nlLine.trim();
  let enTrim = enLine.trim();
  if (!enTrim) return enTrim;

  const nlBullet = extractBulletPrefix(nlTrim);
  if (nlBullet && !extractBulletPrefix(enTrim)) {
    enTrim = `${nlBullet}${enTrim}`;
  }

  if (lineLooksQuoted(nlTrim) && !lineLooksQuoted(enTrim)) {
    const withoutBullet = nlBullet && enTrim.startsWith(nlBullet) ? enTrim.slice(nlBullet.length) : enTrim;
    if (withoutBullet.length <= Math.max(80, nlTrim.length + 24)) {
      const quoted = wrapWithAsciiQuotes(withoutBullet);
      enTrim = nlBullet ? `${nlBullet}${quoted}` : quoted;
    }
  }

  return enTrim;
}

function stitchContentOntoNlSkeleton(nlLines: string[], enContent: string[]): string {
  let ci = 0;
  return nlLines
    .map((nlLine) => {
      if (!nlLine.trim()) return "";
      if (isSeparatorLine(nlLine)) return nlLine.trim();
      const en = enContent[ci++] ?? "";
      return alignLineDecorations(nlLine, en);
    })
    .join("\n")
    .replace(/\n+$/g, "");
}

/** Split a collapsed EN blob on bullet markers while keeping each `• …` piece. */
function splitOnBulletMarkers(text: string): string[] {
  return text
    .split(/(?=[•\u2022]\s)/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Peel a flattened EN string into N pieces matching NL content-line roles
 * (bullets, interstitial prose, subheads). Best-effort; returns [] when it
 * cannot reach the NL content count.
 */
function resplitFlatToNlContent(flat: string, nlContent: string[]): string[] {
  const n = nlContent.length;
  if (n === 0) return [];
  if (n === 1) return [flat.trim()];

  let rest = flat.replace(/[ \t]+/g, " ").trim();
  if (!rest) return [];

  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      out.push(rest.trim());
      break;
    }

    const cur = nlContent[i]!.trim();
    const next = nlContent[i + 1]!.trim();
    const curBullet = extractBulletPrefix(cur);
    const nextBullet = extractBulletPrefix(next);

    // Quoted tagline / short quoted line: take through the closing quote.
    if (lineLooksQuoted(cur) || (/^["“„«]/.test(cur) && !curBullet)) {
      const quoted = /^"[^"]*"/.exec(rest)
        ?? /^“[^”]*”/.exec(rest)
        ?? /^„[^”"]*["”]/.exec(rest)
        ?? /^«[^»]*»/.exec(rest);
      if (quoted) {
        out.push(quoted[0].trim());
        rest = rest.slice(quoted[0].length).trim();
        continue;
      }
    }

    if (curBullet) {
      const bulletAt = rest.search(/[•\u2022]\s/);
      if (bulletAt > 0) {
        if (out.length > 0) {
          out[out.length - 1] = `${out[out.length - 1]} ${rest.slice(0, bulletAt).trim()}`.trim();
        }
        rest = rest.slice(bulletAt).trim();
      }

      const bulletChunk = /^[•\u2022]\s*[^•\u2022]*/.exec(rest);
      if (bulletChunk) {
        const raw = bulletChunk[0];
        if (nextBullet) {
          out.push(raw.trim());
          rest = rest.slice(raw.length).trim();
          continue;
        }
        // Next NL line is prose/subhead — do not let this bullet swallow it.
        const maxLen = Math.max(cur.length + 8, Math.round(cur.length * 1.35));
        if (raw.length > maxLen) {
          let cut = Math.min(raw.length, maxLen);
          const minCut = Math.max((curBullet?.length ?? 1) + 8, Math.floor(cur.length * 0.7));
          const searchFrom = Math.min(raw.length - 1, Math.max(minCut, Math.floor(cur.length * 0.85)));
          // Only look for a sentence boundary near the expected bullet length —
          // not later in a glued paragraph (e.g. `. More information`).
          const lookAheadEnd = Math.min(raw.length, Math.max(maxLen + 28, searchFrom + 48));
          const region = raw.slice(searchFrom, lookAheadEnd);
          const sentenceBreak = region.search(/[,.]\s+(?=[A-Z"'„«])/);
          if (sentenceBreak >= 0) {
            cut = searchFrom + sentenceBreak + 1;
          } else {
            // e.g. `accessories Whether you are looking…` (no comma before next sentence)
            const capsBreak = region.search(/\s+(?=[A-Z][a-z]{2,}\b)/);
            if (capsBreak >= 0) {
              cut = searchFrom + capsBreak;
            } else {
              const spaceIdx = raw.lastIndexOf(" ", cut);
              if (spaceIdx > (curBullet?.length ?? 1) + 2) cut = spaceIdx;
            }
          }
          out.push(raw.slice(0, cut).trim());
          rest = `${raw.slice(cut)}${rest.slice(raw.length)}`.trim();
          continue;
        }
        out.push(raw.trim());
        rest = rest.slice(raw.length).trim();
        continue;
      }
    }

    if (nextBullet) {
      const idx = rest.search(/[•\u2022]\s/);
      if (idx > 0) {
        out.push(rest.slice(0, idx).trim());
        rest = rest.slice(idx).trim();
        continue;
      }
      if (idx === 0 && !curBullet) {
        out.push("");
        continue;
      }
    }

    // Next NL line is a short subhead (`…?` / `Label: rest`) — stop current prose before it.
    const nextIsSubhead =
      !extractBulletPrefix(next) &&
      next.length <= 96 &&
      next.split(/\s+/).length <= 12 &&
      (/[?:]$/.test(next) || /^.{1,50}:\s+\S/.test(next));
    if (nextIsSubhead) {
      const wantsColon = /:/.test(next);
      const wantsQuestion = /\?/.test(next) && !wantsColon;
      const colonAt = wantsColon
        ? rest.search(/\b[A-Z][^.!?]{0,70}:\s+\S/)
        : -1;
      const qAt = wantsQuestion
        ? rest.search(/\b[A-Z][^!?]{0,70}\?(?=\s+[A-Z"'„«]|$)/)
        : -1;
      const idx = colonAt >= 0 ? colonAt : qAt;
      if (idx > 0) {
        out.push(rest.slice(0, idx).trim());
        rest = rest.slice(idx).trim();
        continue;
      }
    }

    // Length-proportional peel at a word boundary for prose / subheads.
    const remainingNl = nlContent.slice(i);
    const totalLen = remainingNl.reduce((sum, l) => sum + Math.max(1, l.trim().length), 0);
    const target = Math.max(
      1,
      Math.round((rest.length * Math.max(1, cur.length)) / totalLen),
    );
    let cut = Math.min(rest.length, target);
    if (cut < rest.length) {
      const spaceIdx = rest.lastIndexOf(" ", cut);
      if (spaceIdx > Math.floor(cut * 0.45)) cut = spaceIdx;
    }
    // Prefer ending at `?` / `:` when NL line ends that way (subheads).
    if (/[?:]$/.test(cur) && cut < rest.length) {
      const window = rest.slice(0, Math.min(rest.length, Math.max(cut, cur.length * 2)));
      const punct = Math.max(window.lastIndexOf("?"), window.lastIndexOf(":"));
      if (punct >= Math.floor(cur.length * 0.4)) {
        cut = punct + 1;
      }
    }
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }

  return out.length === n && out.every((p) => p.length > 0) ? out : [];
}

/**
 * When EN has fewer content lines than NL (model flattened pagination), expand
 * collapsed bullet runs and remap onto the Dutch blank/separator skeleton.
 */
function realignCollapsedLineSkeleton(nl: string, en: string): string | null {
  const nlLines = normalizeNewlines(nl).split("\n");
  const enLines = normalizeNewlines(en).split("\n");
  const nlContent = nlLines.filter(isContentLine);
  let enContent = enLines.filter(isContentLine).map((l) => l.trim());

  if (nlContent.length <= 1) return null;

  // Expand any single line that still contains multiple bullet markers.
  const expanded: string[] = [];
  for (const line of enContent) {
    const bulletCount = (line.match(/[•\u2022]/g) ?? []).length;
    if (bulletCount >= 2) {
      expanded.push(...splitOnBulletMarkers(line));
    } else {
      expanded.push(line);
    }
  }
  enContent = expanded;

  if (enContent.length === nlContent.length) {
    return stitchContentOntoNlSkeleton(nlLines, enContent);
  }
  if (enContent.length > nlContent.length) return null;

  // Full flatten + role-aware resplit (handles partial lists that collapsed mid-field).
  const resplit = resplitFlatToNlContent(enContent.join(" "), nlContent);
  if (resplit.length === nlContent.length) {
    return stitchContentOntoNlSkeleton(nlLines, resplit);
  }

  return null;
}

export type TranslateLineSlot =
  | { kind: "blank" }
  | { kind: "separator"; text: string }
  | { kind: "content"; unitKey: string };

export type TranslateLinePlan = {
  originalKey: string;
  slots: TranslateLineSlot[];
};

/**
 * Split multiline CMS strings into one translate unit per non-empty content line.
 * Blank lines and separator-only lines stay in the plan and are not sent to the model.
 */
export function expandFieldsToLineUnits(fields: Record<string, string>): {
  units: Record<string, string>;
  plans: TranslateLinePlan[];
} {
  const units: Record<string, string> = {};
  const plans: TranslateLinePlan[] = [];
  let unitIndex = 0;

  for (const [key, value] of Object.entries(fields)) {
    const lines = normalizeNewlines(value).split("\n");
    if (lines.length <= 1) {
      const unitKey = `u${unitIndex++}`;
      units[unitKey] = value;
      plans.push({ originalKey: key, slots: [{ kind: "content", unitKey }] });
      continue;
    }

    const slots: TranslateLineSlot[] = [];
    for (const line of lines) {
      if (!line.trim()) {
        slots.push({ kind: "blank" });
        continue;
      }
      if (isSeparatorLine(line)) {
        slots.push({ kind: "separator", text: line.trim() });
        continue;
      }
      const unitKey = `u${unitIndex++}`;
      units[unitKey] = line.trim();
      slots.push({ kind: "content", unitKey });
    }
    plans.push({ originalKey: key, slots });
  }

  return { units, plans };
}

/** Reassemble per-line translations onto the original blank/separator skeleton. */
export function collapseLineUnitsToFields(
  translatedUnits: Record<string, string>,
  plans: TranslateLinePlan[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const plan of plans) {
    const parts: string[] = [];
    for (const slot of plan.slots) {
      if (slot.kind === "blank") {
        parts.push("");
        continue;
      }
      if (slot.kind === "separator") {
        parts.push(slot.text);
        continue;
      }
      const raw = translatedUnits[slot.unitKey];
      parts.push(typeof raw === "string" ? raw.trim() : "");
    }
    // Drop trailing empty lines introduced by a trailing blank slot, but keep
    // intentional blank lines between content blocks.
    while (parts.length > 0 && parts[parts.length - 1] === "") {
      parts.pop();
    }
    out[plan.originalKey] = parts.join("\n");
  }
  return out;
}

/**
 * Structural repair after NL→EN: restore separators, leading quotes, and —
 * when the model flattened pagination — the Dutch line skeleton (blanks,
 * bullets, subheads). Field-agnostic for any multiline CMS string.
 */
export function preserveTranslatedFieldStructure(
  sourceNl: string,
  translatedEn: string,
): string {
  const nl = normalizeNewlines(sourceNl);
  let en = normalizeNewlines(translatedEn).trim();
  if (!nl.trim() || !en) return translatedEn;

  const trailing = extractTrailingSeparators(nl);
  const bodyEn = trailing ? stripTrailingSeparatorsFromTarget(en) : en;

  // Prefer full NL line-skeleton remap (blanks, bullets, separators). When that
  // cannot run, fall back to re-attaching trailing separators only.
  const realigned = realignCollapsedLineSkeleton(nl, bodyEn);
  if (realigned != null) {
    en = realigned;
  } else {
    en = bodyEn;
    if (trailing) {
      const gap = Math.max(1, trailing.blankLinesBefore);
      en = `${en}${"\n".repeat(gap)}${trailing.lines.join("\n")}`;
    }
  }

  const nlFirst = nl.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "";
  if (lineLooksQuoted(nlFirst)) {
    const enLines = en.split("\n");
    const firstIdx = enLines.findIndex((l) => l.trim().length > 0);
    if (firstIdx >= 0 && !lineLooksQuoted(enLines[firstIdx]!)) {
      // Only wrap a short first line when EN already has further body lines
      // (not merely a trailing separator we just re-attached).
      const candidate = enLines[firstIdx]!.trim();
      const followingBody = enLines
        .slice(firstIdx + 1)
        .some((l) => l.trim().length > 0 && !isSeparatorLine(l));
      if (followingBody && candidate.length <= Math.max(80, nlFirst.length + 24)) {
        enLines[firstIdx] = wrapWithAsciiQuotes(candidate);
        en = enLines.join("\n");
      }
    }
  }

  return en;
}

/** Trailing commas before } or ] — common model slip even under json_object. */
export function repairCommonJsonIssues(json: string): string {
  return json.replace(/,\s*([}\]])/g, "$1");
}

/**
 * Extract a balanced `{...}` or `[...]` slice, respecting JSON string escapes.
 * Returns null when the structure is truncated / never closed.
 */
export function extractBalancedJsonSlice(
  text: string,
  openChar: "{" | "[" = "{",
): string | null {
  const closeChar = openChar === "{" ? "}" : "]";
  const start = text.indexOf(openChar);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === "\\") {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === openChar) depth += 1;
    else if (c === closeChar) {
      depth -= 1;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function unescapeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }
}

/**
 * Recover complete `"key":"value"` string pairs from a truncated or messy
 * fields object. Safe: only accepts fully closed string literals.
 */
export function extractPartialStringFields(raw: string): Record<string, string> {
  const cleaned = stripModelWrappers(raw);
  const fieldsMarker = /"fields"\s*:\s*\{/i.exec(cleaned);
  const searchFrom = fieldsMarker
    ? fieldsMarker.index + fieldsMarker[0].length
    : Math.max(0, cleaned.indexOf("{") + 1);

  const slice = cleaned.slice(searchFrom);
  const out: Record<string, string> = {};
  const pairRe = /"((?:\\.|[^"\\])*)"\s*:\s*"((?:\\.|[^"\\])*)"/g;
  let match: RegExpExecArray | null;
  while ((match = pairRe.exec(slice)) !== null) {
    const key = unescapeJsonString(match[1]!);
    const value = unescapeJsonString(match[2]!);
    if (key === "fields") continue;
    if (!key.trim() || !value.trim()) continue;
    out[key] = value;
  }
  return out;
}

function tryParseJson(candidate: string): unknown {
  const repaired = repairCommonJsonIssues(candidate.trim());
  return JSON.parse(repaired);
}

/**
 * Parse a JSON object from model output. Tolerates markdown fences, leading/
 * trailing prose, trailing commas, and (when needed) first balanced `{...}`.
 */
export function extractJsonObject(raw: string): unknown {
  const cleaned = stripModelWrappers(raw);

  try {
    return tryParseJson(cleaned);
  } catch {
    // continue
  }

  const balanced = extractBalancedJsonSlice(cleaned, "{");
  if (balanced) {
    try {
      return tryParseJson(balanced);
    } catch {
      // continue
    }
  }

  // Last-index fallback (legacy behaviour) after repair.
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return tryParseJson(cleaned.slice(start, end + 1));
    } catch {
      // continue
    }
  }

  throw new Error("Model output is not valid JSON");
}

export function parseTextResult(raw: string, maxChars: number): { text: string; warnings: string[] } {
  const warnings: string[] = [];
  let text = "";

  try {
    const parsed = extractJsonObject(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.text === "string") {
        text = obj.text;
      } else if (typeof obj.copy === "string") {
        text = obj.copy;
      }
    }
  } catch {
    // Fall back to plain text
    text = raw;
    warnings.push("Model gaf geen JSON terug; platte tekst gebruikt.");
  }

  const sanitized = sanitizePlainText(text, maxChars);
  if (!sanitized) {
    throw new Error("Lege AI-output na opschonen");
  }
  if (sanitized.length < text.trim().length) {
    warnings.push(`Tekst ingekort tot ${maxChars} tekens.`);
  }
  return { text: sanitized, warnings };
}

function bagFromParsedObject(
  parsed: unknown,
): Record<string, unknown> | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  if (obj.fields && typeof obj.fields === "object" && !Array.isArray(obj.fields)) {
    return obj.fields as Record<string, unknown>;
  }
  return obj;
}

export function parseFieldsResult(
  raw: string,
  expectedKeys: string[],
  maxCharsPerField: number,
): { fields: Record<string, string>; warnings: string[] } {
  const warnings: string[] = [];
  let bag: Record<string, unknown> | null = null;
  let usedPartialRecovery = false;

  try {
    bag = bagFromParsedObject(extractJsonObject(raw));
  } catch {
    bag = null;
  }

  if (!bag) {
    const partial = extractPartialStringFields(raw);
    if (Object.keys(partial).length > 0) {
      bag = partial;
      usedPartialRecovery = true;
      warnings.push(
        "AI-JSON was onvolledig; gedeeltelijke velden hersteld. Ontbrekende EN-velden kun je handmatig aanvullen.",
      );
    }
  }

  if (!bag) {
    throw new Error("Verwacht een JSON-object met fields");
  }

  if (!usedPartialRecovery && Object.keys(bag).length === 0) {
    throw new Error("Verwacht een JSON-object met fields");
  }

  const fields: Record<string, string> = {};
  for (const key of expectedKeys) {
    const value = bag[key];
    if (typeof value !== "string" || !value.trim()) {
      warnings.push(`Veld "${key}" ontbreekt in AI-output.`);
      continue;
    }
    const sanitized = sanitizePlainText(value, maxCharsPerField);
    if (!sanitized) {
      warnings.push(`Veld "${key}" was leeg na opschonen.`);
      continue;
    }
    fields[key] = sanitized;
  }

  if (Object.keys(fields).length === 0) {
    throw new Error("Geen vertaalbare velden in AI-output");
  }
  return { fields, warnings };
}

/**
 * Estimate completion budget for NL→EN batch JSON so Groq json_object
 * mode is less likely to truncate mid-object (json_validate_failed).
 */
export function estimateTranslateMaxTokens(fields: Record<string, string>): number {
  const keys = Object.keys(fields);
  const inputChars = Object.values(fields).reduce((sum, value) => sum + value.length, 0);
  // JSON overhead + keys + EN ≈ NL length; ~3 chars/token is a safe lower bound.
  // Extra headroom covers reasoning-model CoT (gpt-oss) so visible content is not empty.
  const estimatedChars = inputChars * 1.35 + keys.length * 48 + 180;
  const tokens = Math.ceil(estimatedChars / 3) + 1_024;
  return Math.min(8_192, Math.max(2_560, tokens));
}
