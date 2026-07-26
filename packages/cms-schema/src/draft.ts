import type { CmsPage, PageDraft, PageOverrides, PreviewSnapshot } from "./types";
import { isDraftDirty as draftHasChanges } from "./draft-helpers";
import { normalizeCmsPage } from "./pipeline";

export function effectiveOverrides(saved: PageOverrides | undefined, draft: PageDraft | undefined): PageOverrides {
  return { ...(saved ?? {}), ...(draft?.overrides ?? {}) };
}

export function applyDraftToPage(page: CmsPage, draft: PageDraft | undefined): CmsPage {
  if (!draft) return normalizeCmsPage(structuredClone(page));

  // Full page draft (layout / blocks / sectionContent) takes precedence.
  // Do not re-merge draft.sectionContent on top — that field is only for the
  // page-absent path and would otherwise snap Secties edits back to a stale map.
  if (draft.page) {
    const next = structuredClone(draft.page);
    if (draft.title !== undefined) next.title = draft.title;
    if (draft.slug !== undefined) next.slug = draft.slug;
    if (draft.description !== undefined) next.description = draft.description;
    if (draft.inNav !== undefined) next.inNav = draft.inNav;
    // Always re-normalize so empty/corrupt draft layouts regain fixed sections.
    return normalizeCmsPage(syncLocaleMirrorsFromLegacy(next));
  }

  const next = structuredClone(page);
  if (draft.title !== undefined) next.title = draft.title;
  if (draft.slug !== undefined) next.slug = draft.slug;
  if (draft.description !== undefined) next.description = draft.description;
  if (draft.inNav !== undefined) next.inNav = draft.inNav;
  if (draft.sectionContent && next.kind === "builtin") {
    next.sectionContent = { ...next.sectionContent, ...structuredClone(draft.sectionContent) };
  }
  if (page.isCustom && draft.blocks) {
    next.blocks = structuredClone(draft.blocks);
    if (next.kind === "custom") {
      next.layout = next.blocks.map((b) => ({
        id: `lay_${b.id}`,
        kind: "block" as const,
        blockId: b.id,
      }));
    }
  }
  // Legacy extraBlocks draft → merge into layout end for builtins
  if (draft.extraBlocks && next.kind === "builtin") {
    const extras = structuredClone(draft.extraBlocks);
    const seen = new Set(next.blocks.map((b) => b.id));
    for (const b of extras) {
      if (!seen.has(b.id)) {
        next.blocks.push(b);
        next.layout.push({ id: `lay_${b.id}`, kind: "block", blockId: b.id });
        seen.add(b.id);
      }
    }
  }
  return normalizeCmsPage(syncLocaleMirrorsFromLegacy(next));
}

/** When editors still patch flat title/slug/description, push into NL locale bags. */
function syncLocaleMirrorsFromLegacy(page: CmsPage): CmsPage {
  const next = { ...page };
  const paths = { ...(next.paths ?? { nl: next.slug }), nl: next.slug };
  const nlContent = next.localeContent?.nl ?? {
    navigationLabel: next.title,
    pageTitle: next.title,
    seo: { title: next.title, description: next.description },
  };
  next.paths = paths;
  next.localeContent = {
    ...next.localeContent,
    nl: {
      ...nlContent,
      navigationLabel: next.title || nlContent.navigationLabel,
      pageTitle: next.title || nlContent.pageTitle,
      seo: {
        ...nlContent.seo,
        title: next.title || nlContent.seo.title,
        description: next.description || nlContent.seo.description,
      },
    },
    en: next.localeContent?.en,
  };
  return next;
}

export function createPreviewSnapshot(
  pageId: string,
  page: CmsPage,
  overrides: PageOverrides,
  version: number,
): PreviewSnapshot {
  return {
    pageId,
    version,
    capturedAt: Date.now(),
    page: structuredClone(page),
    overrides: { ...overrides },
  };
}

export function isDraftDirty(draft: PageDraft | undefined): boolean {
  return draftHasChanges(draft);
}
