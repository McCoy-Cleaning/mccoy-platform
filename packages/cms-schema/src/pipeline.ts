import {
  CURRENT_LAYOUT_VERSION,
  buildDefaultLayout,
  defaultFixedLayout,
  ensureFirstLocked,
  layoutFromBlocks,
  newBlockLayoutItem,
  newFixedLayoutItem,
  orphanBlocks,
  type BlockLayoutItem,
  type FixedLayoutItem,
  type LayoutItem,
} from "./layout";
import { parseContentAlign } from "./layout-presentation";
import {
  FIXED_SECTION_DEFS,
  FIXED_SECTIONS_BY_PAGE,
  fixedLayoutId,
  isBuiltinPageKey,
  isFixedSectionKey,
  pageKeyFromPageId,
  pageKeyFromSlug,
  type BuiltinPageKey,
  type FixedSectionKey,
} from "./sections";
import type { Block, BuiltinCmsPage, CmsPage, CustomCmsPage } from "./types";
import { ensureBuiltinSectionContent } from "./section-content";
import { ensurePageLocaleFields } from "./migrate-locale";
import { validatePageSectionContent } from "./content";
import { validatePageBlocksForPublish } from "./blocks/validate";
import { ensureVacaturesJobsBlock } from "./blocks/jobs";

export type ValidateIssue = {
  code: string;
  message: string;
  path?: string;
  /** Present for block publish errors — used for section-scoped Dutch messages. */
  blockLabel?: string;
  blockType?: string;
};

export type ValidateResult =
  | { ok: true; page: CmsPage }
  | { ok: false; issues: ValidateIssue[] };

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function parseLayoutItem(raw: unknown): LayoutItem | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || typeof raw.kind !== "string") return null;
  const contentAlign = parseContentAlign(raw.contentAlign);
  if (raw.kind === "fixed") {
    if (typeof raw.key !== "string" || !isFixedSectionKey(raw.key)) return null;
    return {
      id: (typeof raw.id === "string" && raw.id.startsWith("fixed:")
        ? raw.id
        : fixedLayoutId(raw.key)) as `fixed:${string}`,
      kind: "fixed",
      key: raw.key,
      hidden: Boolean(raw.hidden),
      ...(contentAlign ? { contentAlign } : {}),
    };
  }
  if (raw.kind === "block") {
    if (typeof raw.blockId !== "string") return null;
    return {
      id: raw.id,
      kind: "block",
      blockId: raw.blockId,
      ...(raw.hidden === true ? { hidden: true } : {}),
      ...(contentAlign ? { contentAlign } : {}),
    };
  }
  return null;
}

function parseLayout(raw: unknown): LayoutItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items: LayoutItem[] = [];
  for (const entry of raw) {
    const item = parseLayoutItem(entry);
    if (!item) return null;
    items.push(item);
  }
  return items;
}

/**
 * Reconcile layout when layoutVersion < CURRENT.
 * Inserts missing required/default fixed sections without wiping user order.
 */
export function reconcileLayoutVersion(
  pageKey: BuiltinPageKey,
  layout: LayoutItem[],
  layoutVersion: number,
): { layout: LayoutItem[]; layoutVersion: number } {
  if (layoutVersion >= CURRENT_LAYOUT_VERSION) {
    return { layout, layoutVersion };
  }

  const known = new Set(
    layout.filter((i): i is FixedLayoutItem => i.kind === "fixed").map((i) => i.key),
  );
  const missing: FixedLayoutItem[] = [];
  for (const key of FIXED_SECTIONS_BY_PAGE[pageKey]) {
    if (!known.has(key)) {
      missing.push({
        id: fixedLayoutId(key),
        kind: "fixed",
        key,
        hidden: false,
      });
    }
  }

  let next = layout.slice();
  if (missing.length) {
    // Insert missing fixed sections after the first locked item (or at start).
    const insertAt = next.length > 0 && next[0]?.kind === "fixed" ? 1 : 0;
    next = [...next.slice(0, insertAt), ...missing, ...next.slice(insertAt)];
  }

  next = ensureFirstLocked(next, pageKey);
  return { layout: next, layoutVersion: CURRENT_LAYOUT_VERSION };
}

export function normalizeBuiltinLayout(page: BuiltinCmsPage): BuiltinCmsPage {
  const next = structuredClone(page);
  if (!next.pageKey) {
    // Non-layout-capable builtin (contact, vacatures, …): blocks-only layout.
    if (!next.layout?.length) {
      const extras = next.extraBlocks ?? [];
      const merged = mergeUniqueBlocks(next.blocks, extras);
      next.blocks = merged;
      next.layout = layoutFromBlocks(merged);
    }
    next.layoutVersion = next.layoutVersion ?? CURRENT_LAYOUT_VERSION;
    next.sectionContent = next.sectionContent ?? {};
    delete next.extraBlocks;
    return next;
  }

  const pageKey = next.pageKey;
  let layout = next.layout?.length ? next.layout.slice() : [];
  let layoutVersion = next.layoutVersion ?? 0;

  // Migrate legacy extraBlocks into layout + blocks once.
  const extras = next.extraBlocks ?? [];
  if (extras.length) {
    const merged = mergeUniqueBlocks(next.blocks, extras);
    next.blocks = merged;
    const existingBlockIds = new Set(
      layout.filter((i): i is BlockLayoutItem => i.kind === "block").map((i) => i.blockId),
    );
    for (const b of extras) {
      if (!existingBlockIds.has(b.id)) {
        layout.push(newBlockLayoutItem(b.id));
        existingBlockIds.add(b.id);
      }
    }
  }

  if (!layout.length) {
    // Default fixed sections only; CMS block refs come from migrated extras / existing layout.
    const extras = next.extraBlocks ?? [];
    const blockItems = extras.length
      ? extras.map((b) => newBlockLayoutItem(b.id))
      : [];
    // If blocks already hold CMS content without extras (post-clear), keep orphans out of default layout.
    layout = buildDefaultLayout(pageKey, blockItems);
    layoutVersion = CURRENT_LAYOUT_VERSION;
  } else {
    const reconciled = reconcileLayoutVersion(pageKey, layout, layoutVersion);
    layout = reconciled.layout;
    layoutVersion = reconciled.layoutVersion;
  }

  // Stabilize fixed IDs and hide flags for sections present in the layout.
  // Intentionally absent fixed keys are NOT re-inserted (editors may delete them).
  const byKey = new Map<FixedSectionKey, FixedLayoutItem>();
  for (const item of layout) {
    if (item.kind === "fixed") byKey.set(item.key, item);
  }
  for (const key of FIXED_SECTIONS_BY_PAGE[pageKey]) {
    const existing = byKey.get(key);
    if (!existing) continue;
    byKey.set(key, {
      ...existing,
      id: fixedLayoutId(key),
      hidden: FIXED_SECTION_DEFS[key].hideable ? existing.hidden : false,
      ...(existing.contentAlign ? { contentAlign: existing.contentAlign } : {}),
    });
  }

  // Rebuild: keep order of existing items; drop unknown fixed keys; do not append missing fixed
  // (except required sections, which must always be present).
  const seenFixed = new Set<FixedSectionKey>();
  const rebuilt: LayoutItem[] = [];
  for (const item of layout) {
    if (item.kind === "fixed") {
      if (!FIXED_SECTIONS_BY_PAGE[pageKey].includes(item.key)) continue;
      if (seenFixed.has(item.key)) continue;
      rebuilt.push(byKey.get(item.key)!);
      seenFixed.add(item.key);
    } else {
      rebuilt.push(item);
    }
  }
  for (const key of FIXED_SECTIONS_BY_PAGE[pageKey]) {
    if (!FIXED_SECTION_DEFS[key].required || seenFixed.has(key)) continue;
    rebuilt.push(newFixedLayoutItem(key));
    seenFixed.add(key);
  }

  next.layout = ensureFirstLocked(rebuilt, pageKey);
  next.layoutVersion = CURRENT_LAYOUT_VERSION;
  next.sectionContent = ensureBuiltinSectionContent(next);
  delete next.extraBlocks;
  return next;
}

export function normalizeCustomLayout(page: CustomCmsPage): CustomCmsPage {
  const next = structuredClone(page);
  if (!next.layout?.length) {
    next.layout = layoutFromBlocks(next.blocks);
  } else {
    // Drop layout refs to missing blocks; keep orphans in blocks.
    const blockIds = new Set(next.blocks.map((b) => b.id));
    next.layout = next.layout.filter((i) => blockIds.has(i.blockId));
    // Append missing blocks at end
    const used = new Set(next.layout.map((i) => i.blockId));
    for (const b of next.blocks) {
      if (!used.has(b.id)) next.layout.push(newBlockLayoutItem(b.id));
    }
  }
  next.layoutVersion = CURRENT_LAYOUT_VERSION;
  delete next.extraBlocks;
  return next;
}

/** Removed block types — drop from layout/blocks so legacy drafts stay loadable. */
const REMOVED_BLOCK_TYPES = new Set<string>(["fullImage"]);

function stripRemovedBlocks(page: CmsPage): CmsPage {
  const blocks = page.blocks.filter((b) => !REMOVED_BLOCK_TYPES.has(b.type));
  if (blocks.length === page.blocks.length) return page;
  const keepIds = new Set(blocks.map((b) => b.id));
  return {
    ...page,
    blocks,
    layout: page.layout.filter((item) => item.kind !== "block" || keepIds.has(item.blockId)),
  } as CmsPage;
}

export function normalizeCmsPage(page: CmsPage): CmsPage {
  const stripped = stripRemovedBlocks(page);
  const normalized =
    stripped.kind === "custom" ? normalizeCustomLayout(stripped) : normalizeBuiltinLayout(stripped);
  return ensureVacaturesJobsBlock(ensurePageLocaleFields(normalized));
}

function mergeUniqueBlocks(primary: Block[], extras: Block[]): Block[] {
  const seen = new Set(primary.map((b) => b.id));
  const out = primary.slice();
  for (const b of extras) {
    if (!seen.has(b.id)) {
      out.push(b);
      seen.add(b.id);
    }
  }
  return out;
}

/** Structural integrity for the editor (lenient). */
export function validateCmsPage(page: CmsPage): ValidateResult {
  const issues: ValidateIssue[] = [];
  if (!page.id) issues.push({ code: "MISSING_ID", message: "Page id is required." });
  if (!Array.isArray(page.layout)) {
    issues.push({ code: "MISSING_LAYOUT", message: "layout is required." });
  }
  if (typeof page.layoutVersion !== "number") {
    issues.push({ code: "MISSING_LAYOUT_VERSION", message: "layoutVersion is required." });
  }

  const blockIds = new Set(page.blocks.map((b) => b.id));
  const layoutIds = new Set<string>();
  for (const item of page.layout ?? []) {
    if (layoutIds.has(item.id)) {
      issues.push({ code: "DUPLICATE_LAYOUT_ID", message: `Duplicate layout id ${item.id}`, path: item.id });
    }
    layoutIds.add(item.id);
    if (item.kind === "block" && !blockIds.has(item.blockId)) {
      issues.push({
        code: "DANGLING_BLOCK_REF",
        message: `Layout references missing block ${item.blockId}`,
        path: item.id,
      });
    }
  }

  if (page.kind === "builtin" && page.pageKey) {
    const expected = FIXED_SECTIONS_BY_PAGE[page.pageKey][0];
    const def = expected ? FIXED_SECTION_DEFS[expected] : null;
    if (def?.lockedPosition === "first") {
      const first = page.layout[0];
      const present = page.layout.some((i) => i.kind === "fixed" && i.key === expected);
      if (present && (!first || first.kind !== "fixed" || first.key !== expected)) {
        issues.push({
          code: "FIRST_NOT_LOCKED",
          message: `First layout item must be ${expected}.`,
        });
      }
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, page };
}

/**
 * Stricter checks for Save/publish.
 * Current-version corruption (e.g. missing Hero) fails — no silent repair.
 */
export function validatePublishableCmsPage(page: CmsPage): ValidateResult {
  const base = validateCmsPage(page);
  if (!base.ok) return base;

  const issues: ValidateIssue[] = [];

  if (page.kind === "builtin" && page.pageKey) {
    if (page.layoutVersion < CURRENT_LAYOUT_VERSION) {
      issues.push({
        code: "STALE_LAYOUT_VERSION",
        message: "layoutVersion must be current before publish.",
      });
    }
    for (const key of FIXED_SECTIONS_BY_PAGE[page.pageKey]) {
      const def = FIXED_SECTION_DEFS[key];
      if (!def.required) continue;
      const found = page.layout.find((i) => i.kind === "fixed" && i.key === key);
      if (!found) {
        issues.push({
          code: "MISSING_REQUIRED_SECTION",
          message: `Required section ${key} is missing.`,
          path: key,
        });
      } else if (found.kind === "fixed" && found.hidden && !def.hideable) {
        issues.push({
          code: "REQUIRED_SECTION_HIDDEN",
          message: `Required section ${key} cannot be hidden.`,
          path: key,
        });
      }
    }
    const expected = FIXED_SECTIONS_BY_PAGE[page.pageKey][0];
    const firstDef = expected ? FIXED_SECTION_DEFS[expected] : null;
    if (firstDef?.lockedPosition === "first") {
      const present = page.layout.some((i) => i.kind === "fixed" && i.key === expected);
      const first = page.layout[0];
      if (present && (!first || first.kind !== "fixed" || first.key !== expected)) {
        issues.push({
          code: "CORRUPT_FIRST_SECTION",
          message: `Publish rejected: first section must be ${expected}.`,
        });
      }
    }
    const contentCheck = validatePageSectionContent(page.sectionContent);
    if (!contentCheck.ok) {
      for (const msg of contentCheck.issues) {
        issues.push({ code: "INVALID_SECTION_CONTENT", message: msg });
      }
    }
  }

  // Duplicate block refs
  const seenBlocks = new Set<string>();
  for (const item of page.layout) {
    if (item.kind !== "block") continue;
    if (seenBlocks.has(item.blockId)) {
      issues.push({
        code: "DUPLICATE_BLOCK_IN_LAYOUT",
        message: `Block ${item.blockId} appears twice in layout.`,
      });
    }
    seenBlocks.add(item.blockId);
  }

  // Registry: every layout block must parse; unpublishable types fail publish.
  const layoutBlockIds = new Set(
    page.layout.filter((i) => i.kind === "block").map((i) => (i as { blockId: string }).blockId),
  );
  const blocksToValidate = page.blocks.filter((b) => layoutBlockIds.has(b.id));
  const blockCheck = validatePageBlocksForPublish(blocksToValidate);
  if (!blockCheck.ok) {
    for (const e of blockCheck.errors) {
      const pathStr = e.path.map(String).join(".");
      issues.push({
        code: e.code,
        message: e.message ?? e.code,
        path: pathStr || undefined,
        blockLabel: e.blockLabel,
        blockType: e.blockType,
      });
    }
  }

  if (issues.length) return { ok: false, issues };
  return { ok: true, page };
}

export function listOrphanBlocks(page: CmsPage): Block[] {
  return orphanBlocks(page.blocks, page.layout);
}

export function resolvePageKey(raw: {
  id: string;
  slug: string;
  isCustom: boolean;
  pageKey?: unknown;
}): BuiltinPageKey | null {
  if (raw.isCustom) return null;
  if (typeof raw.pageKey === "string" && isBuiltinPageKey(raw.pageKey)) {
    return raw.pageKey;
  }
  return pageKeyFromPageId(raw.id) ?? pageKeyFromSlug(raw.slug);
}

export { CURRENT_LAYOUT_VERSION, defaultFixedLayout };
