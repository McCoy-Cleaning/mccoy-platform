/**
 * Collect NL copy paths and plan EN draft sync for Opslaan.
 * Nested paths use dotted segments (e.g. `columns.0.title`) compatible with
 * {@link applyEnFieldDraftsToPage} / {@link setValueAtDotPath}.
 */

import { enFieldDraftPath } from "./en-field-drafts";
import type { CmsPage } from "./types";

const NON_TRANSLATABLE_FIELD_KEYS = new Set([
  "id",
  "type",
  "kind",
  "src",
  "href",
  "url",
  "videoUrl",
  "poster",
  "before",
  "after",
  "image",
  "missionImage",
  "visionImage",
  "historyImage",
  "avatar",
  "logo",
  "icon",
  "path",
  "slug",
  "align",
  "layout",
  "variant",
  "email",
  "phone",
  "route",
  "pageId",
  "openInNewTab",
  "version",
  "dataVersion",
  "hidden",
  "reverse",
  "values",
]);

export function isTranslatableNlFieldKey(key: string): boolean {
  if (NON_TRANSLATABLE_FIELD_KEYS.has(key)) return false;
  const lower = key.toLowerCase();
  if (lower.includes("image") || lower.includes("poster") || lower.endsWith("url")) return false;
  if (lower.endsWith("href") || lower.endsWith("src") || lower.endsWith("path")) return false;
  return true;
}

function lastNamedSegment(parts: string[]): string {
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]!;
    if (!/^\d+$/.test(part)) return part;
  }
  return parts[parts.length - 1] ?? "";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function looksLikeMediaObject(value: Record<string, unknown>): boolean {
  return typeof value.src === "string" || typeof value.poster === "string";
}

/**
 * Walk a JSON-like value and collect string leaves keyed by dotted path relative
 * to the walk root (e.g. `columns.0.title`).
 */
export function collectTranslatableStringPaths(
  value: unknown,
  baseParts: string[] = [],
  out: Record<string, string> = {},
): Record<string, string> {
  if (typeof value === "string") {
    if (baseParts.length === 0) return out;
    const named = lastNamedSegment(baseParts);
    if (!isTranslatableNlFieldKey(named)) return out;
    out[baseParts.join(".")] = value;
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectTranslatableStringPaths(item, [...baseParts, String(index)], out);
    });
    return out;
  }

  if (!isPlainObject(value)) return out;

  if (looksLikeMediaObject(value)) {
    if (typeof value.alt === "string") {
      collectTranslatableStringPaths(value.alt, [...baseParts, "alt"], out);
    }
    if (typeof value.caption === "string") {
      collectTranslatableStringPaths(value.caption, [...baseParts, "caption"], out);
    }
    return out;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === "id" || key === "type" || key === "kind") continue;
    if (key === "link" && isPlainObject(child)) {
      if (typeof child.label === "string") {
        collectTranslatableStringPaths(child.label, [...baseParts, "link", "label"], out);
      }
      continue;
    }
    collectTranslatableStringPaths(child, [...baseParts, key], out);
  }
  return out;
}

/** Full `enFieldDraftPath` → current NL string (may be empty). */
export function collectPageNlFieldDraftMap(page: CmsPage): Record<string, string> {
  const out: Record<string, string> = {};

  out[enFieldDraftPath("page", "meta", "title")] = page.title ?? "";
  out[enFieldDraftPath("page", "meta", "description")] = page.description ?? "";

  if (page.kind === "builtin" && page.sectionContent) {
    for (const [sectionKey, content] of Object.entries(page.sectionContent)) {
      if (content == null) continue;
      const relative = collectTranslatableStringPaths(content);
      for (const [rel, value] of Object.entries(relative)) {
        out[enFieldDraftPath("section", sectionKey, rel)] = value;
      }
    }
  }

  for (const block of page.blocks ?? []) {
    const relative = collectTranslatableStringPaths(block.data ?? {});
    for (const [rel, value] of Object.entries(relative)) {
      out[enFieldDraftPath("block", block.id, rel)] = value;
    }
  }

  return out;
}

export type EnFieldDraftSyncPlan = {
  /** Drafts kept as-is (NL source unchanged). */
  retainedDrafts: Record<string, string>;
  retainedSources: Record<string, string>;
  /** NL strings that need a (re)translation. */
  toTranslate: Record<string, string>;
  /** Paths removed because NL text was deleted or the field no longer exists. */
  prunedPaths: string[];
};

/**
 * Plan EN draft updates from current NL fields.
 * - Deleted / empty NL → drop EN draft
 * - Existing non-empty EN (manual or prior AI) → keep; never send to Groq
 * - NL present with no EN → queue for translation
 */
export function planEnFieldDraftSync(input: {
  nlFields: Record<string, string>;
  existingDrafts?: Record<string, string>;
  existingSources?: Record<string, string>;
}): EnFieldDraftSyncPlan {
  const existingDrafts = input.existingDrafts ?? {};
  const existingSources = input.existingSources ?? {};
  const retainedDrafts: Record<string, string> = {};
  const retainedSources: Record<string, string> = {};
  const toTranslate: Record<string, string> = {};
  const livePaths = new Set(Object.keys(input.nlFields));

  const prunedPaths: string[] = [];
  for (const path of Object.keys(existingDrafts)) {
    if (!livePaths.has(path)) prunedPaths.push(path);
  }

  for (const [path, nlRaw] of Object.entries(input.nlFields)) {
    const nl = nlRaw.trim();
    if (!nl) {
      if (existingDrafts[path]) prunedPaths.push(path);
      continue;
    }
    const prevEn = existingDrafts[path]?.trim() ?? "";
    // Hand-written or previously saved EN always wins — Groq must not overwrite it.
    if (prevEn) {
      retainedDrafts[path] = prevEn;
      retainedSources[path] = existingSources[path] ?? nl;
      continue;
    }
    toTranslate[path] = nl;
  }

  return { retainedDrafts, retainedSources, toTranslate, prunedPaths };
}

export function applyTranslatedEnFields(input: {
  retainedDrafts: Record<string, string>;
  retainedSources: Record<string, string>;
  toTranslate: Record<string, string>;
  translated: Record<string, string>;
}): { enFieldDrafts: Record<string, string>; enFieldDraftSources: Record<string, string> } {
  const enFieldDrafts = { ...input.retainedDrafts };
  const enFieldDraftSources = { ...input.retainedSources };
  for (const [path, nl] of Object.entries(input.toTranslate)) {
    const en = input.translated[path]?.trim();
    if (!en) continue;
    enFieldDrafts[path] = en;
    enFieldDraftSources[path] = nl;
  }
  return { enFieldDrafts, enFieldDraftSources };
}

/** Split a fields map into chunks for the translate API. */
export function chunkRecord<T>(record: Record<string, T>, size: number): Array<Record<string, T>> {
  const entries = Object.entries(record);
  if (entries.length === 0) return [];
  const chunks: Array<Record<string, T>> = [];
  for (let i = 0; i < entries.length; i += size) {
    chunks.push(Object.fromEntries(entries.slice(i, i + size)));
  }
  return chunks;
}
