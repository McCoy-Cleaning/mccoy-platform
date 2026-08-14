/**
 * Collect NL copy paths and plan EN draft sync for Opslaan.
 * Nested paths use dotted segments with stable item ids when present
 * (e.g. `columns.col_1.title`, falling back to `columns.0.title`) compatible with
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
  "anchor",
  "updatedAt",
  "openInNewTab",
  "version",
  "dataVersion",
  "hidden",
  "reverse",
  "values",
  // Layout / presentation enums — translating these breaks storefront chrome
  // (e.g. productsAssortment → "Product Assortment" drops ProductsPresentation).
  "presentation",
  "contentMode",
  "textPlacement",
  "shape",
  "columns",
  "action",
  "size",
  "surfaceMode",
  "widthMode",
  "headerMode",
  "contentAlign",
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

export type TranslatablePathCollection = {
  /** Canonical dotted paths (stable item ids when present). */
  fields: Record<string, string>;
  /** Alternate path → canonical relative path (index / colon forms). */
  aliases: Record<string, string>;
};

function registerPathAliases(
  canonicalParts: string[],
  indexAliasParts: string[] | null,
  aliases: Record<string, string>,
): void {
  const canonical = canonicalParts.join(".");
  const colonForm = canonicalParts.join(":");
  if (colonForm !== canonical) aliases[colonForm] = canonical;
  if (indexAliasParts) {
    const indexForm = indexAliasParts.join(".");
    if (indexForm !== canonical) aliases[indexForm] = canonical;
    const indexColon = indexAliasParts.join(":");
    if (indexColon !== canonical) aliases[indexColon] = canonical;
  }
}

/**
 * Walk a JSON-like value and collect string leaves keyed by dotted path relative
 * to the walk root (e.g. `columns.col_1.title` when items have ids).
 * Also records index- and colon-form aliases for draft remapping.
 */
export function collectTranslatableStringPathsDetailed(
  value: unknown,
  baseParts: string[] = [],
  indexAliasParts: string[] | null = null,
  out: TranslatablePathCollection = { fields: {}, aliases: {} },
): TranslatablePathCollection {
  if (typeof value === "string") {
    if (baseParts.length === 0) return out;
    const named = lastNamedSegment(baseParts);
    if (!isTranslatableNlFieldKey(named)) return out;
    const key = baseParts.join(".");
    out.fields[key] = value;
    registerPathAliases(baseParts, indexAliasParts, out.aliases);
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      const indexSeg = String(index);
      // Prefer stable item ids over array indexes so reorders do not detach EN drafts.
      const stableId =
        item != null &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        typeof (item as Record<string, unknown>).id === "string" &&
        String((item as Record<string, unknown>).id).trim()
          ? String((item as Record<string, unknown>).id).trim()
          : indexSeg;
      const nextIndexAlias = [...(indexAliasParts ?? baseParts), indexSeg];
      collectTranslatableStringPathsDetailed(
        item,
        [...baseParts, stableId],
        stableId === indexSeg ? null : nextIndexAlias,
        out,
      );
    });
    return out;
  }

  if (!isPlainObject(value)) return out;

  if (looksLikeMediaObject(value)) {
    if (typeof value.alt === "string") {
      collectTranslatableStringPathsDetailed(
        value.alt,
        [...baseParts, "alt"],
        indexAliasParts ? [...indexAliasParts, "alt"] : null,
        out,
      );
    }
    if (typeof value.caption === "string") {
      collectTranslatableStringPathsDetailed(
        value.caption,
        [...baseParts, "caption"],
        indexAliasParts ? [...indexAliasParts, "caption"] : null,
        out,
      );
    }
    return out;
  }

  for (const [key, child] of Object.entries(value)) {
    if (key === "id" || key === "type" || key === "kind") continue;
    if (key === "link" && isPlainObject(child)) {
      if (typeof child.label === "string") {
        collectTranslatableStringPathsDetailed(
          child.label,
          [...baseParts, "link", "label"],
          indexAliasParts ? [...indexAliasParts, "link", "label"] : null,
          out,
        );
      }
      continue;
    }
    collectTranslatableStringPathsDetailed(
      child,
      [...baseParts, key],
      indexAliasParts ? [...indexAliasParts, key] : null,
      out,
    );
  }
  return out;
}

/**
 * Walk a JSON-like value and collect string leaves keyed by dotted path relative
 * to the walk root (e.g. `columns.col_1.title` when items have ids).
 */
export function collectTranslatableStringPaths(
  value: unknown,
  baseParts: string[] = [],
  out: Record<string, string> = {},
): Record<string, string> {
  const detailed = collectTranslatableStringPathsDetailed(value, baseParts);
  Object.assign(out, detailed.fields);
  return out;
}

function scopePath(scope: "section" | "block" | "page", id: string, relative: string): string {
  return enFieldDraftPath(scope, id, relative);
}

/** Full `enFieldDraftPath` → current NL string (may be empty), plus path aliases. */
export function collectPageNlFieldDraftCollection(page: CmsPage): {
  fields: Record<string, string>;
  /** Full draft path alias → canonical full path. */
  aliases: Record<string, string>;
} {
  const fields: Record<string, string> = {};
  const aliases: Record<string, string> = {};

  fields[enFieldDraftPath("page", "meta", "title")] = page.title ?? "";
  fields[enFieldDraftPath("page", "meta", "description")] = page.description ?? "";

  const absorb = (scope: "section" | "block", id: string, detailed: TranslatablePathCollection) => {
    for (const [rel, value] of Object.entries(detailed.fields)) {
      fields[scopePath(scope, id, rel)] = value;
    }
    for (const [aliasRel, canonicalRel] of Object.entries(detailed.aliases)) {
      aliases[scopePath(scope, id, aliasRel)] = scopePath(scope, id, canonicalRel);
    }
  };

  if (page.kind === "builtin" && page.sectionContent) {
    for (const [sectionKey, content] of Object.entries(page.sectionContent)) {
      if (content == null) continue;
      absorb("section", sectionKey, collectTranslatableStringPathsDetailed(content));
    }
  }

  for (const block of page.blocks ?? []) {
    absorb("block", block.id, collectTranslatableStringPathsDetailed(block.data ?? {}));
  }

  return { fields, aliases };
}

/** Full `enFieldDraftPath` → current NL string (may be empty). */
export function collectPageNlFieldDraftMap(page: CmsPage): Record<string, string> {
  return collectPageNlFieldDraftCollection(page).fields;
}

/**
 * Remap legacy index / colon draft keys onto canonical stable-id dotted paths.
 * Does not invent translations — only moves existing values onto discovery keys.
 */
export function remapEnFieldDraftsToCanonicalPaths(page: CmsPage): {
  enFieldDrafts: Record<string, string>;
  enFieldDraftSources: Record<string, string>;
  enFieldDraftMeta?: NonNullable<CmsPage["enFieldDraftMeta"]>;
  remapped: number;
} {
  const { fields, aliases } = collectPageNlFieldDraftCollection(page);
  const live = new Set(Object.keys(fields));
  const draftsIn = page.enFieldDrafts ?? {};
  const sourcesIn = page.enFieldDraftSources ?? {};
  const metaIn = page.enFieldDraftMeta ?? {};

  const enFieldDrafts: Record<string, string> = {};
  const enFieldDraftSources: Record<string, string> = {};
  const enFieldDraftMeta: NonNullable<CmsPage["enFieldDraftMeta"]> = {};
  let remapped = 0;

  const resolveCanonical = (path: string): string | null => {
    if (live.has(path)) return path;
    const viaAlias = aliases[path];
    if (viaAlias && live.has(viaAlias)) return viaAlias;
    return null;
  };

  for (const [path, value] of Object.entries(draftsIn)) {
    const canonical = resolveCanonical(path);
    if (!canonical) continue;
    // Never resurrect EN text for fields the editor cleared / blanked.
    const clearedStatus = metaIn[canonical]?.status ?? metaIn[path]?.status;
    if (clearedStatus === "override_removed" || clearedStatus === "intentional_blank") {
      if (path !== canonical) remapped += 1;
      continue;
    }
    if (path !== canonical) remapped += 1;
    // Prefer value already on the canonical key when both exist.
    if (enFieldDrafts[canonical] == null || path === canonical) {
      enFieldDrafts[canonical] = value;
    }
  }

  for (const [path, value] of Object.entries(sourcesIn)) {
    const canonical = resolveCanonical(path);
    if (!canonical) continue;
    if (enFieldDraftSources[canonical] == null || path === canonical) {
      enFieldDraftSources[canonical] = value;
    }
  }

  for (const [path, value] of Object.entries(metaIn)) {
    const canonical = resolveCanonical(path);
    if (!canonical) continue;
    if (enFieldDraftMeta[canonical] == null || path === canonical) {
      enFieldDraftMeta[canonical] = value;
    }
  }

  return {
    enFieldDrafts,
    enFieldDraftSources,
    enFieldDraftMeta: Object.keys(enFieldDraftMeta).length > 0 ? enFieldDraftMeta : undefined,
    remapped,
  };
}

/** Resolve a draft path (index/colon/alias) onto the canonical discovery path when known. */
export function canonicalizeEnFieldDraftPath(page: CmsPage, path: string): string {
  const { fields, aliases } = collectPageNlFieldDraftCollection(page);
  if (Object.prototype.hasOwnProperty.call(fields, path)) return path;
  const viaAlias = aliases[path];
  if (viaAlias) return viaAlias;
  return path;
}

/** Read an EN draft, resolving index/colon aliases onto stable-id keys. */
export function lookupEnFieldDraft(page: CmsPage, path: string): string {
  const drafts = page.enFieldDrafts ?? {};
  const meta = page.enFieldDraftMeta ?? {};
  const { aliases } = collectPageNlFieldDraftCollection(page);
  const canonical = canonicalizeEnFieldDraftPath(page, path);
  // Collect every alias of this field (index ↔ stable-id ↔ colon).
  const related = new Set<string>([path, canonical]);
  for (const [alias, canon] of Object.entries(aliases)) {
    if (canon === canonical || alias === canonical || canon === path || alias === path) {
      related.add(alias);
      related.add(canon);
    }
  }
  // Cleared / intentional blank on ANY related key wins over ghost drafts.
  for (const key of related) {
    const status = meta[key]?.status;
    if (status === "override_removed" || status === "intentional_blank") {
      return "";
    }
  }
  const exact = drafts[canonical] ?? drafts[path];
  if (exact != null && exact !== "") return exact;
  for (const key of related) {
    const via = drafts[key];
    if (via != null && via !== "") return via;
  }
  return exact ?? "";
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
 * True when current NL differs from the last saved/published baseline for this path.
 * New paths (absent or empty in baseline) count as changed.
 */
export function isNlFieldChangedSinceBaseline(
  path: string,
  currentNl: string,
  baselineNlFields?: Record<string, string>,
): boolean {
  if (baselineNlFields == null) return true;
  const baseline = baselineNlFields[path]?.trim() ?? "";
  return baseline !== currentNl.trim();
}

/** EN draft is missing or still identical to Dutch (not a real translation). */
export function isMissingOrUntranslatedEn(nl: string, en: string | undefined): boolean {
  const enTrim = en?.trim() ?? "";
  if (!enTrim) return true;
  return enTrim === nl.trim();
}

/**
 * Per-field EN overlay validity for Opslaan / translate-missing.
 *
 * Lightweight rules only (no ML): emptiness, whitespace, EN===NL (`source_echo`),
 * and meta. Distinct non-empty EN that differs from NL is treated as `valid_en`
 * even if the text is still Dutch — that limitation is intentional.
 */
export type EnOverlayValidity =
  | "missing"
  | "blank"
  | "override_removed"
  | "source_echo"
  | "intentional_blank"
  | "manually_translated"
  | "valid_en";

export function classifyEnOverlayValidity(input: {
  nl: string;
  en?: string;
  status?: string;
}): EnOverlayValidity {
  const nl = input.nl.trim();
  const enTrim = input.en?.trim() ?? "";
  const status = input.status;

  // Editor-owned slots — never auto-fill, even when blank or NL-echo.
  if (status === "intentional_blank") return "intentional_blank";
  if (status === "manually_translated") return "manually_translated";

  // Empty / NL-echo with cleared-override meta → needs EN (stuck pages included).
  if (status === "override_removed" && (!enTrim || enTrim === nl)) {
    return "override_removed";
  }

  if (!enTrim) {
    return input.en === undefined ? "missing" : "blank";
  }
  if (enTrim === nl) return "source_echo";
  return "valid_en";
}

/** True when Opslaan / translate-missing should queue an empty EN value for NL→EN. */
export function enOverlayNeedsTranslation(validity: EnOverlayValidity): boolean {
  return validity === "missing" || validity === "blank" || validity === "override_removed";
}

/**
 * Plan EN draft updates from current NL fields.
 * - Deleted / empty NL → drop EN draft
 * - Any non-empty existing EN → keep without sending it to the provider
 * - intentional_blank → never auto-fill
 * - empty/echo `override_removed` → queue (repairs stuck clears; Opslaan refills)
 * - NL present with empty/missing EN → queue for NL→EN
 */
export function planEnFieldDraftSync(input: {
  nlFields: Record<string, string>;
  existingDrafts?: Record<string, string>;
  existingSources?: Record<string, string>;
  /** Per-path meta — intentional_blank / manually_translated skip; empty override_removed queues. */
  existingMeta?: Record<string, { status?: string } | undefined>;
  /** @deprecated Kept for call-site compat. */
  baselineNlFields?: Record<string, string>;
  /** @deprecated Kept for call-site compat. */
  baselineEnDrafts?: Record<string, string>;
}): EnFieldDraftSyncPlan {
  const existingDrafts = input.existingDrafts ?? {};
  const existingSources = input.existingSources ?? {};
  const existingMeta = input.existingMeta ?? {};
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
    const status = existingMeta[path]?.status;
    const hasDraftKey = Object.prototype.hasOwnProperty.call(existingDrafts, path);
    const prevEn = existingDrafts[path];
    const enTrim = prevEn?.trim() ?? "";
    // EN content is immutable to automatic translation, even when it happens to
    // equal the Dutch source. Only empty/null/undefined/whitespace is eligible.
    if (enTrim) {
      retainedDrafts[path] = enTrim;
      retainedSources[path] = existingSources[path] ?? nl;
      continue;
    }
    const validity = classifyEnOverlayValidity({
      nl,
      en: hasDraftKey ? prevEn : undefined,
      status,
    });

    if (validity === "intentional_blank") {
      continue;
    }
    if (validity === "valid_en" || validity === "manually_translated") {
      if (enTrim) {
        retainedDrafts[path] = enTrim;
        retainedSources[path] = existingSources[path] ?? nl;
      }
      continue;
    }
    // missing | blank | override_removed → Opslaan background auto-fill.
    if (enOverlayNeedsTranslation(validity)) {
      toTranslate[path] = nl;
    }
  }

  return { retainedDrafts, retainedSources, toTranslate, prunedPaths };
}

/** Drop blank values so empty chunks never hit the AI provider. */
export function filterNonEmptyTranslateFields(
  fields: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    const trimmed = value.trim();
    if (trimmed) out[key] = trimmed;
  }
  return out;
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
    // Reject no-op "translations" that leave Dutch in the EN slot.
    if (!en || isMissingOrUntranslatedEn(nl, en)) continue;
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

/**
 * Chunk by item count AND total character budget so translate completions
 * stay within provider token limits (avoids truncated JSON).
 */
export function chunkRecordByBudget(
  record: Record<string, string>,
  options: { maxItems?: number; maxChars?: number } = {},
): Array<Record<string, string>> {
  const maxItems = options.maxItems ?? 8;
  const maxChars = options.maxChars ?? 3_500;
  const entries = Object.entries(record);
  if (entries.length === 0) return [];
  const chunks: Array<Record<string, string>> = [];
  let current: Array<[string, string]> = [];
  let chars = 0;
  for (const [key, value] of entries) {
    const nextChars = chars + value.length + key.length;
    if (current.length > 0 && (current.length >= maxItems || nextChars > maxChars)) {
      chunks.push(Object.fromEntries(current));
      current = [];
      chars = 0;
    }
    current.push([key, value]);
    chars += value.length + key.length;
  }
  if (current.length > 0) chunks.push(Object.fromEntries(current));
  return chunks;
}
