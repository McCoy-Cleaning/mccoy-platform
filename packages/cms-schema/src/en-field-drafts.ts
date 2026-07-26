/**
 * Phase E — English draft strings keyed by {@link enFieldDraftPath}.
 *
 * AI / editor never auto-publishes. Once a page is saved/published, drafts travel
 * with the payload and MUST be applied when serving the `en` locale (see
 * {@link localizeCmsPageForLocale}). Until then they are editor-only concepts.
 */

import type { Locale } from "./locale";
import type { PageSectionContent } from "./content";
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
 * Set a dotted path on a plain object tree (`primaryCta.label`, `cards.0.title`).
 * Creates missing object parents; grows arrays when a numeric segment appears.
 */
export function setValueAtDotPath(
  root: Record<string, unknown>,
  fieldPath: string,
  value: string,
): void {
  const segments = fieldPath.split(".").filter(Boolean);
  if (segments.length === 0) return;

  let cursor: unknown = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const key = segments[i]!;
    const nextKey = segments[i + 1]!;
    const asIndex = Number.parseInt(key, 10);
    const keyIsIndex = String(asIndex) === key;

    if (keyIsIndex) {
      if (!Array.isArray(cursor)) return;
      const arr = cursor as unknown[];
      while (arr.length <= asIndex) arr.push({});
      if (arr[asIndex] == null || typeof arr[asIndex] !== "object") {
        arr[asIndex] = Number.isInteger(Number(nextKey)) ? [] : {};
      }
      cursor = arr[asIndex];
      continue;
    }

    if (cursor == null || typeof cursor !== "object" || Array.isArray(cursor)) return;
    const obj = cursor as Record<string, unknown>;
    const existing = obj[key];
    if (existing == null || typeof existing !== "object") {
      obj[key] = Number.isInteger(Number(nextKey)) ? [] : {};
    }
    cursor = obj[key];
  }

  const leaf = segments[segments.length - 1]!;
  const leafIndex = Number.parseInt(leaf, 10);
  if (String(leafIndex) === leaf && Array.isArray(cursor)) {
    const arr = cursor as unknown[];
    while (arr.length <= leafIndex) arr.push("");
    arr[leafIndex] = value;
    return;
  }
  if (cursor == null || typeof cursor !== "object" || Array.isArray(cursor)) return;
  (cursor as Record<string, unknown>)[leaf] = value;
}

function applyDraftToSectionContent(
  sectionContent: PageSectionContent,
  sectionKey: string,
  field: string,
  value: string,
): void {
  const bag = sectionContent as Record<string, unknown>;
  const existing = bag[sectionKey];
  const section =
    existing != null && typeof existing === "object" && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  if (existing !== section) bag[sectionKey] = section;
  setValueAtDotPath(section, field, value);
}

function applyDraftToBlocks(blocks: Block[], blockId: string, field: string, value: string): void {
  const block = blocks.find((b) => b.id === blockId);
  if (!block) return;
  const data =
    block.data != null && typeof block.data === "object" && !Array.isArray(block.data)
      ? ({ ...block.data } as Record<string, unknown>)
      : {};
  setValueAtDotPath(data, field, value);
  block.data = data;
}

/**
 * Overlay `enFieldDrafts` onto NL `sectionContent` / `blocks` (and page meta when needed).
 * Missing drafts keep the Dutch base value (explicit partial-translation fallback).
 */
export function applyEnFieldDraftsToPage(page: CmsPage): CmsPage {
  const drafts = page.enFieldDrafts;
  if (!drafts || Object.keys(drafts).length === 0) return page;

  const next = structuredClone(page);

  for (const [path, raw] of Object.entries(drafts)) {
    const value = raw.trim();
    if (!value) continue;
    const parsed = parseEnFieldDraftPath(path);
    if (!parsed) continue;

    if (parsed.scope === "section" && next.kind === "builtin") {
      next.sectionContent = { ...(next.sectionContent ?? {}) };
      applyDraftToSectionContent(next.sectionContent, parsed.id, parsed.field, value);
      continue;
    }

    if (parsed.scope === "block") {
      applyDraftToBlocks(next.blocks, parsed.id, parsed.field, value);
      continue;
    }

    if (parsed.scope === "page" && parsed.id === "meta") {
      const en = next.localeContent?.en ?? {
        navigationLabel: next.title,
        pageTitle: next.title,
        seo: { title: next.title, description: next.description },
      };
      if (parsed.field === "title") {
        en.pageTitle = value;
        en.navigationLabel = value;
        en.seo = { ...en.seo, title: value };
      } else if (parsed.field === "description") {
        en.seo = { ...en.seo, description: value };
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
 * Resolve page body for a public/preview locale.
 * - `nl`: Dutch `sectionContent` / block data unchanged.
 * - `en`: Dutch base + `enFieldDrafts` overlays (never invents copy at render time).
 */
export function localizeCmsPageForLocale(page: CmsPage, locale: Locale): CmsPage {
  if (locale !== "en") return page;
  return applyEnFieldDraftsToPage(page);
}
