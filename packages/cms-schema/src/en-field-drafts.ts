/**
 * Phase E — English draft strings keyed by {@link enFieldDraftPath}.
 *
 * AI / editor never auto-publishes. Once a page is saved/published, drafts travel
 * with the payload and MUST be applied when serving the `en` locale (see
 * {@link localizeCmsPageForLocale}). Until then they are editor-only concepts.
 */

import type { Locale } from "./locale";
import type { PageSectionContent } from "./content";
import {
  shouldSyncParagraphStructure,
  syncParagraphStructure,
} from "./paragraph-structure";
import {
  createTranslationSourceHash,
  resolveLocalizedField,
} from "./translation-field";
import type { Block, CmsPage } from "./types";

export function enFieldDraftPath(
  scope: "section" | "block" | "page",
  id: string,
  field: string,
): string {
  return `${scope}:${id}:${field}`;
}

export function parseEnFieldDraftPath(
  path: string,
): { scope: "section" | "block" | "page"; id: string; field: string } | null {
  const parts = path.split(":");
  if (parts.length < 3) return null;
  const [scope, id, ...fieldParts] = parts;
  if (scope !== "section" && scope !== "block" && scope !== "page") return null;
  if (!id || fieldParts.length === 0) return null;
  return { scope, id, field: fieldParts.join(":") };
}

/** Structural / enum leaves that must never overlay NL (legacy bad EN drafts). */
const NON_COPY_EN_DRAFT_LEAF_KEYS = new Set([
  "presentation",
  "contentMode",
  "textPlacement",
  "shape",
  "columns",
  "action",
  "layout",
  "align",
  "variant",
  "size",
  "hidden",
  "reverse",
  "id",
  "type",
  "kind",
  "src",
  "href",
  "url",
  "route",
  "pageId",
  "openInNewTab",
  "icon",
  "email",
  "phone",
]);

function isCopyEnDraftField(field: string): boolean {
  const segments = field.includes(".")
    ? field.split(".").filter(Boolean)
    : field.split(":").filter(Boolean);
  const leaf = segments[segments.length - 1] ?? "";
  if (!leaf || NON_COPY_EN_DRAFT_LEAF_KEYS.has(leaf)) return false;
  const lower = leaf.toLowerCase();
  if (lower.endsWith("url") || lower.endsWith("href") || lower.endsWith("src")) return false;
  return true;
}

/** Merge EN drafts; empty string removes a key. */
export function mergeEnFieldDrafts(
  current: Record<string, string> | undefined,
  patch: Record<string, string>,
): Record<string, string> {
  const next = { ...(current ?? {}) };
  for (const [key, value] of Object.entries(patch)) {
    const trimmed = value.trim();
    if (!trimmed) delete next[key];
    else next[key] = trimmed;
  }
  return next;
}

/**
 * Set a dotted (or colon-separated id) path on a plain object tree.
 * Supports:
 * - `primaryCta.label` (objects)
 * - `features.0.title` (array indexes)
 * - `features:prod_hygiene:title` / `features.prod_hygiene.title` (array item by id)
 * Creates missing object parents; grows arrays when a numeric segment appears.
 */
export function setValueAtDotPath(
  root: Record<string, unknown>,
  fieldPath: string,
  value: string,
): boolean {
  const segments =
    fieldPath.includes(":") && !fieldPath.includes(".")
      ? fieldPath.split(":").filter(Boolean)
      : fieldPath.split(".").filter(Boolean);
  if (segments.length === 0) return false;

  let cursor: unknown = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]!;
    const nextKey = segments[i + 1]!;
    const asIndex = Number.parseInt(key, 10);
    const keyIsIndex = String(asIndex) === key;

    if (Array.isArray(cursor)) {
      const arr = cursor as unknown[];
      let index = keyIsIndex ? asIndex : -1;
      if (index < 0) {
        index = arr.findIndex(
          (item) =>
            item != null &&
            typeof item === "object" &&
            !Array.isArray(item) &&
            (item as Record<string, unknown>).id === key,
        );
      }
      if (index < 0) return false;
      while (arr.length <= index) arr.push({});
      if (arr[index] == null || typeof arr[index] !== "object") {
        arr[index] = Number.isInteger(Number(nextKey)) ? [] : {};
      }
      cursor = arr[index];
      continue;
    }

    if (cursor == null || typeof cursor !== "object") return false;
    const obj = cursor as Record<string, unknown>;
    const existing = obj[key];
    if (existing == null || typeof existing !== "object") {
      obj[key] = Number.isInteger(Number(nextKey)) ? [] : {};
    }
    cursor = obj[key];
  }

  const leaf = segments[segments.length - 1]!;
  const leafIndex = Number.parseInt(leaf, 10);
  if (Array.isArray(cursor)) {
    const arr = cursor as unknown[];
    if (String(leafIndex) === leaf) {
      while (arr.length <= leafIndex) arr.push("");
      arr[leafIndex] = value;
      return true;
    }
    const byId = arr.findIndex(
      (item) =>
        item != null &&
        typeof item === "object" &&
        !Array.isArray(item) &&
        (item as Record<string, unknown>).id === leaf,
    );
    if (byId < 0) return false;
    arr[byId] = value;
    return true;
  }
  if (cursor == null || typeof cursor !== "object") return false;
  (cursor as Record<string, unknown>)[leaf] = value;
  return true;
}

/** Read a dotted path previously written by {@link setValueAtDotPath}. */
export function getValueAtDotPath(root: Record<string, unknown>, fieldPath: string): unknown {
  const segments =
    fieldPath.includes(":") && !fieldPath.includes(".")
      ? fieldPath.split(":").filter(Boolean)
      : fieldPath.split(".").filter(Boolean);
  let cursor: unknown = root;
  for (const key of segments) {
    if (cursor == null || typeof cursor !== "object") return undefined;
    if (Array.isArray(cursor)) {
      const asIndex = Number.parseInt(key, 10);
      if (String(asIndex) === key) {
        cursor = cursor[asIndex];
        continue;
      }
      cursor = cursor.find(
        (item) =>
          item != null &&
          typeof item === "object" &&
          !Array.isArray(item) &&
          (item as Record<string, unknown>).id === key,
      );
      continue;
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function withSyncedParagraphStructure(nlValue: unknown, enValue: string): string {
  if (typeof nlValue !== "string" || !shouldSyncParagraphStructure(nlValue, enValue)) {
    return enValue;
  }
  return syncParagraphStructure(nlValue, enValue);
}

function applyDraftToSectionContent(
  sectionContent: PageSectionContent,
  sectionKey: string,
  field: string,
  value: string,
): boolean {
  const bag = sectionContent as Record<string, unknown>;
  const existing = bag[sectionKey];
  const section =
    existing != null && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  if (existing !== section) bag[sectionKey] = section;
  const nlValue = getValueAtDotPath(section, field);
  return setValueAtDotPath(section, field, withSyncedParagraphStructure(nlValue, value));
}

function applyDraftToBlocks(
  blocks: Block[],
  blockId: string,
  field: string,
  value: string,
): boolean {
  const block = blocks.find((b) => b.id === blockId);
  if (!block) return false;
  const data =
    block.data != null && typeof block.data === "object" && !Array.isArray(block.data)
      ? ({ ...block.data } as Record<string, unknown>)
      : {};
  const nlValue = getValueAtDotPath(data, field);
  const ok = setValueAtDotPath(data, field, withSyncedParagraphStructure(nlValue, value));
  if (!ok) return false;
  block.data = data;
  return true;
}

function readSourceValueAtDraftPath(page: CmsPage, path: string): unknown {
  const parsed = parseEnFieldDraftPath(path);
  if (!parsed) return undefined;
  if (parsed.scope === "section" && page.kind === "builtin") {
    const bag = (page.sectionContent ?? {}) as Record<string, unknown>;
    const section = bag[parsed.id];
    if (section == null || typeof section !== "object" || Array.isArray(section)) {
      return undefined;
    }
    return getValueAtDotPath(section as Record<string, unknown>, parsed.field);
  }
  if (parsed.scope === "block") {
    const block = page.blocks.find((b) => b.id === parsed.id);
    if (!block?.data || typeof block.data !== "object" || Array.isArray(block.data)) {
      return undefined;
    }
    return getValueAtDotPath(block.data as Record<string, unknown>, parsed.field);
  }
  if (parsed.scope === "page" && parsed.id === "meta") {
    if (parsed.field === "title") return page.title;
    if (parsed.field === "description") return page.description;
  }
  return undefined;
}

/**
 * Overlay `enFieldDrafts` onto NL `sectionContent` / `blocks` (and page meta when needed).
 * Missing / blank drafts keep the Dutch base value unless marked intentional_blank.
 * Never invents copy at render time. Uses {@link resolveLocalizedField} as the contract.
 */
export function applyEnFieldDraftsToPage(page: CmsPage): CmsPage {
  const drafts = page.enFieldDrafts;
  const meta = page.enFieldDraftMeta ?? {};
  const sources = page.enFieldDraftSources ?? {};
  const hasDrafts = drafts && Object.keys(drafts).length > 0;
  const intentionalBlankPaths = Object.entries(meta)
    .filter(([, m]) => m.status === "intentional_blank")
    .map(([path]) => path);
  if (!hasDrafts && intentionalBlankPaths.length === 0) return page;

  const next = structuredClone(page);
  const paths = new Set([
    ...Object.keys(drafts ?? {}),
    ...intentionalBlankPaths,
  ]);

  for (const path of paths) {
    const parsed = parseEnFieldDraftPath(path);
    if (!parsed) continue;
    // Ignore legacy enum drafts (e.g. presentation → "Product Assortment").
    if (!isCopyEnDraftField(parsed.field)) continue;

    const sourceValue = readSourceValueAtDraftPath(page, path);
    const sourceText =
      typeof sourceValue === "string" ? sourceValue : sourceValue == null ? "" : String(sourceValue);
    const sourceHash = createTranslationSourceHash(sourceText);
    const sourceBaseline = sources[path];
    const translatedSourceHash = sourceBaseline
      ? createTranslationSourceHash(sourceBaseline)
      : meta[path]?.sourceHash;

    const resolved = resolveLocalizedField({
      sourceValue,
      translatedValue: Object.prototype.hasOwnProperty.call(drafts ?? {}, path)
        ? drafts?.[path]
        : undefined,
      metadata: meta[path],
      sourceHash,
      translatedSourceHash,
      fallbackToSource: true,
    });

    // Blank / missing without intentional_blank → keep NL (do not write).
    if (resolved.usedFallback) continue;
    const applied =
      resolved.state === "intentional_blank"
        ? ""
        : typeof resolved.value === "string"
          ? resolved.value
          : String(resolved.value ?? "");

    if (parsed.scope === "section" && next.kind === "builtin") {
      next.sectionContent = { ...(next.sectionContent ?? {}) };
      applyDraftToSectionContent(next.sectionContent, parsed.id, parsed.field, applied);
      continue;
    }

    if (parsed.scope === "block") {
      applyDraftToBlocks(next.blocks, parsed.id, parsed.field, applied);
      continue;
    }

    if (parsed.scope === "page" && parsed.id === "meta") {
      const en = next.localeContent?.en ?? {
        navigationLabel: next.title,
        pageTitle: next.title,
        seo: { title: next.title, description: next.description },
      };
      if (parsed.field === "title") {
        en.pageTitle = applied;
        en.navigationLabel = applied;
        en.seo = { ...en.seo, title: applied };
      } else if (parsed.field === "description") {
        en.seo = { ...en.seo, description: applied };
      }
      next.localeContent = {
        ...(next.localeContent ?? {
          nl: {
            navigationLabel: next.title,
            pageTitle: next.title,
            seo: { title: next.title, description: next.description },
          },
        }),
        en,
      };
    }
  }

  return next;
}

/**
 * Ensure `localeContent.en` exists for publish/resolve gates.
 * Prefers page meta EN drafts, then any existing EN SEO bag, then NL title/description.
 */
export function ensureEnglishLocaleContentFromDrafts(page: CmsPage): CmsPage {
  const drafts = page.enFieldDrafts ?? {};
  const prevEn = page.localeContent?.en;
  const enTitle =
    drafts["page:meta:title"]?.trim() ||
    prevEn?.pageTitle?.trim() ||
    prevEn?.seo.title?.trim() ||
    page.title;
  const enDesc =
    drafts["page:meta:description"]?.trim() ||
    prevEn?.seo.description?.trim() ||
    page.description;
  const nlBag = page.localeContent?.nl ?? {
    navigationLabel: page.title,
    pageTitle: page.title,
    seo: { title: page.title, description: page.description },
  };
  return {
    ...page,
    localeContent: {
      ...(page.localeContent ?? { nl: nlBag }),
      nl: nlBag,
      en: {
        navigationLabel: prevEn?.navigationLabel?.trim() || enTitle,
        pageTitle: prevEn?.pageTitle?.trim() || enTitle,
        seo: {
          title: prevEn?.seo.title?.trim() || enTitle,
          description: prevEn?.seo.description?.trim() || enDesc,
        },
      },
    },
  };
}

/**
 * Resolve page body for a public/preview locale.
 * - `nl`: Dutch `sectionContent` / block data unchanged.
 * - `en`: Dutch base + `enFieldDrafts` overlays (never invents copy at render time).
 */
export function localizeCmsPageForLocale(page: CmsPage, locale: Locale): CmsPage {
  if (locale !== "en") return page;
  return applyEnFieldDraftsToPage(page);
}
