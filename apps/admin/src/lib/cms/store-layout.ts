/**
 * Stage 6 — CMS store layout / draft mutation slice.
 * Draft-only layout ops, fixed-section patches, page meta, and builtin migrations.
 */
import {
  addLayoutBlock,
  addFixedLayoutItem,
  canEnableCustomPageInNav,
  cloneJobsDataWithNewIds,
  createDefaultBlock,
  duplicateLayoutBlock,
  effectiveOverrides,
  forceProductsIntroAssortmentPair,
  getSectionContent,
  isDraftDirty,
  mergeSectionPatch,
  minInsertIndex,
  moveLayoutItem,
  MAX_EXTRA_CUSTOM_NAV_PAGES,
  normalizeJobs,
  parseBlockData,
  removeFixedLayoutItem,
  removeLayoutBlock,
  resolveAboutBlocksLayout,
  resolveHomeHeroBlocksLayout,
  resolveLegalBlocksLayout,
  resolveOfferteBlocksLayout,
  resolveProductsBlocksLayout,
  SECTION_CONTENT_SCHEMAS,
  setLayoutItemContentAlign,
  syncCustomLayoutFromBlocks,
  toggleFixedSection,
  toggleLayoutItemHidden,
  updateLayoutBlockData,
  type Block,
  type BlockType,
  type CmsPage,
  type ContentAlign,
  type FixedSectionKey,
  type PageDraft,
  type PageOverrides,
  type PageSectionContent,
} from "@mccoy/cms-schema";
import { getTemplate, getTemplateById } from "./templates";
import {
  applyLayoutResult,
  commitDraftPage,
  editablePage,
  getOrInitDraft,
  pagesForNavCap,
  regenerateNestedIds,
  uid,
} from "./store-draft";
import {
  clearMemoryState,
  clearSessionPreviews,
  initial,
  markPreviewStale,
  read,
  sessionPreviewSnapshots,
  WRITE_FAIL_REASON,
  write,
  writeOrAlert,
} from "./store-persistence";

export const cmsLayoutApi = {
  updatePage(id: string, patch: Partial<CmsPage>): { ok: true } | { ok: false; reason: string } {
    const s = read();
    const current = editablePage(s, id);
    if (!current) return { ok: false, reason: "Pagina niet gevonden." };
    const next = { ...current, ...patch, updatedAt: Date.now(), version: (current.version ?? 1) + 1 } as CmsPage;
    if (next.isCustom && next.inNav && !current.inNav) {
      const forCap = pagesForNavCap(s).map((p) => (p.id === id ? { ...p, inNav: false } : p));
      const check = canEnableCustomPageInNav(forCap, id);
      if (!check.ok) return check;
    }
    commitDraftPage(s, id, next);
    return { ok: true };
  },
  /** UI helper: whether “Toon in navigatie” can be enabled for this page. */
  canEnableInNav(pageId: string): { ok: true } | { ok: false; reason: string } {
    const s = read();
    const forCap = pagesForNavCap(s);
    const page = forCap.find((p) => p.id === pageId);
    if (!page) return { ok: false, reason: "Pagina niet gevonden." };
    if (page.inNav) return { ok: true };
    return canEnableCustomPageInNav(
      forCap.map((p) => (p.id === pageId ? { ...p, inNav: false } : p)),
      pageId,
    );
  },
  getCustomInNavCount(): number {
    return pagesForNavCap(read()).filter((p) => p.isCustom && p.inNav).length;
  },
  getMaxExtraCustomNavPages(): number {
    return MAX_EXTRA_CUSTOM_NAV_PAGES;
  },

  /**
   * Home hero fixed→reusable hero block: resolve once and persist draft when changed.
   * Storefront must never call this (admin is the persistence authority).
   */
  ensureHomeHeroBlocksMigration(pageId: string): {
    changed: boolean;
    report: ReturnType<typeof resolveHomeHeroBlocksLayout>["report"] | null;
  } {
    const page = editablePage(read(), pageId);
    if (!page || page.kind !== "builtin" || page.pageKey !== "home") {
      return { changed: false, report: null };
    }
    const resolved = resolveHomeHeroBlocksLayout(page);
    if (!resolved.changed) {
      return { changed: false, report: resolved.report };
    }
    const before = JSON.stringify({
      layout: page.layout,
      blocks: page.blocks,
      migration: page.homeHeroBlocksMigration ?? null,
    });
    const after = JSON.stringify({
      layout: resolved.page.layout,
      blocks: resolved.page.blocks,
      migration: resolved.page.homeHeroBlocksMigration ?? null,
    });
    if (before === after) {
      return { changed: false, report: resolved.report };
    }
    commitDraftPage(read(), pageId, resolved.page);
    return { changed: true, report: resolved.report };
  },

  ensureAboutBlocksMigration(pageId: string): {
    changed: boolean;
    report: ReturnType<typeof resolveAboutBlocksLayout>["report"] | null;
  } {
    const page = editablePage(read(), pageId);
    if (!page || page.kind !== "builtin" || page.pageKey !== "about") {
      return { changed: false, report: null };
    }
    const resolved = resolveAboutBlocksLayout(page);
    if (!resolved.changed) {
      return { changed: false, report: resolved.report };
    }
    const before = JSON.stringify({
      layout: page.layout,
      blocks: page.blocks,
      migration: page.aboutBlocksMigration ?? null,
    });
    const after = JSON.stringify({
      layout: resolved.page.layout,
      blocks: resolved.page.blocks,
      migration: resolved.page.aboutBlocksMigration ?? null,
    });
    if (before === after) {
      return { changed: false, report: resolved.report };
    }
    commitDraftPage(read(), pageId, resolved.page);
    return { changed: true, report: resolved.report };
  },

  ensureOfferteBlocksMigration(pageId: string): {
    changed: boolean;
    report: ReturnType<typeof resolveOfferteBlocksLayout>["report"] | null;
  } {
    const page = editablePage(read(), pageId);
    if (!page || page.kind !== "builtin" || page.pageKey !== "offerte") {
      return { changed: false, report: null };
    }
    const resolved = resolveOfferteBlocksLayout(page);
    if (!resolved.changed) {
      return { changed: false, report: resolved.report };
    }
    const before = JSON.stringify({
      layout: page.layout,
      blocks: page.blocks,
      migration: page.offerteBlocksMigration ?? null,
    });
    const after = JSON.stringify({
      layout: resolved.page.layout,
      blocks: resolved.page.blocks,
      migration: resolved.page.offerteBlocksMigration ?? null,
    });
    if (before === after) {
      return { changed: false, report: resolved.report };
    }
    commitDraftPage(read(), pageId, resolved.page);
    return { changed: true, report: resolved.report };
  },

  ensureLegalBlocksMigration(pageId: string): {
    changed: boolean;
    report: ReturnType<typeof resolveLegalBlocksLayout>["report"] | null;
  } {
    const page = editablePage(read(), pageId);
    if (
      !page ||
      page.kind !== "builtin" ||
      (page.pageKey !== "privacy" && page.pageKey !== "terms")
    ) {
      return { changed: false, report: null };
    }
    const resolved = resolveLegalBlocksLayout(page);
    if (!resolved.changed) {
      return { changed: false, report: resolved.report };
    }
    const before = JSON.stringify({
      layout: page.layout,
      blocks: page.blocks,
      migration: page.legalBlocksMigration ?? null,
    });
    const after = JSON.stringify({
      layout: resolved.page.layout,
      blocks: resolved.page.blocks,
      migration: resolved.page.legalBlocksMigration ?? null,
    });
    if (before === after) {
      return { changed: false, report: resolved.report };
    }
    commitDraftPage(read(), pageId, resolved.page);
    return { changed: true, report: resolved.report };
  },

  /**
   * Producten fixed→blocks: resolve once and persist draft when changed.
   * Storefront must never call this (admin is the persistence authority).
   */
  ensureProductsBlocksMigration(pageId: string): {
    changed: boolean;
    report: ReturnType<typeof resolveProductsBlocksLayout>["report"] | null;
  } {
    const page = editablePage(read(), pageId);
    if (!page || page.kind !== "builtin" || page.pageKey !== "products") {
      return { changed: false, report: null };
    }
    const summarize = (p: typeof page) =>
      p.layout.map((item) => {
        if (item.kind === "fixed") return `fixed:${item.key}`;
        const block = p.blocks.find((b) => b.id === item.blockId);
        const data =
          block?.data && typeof block.data === "object"
            ? (block.data as Record<string, unknown>)
            : {};
        return `${block?.type ?? "missing"}:${String(data.presentation ?? "none")}`;
      });
    const resolved = resolveProductsBlocksLayout(page);
    // Nuclear guarantee: resolve alone was observed returning unchanged layouts while
    // claiming restore. Force exact Intro + Assortiment pair for non-empty Producten.
    const forced = forceProductsIntroAssortmentPair(resolved.page);
    const nextPage = forced.page;
    const beforePresentations = summarize(page);
    const afterPresentations = summarize(nextPage);
    const beforeHasIntro = beforePresentations.some((p) => p.includes(":productsIntro"));
    const beforeHasAssortment = beforePresentations.some((p) =>
      p.includes(":productsAssortment"),
    );
    const afterHasIntro = afterPresentations.some((p) => p.includes(":productsIntro"));
    const afterHasAssortment = afterPresentations.some((p) =>
      p.includes(":productsAssortment"),
    );
    const pairComplete = afterHasIntro && afterHasAssortment;
    const pairWasIncomplete = !(beforeHasIntro && beforeHasAssortment);
    const willPersist =
      forced.changed ||
      (resolved.changed &&
        JSON.stringify({
          layout: page.layout,
          blocks: page.blocks,
          migration: page.productsBlocksMigration ?? null,
        }) !==
          JSON.stringify({
            layout: nextPage.layout,
            blocks: nextPage.blocks,
            migration: nextPage.productsBlocksMigration ?? null,
          })) ||
      (pairWasIncomplete && pairComplete);
    if (!willPersist) {
      return {
        changed: false,
        report: {
          ...resolved.report,
          warnings: [...resolved.report.warnings, ...forced.warnings],
        },
      };
    }
    commitDraftPage(read(), pageId, nextPage);
    return {
      changed: true,
      report: {
        ...resolved.report,
        warnings: [...resolved.report.warnings, ...forced.warnings],
      },
    };
  },

  /* ============ Layout ops (draft only) ============ */
  moveLayoutItem(pageId: string, itemId: string, direction: "up" | "down") {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    return applyLayoutResult(pageId, moveLayoutItem(page, itemId, direction));
  },
  addLayoutBlock(
    pageId: string,
    type: BlockType,
    atIndex: number,
    opts?: { templateId?: string },
  ) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    const tpl = opts?.templateId ? getTemplateById(opts.templateId) : getTemplate(type);
    if (!tpl || tpl.type !== type) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    const block = createDefaultBlock(type);
    const parsed = parseBlockData(type, tpl.defaultData);
    if (parsed.ok) {
      block.data = parsed.data as Block["data"];
      block.dataVersion = parsed.dataVersion;
    }
    block.id = uid("b");
    return applyLayoutResult(pageId, addLayoutBlock(page, block, atIndex));
  },
  toggleFixedSection(pageId: string, fixedKey: FixedSectionKey) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    return applyLayoutResult(pageId, toggleFixedSection(page, fixedKey));
  },
  toggleLayoutItemHidden(pageId: string, layoutItemId: string) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    return applyLayoutResult(pageId, toggleLayoutItemHidden(page, layoutItemId));
  },
  removeFixedLayoutItem(pageId: string, fixedKey: FixedSectionKey) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    return applyLayoutResult(pageId, removeFixedLayoutItem(page, fixedKey));
  },
  addFixedLayoutItem(pageId: string, fixedKey: FixedSectionKey, atIndex?: number) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    return applyLayoutResult(pageId, addFixedLayoutItem(page, fixedKey, atIndex));
  },
  setLayoutItemContentAlign(pageId: string, layoutItemId: string, align: ContentAlign) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "UNKNOWN_SECTION" as const };
    return applyLayoutResult(pageId, setLayoutItemContentAlign(page, layoutItemId, align));
  },
  removeLayoutBlock(pageId: string, blockId: string) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "MISSING_BLOCK" as const };
    const result = removeLayoutBlock(page, blockId);
    if (!result.ok) return applyLayoutResult(pageId, result);
    // Drop EN drafts for the removed block so they cannot resurrect on publish.
    const next = structuredClone(result.page);
    const prefix = `block:${blockId}:`;
    if (next.enFieldDrafts) {
      const cleaned: Record<string, string> = {};
      for (const [key, value] of Object.entries(next.enFieldDrafts)) {
        if (!key.startsWith(prefix)) cleaned[key] = value;
      }
      next.enFieldDrafts = cleaned;
    }
    if (next.enFieldDraftSources) {
      const cleaned: Record<string, string> = {};
      for (const [key, value] of Object.entries(next.enFieldDraftSources)) {
        if (!key.startsWith(prefix)) cleaned[key] = value;
      }
      next.enFieldDraftSources = cleaned;
    }
    if (next.enFieldDraftMeta) {
      const cleaned: NonNullable<CmsPage["enFieldDraftMeta"]> = {};
      for (const [key, value] of Object.entries(next.enFieldDraftMeta)) {
        if (!key.startsWith(prefix)) cleaned[key] = value;
      }
      next.enFieldDraftMeta = Object.keys(cleaned).length > 0 ? cleaned : undefined;
    }
    return applyLayoutResult(pageId, { ok: true, page: next });
  },
  duplicateLayoutBlock(pageId: string, blockId: string) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "MISSING_BLOCK" as const };
    return applyLayoutResult(
      pageId,
      duplicateLayoutBlock(page, blockId, (source) => {
        const newId = uid("b");
        let data = structuredClone(source.data);
        if (source.type === "jobs") {
          data = cloneJobsDataWithNewIds(normalizeJobs(data)) as unknown as Record<string, unknown>;
        } else {
          // Regenerate common nested `id` fields on array items.
          data = regenerateNestedIds(data);
        }
        return {
          ...source,
          id: newId,
          data,
        };
      }),
    );
  },
  updateLayoutBlock(pageId: string, blockId: string, patch: Record<string, unknown>) {
    const page = editablePage(read(), pageId);
    if (!page) return { ok: false as const, code: "MISSING_BLOCK" as const };
    return applyLayoutResult(pageId, updateLayoutBlockData(page, blockId, patch));
  },

  /**
   * Custom-page block list helpers — draft-gated.
   * @deprecated Prefer layout APIs for builtins; kept for custom PageEditor.
   */
  addBlock(
    pageId: string,
    type: BlockType,
    index?: number,
    _target: "blocks" | "extraBlocks" = "blocks",
    opts?: { templateId?: string },
  ) {
    const s = read();
    const page = editablePage(s, pageId);
    if (!page) return;
    const tpl = opts?.templateId ? getTemplateById(opts.templateId) : getTemplate(type);
    if (!tpl || tpl.type !== type) return;
    const block = createDefaultBlock(type);
    const parsed = parseBlockData(type, tpl.defaultData);
    if (parsed.ok) {
      block.data = parsed.data as Block["data"];
      block.dataVersion = parsed.dataVersion;
    }
    block.id = uid("b");
    if (page.kind === "builtin" && page.pageKey) {
      const at = index ?? page.layout.length;
      const min = minInsertIndex(page.pageKey);
      applyLayoutResult(pageId, addLayoutBlock(page, block, Math.max(at, min)));
      return;
    }
    const next = structuredClone(page);
    if (index === undefined || index >= next.blocks.length) next.blocks.push(block);
    else next.blocks.splice(index, 0, block);
    const synced = next.kind === "custom" ? syncCustomLayoutFromBlocks(next) : next;
    synced.updatedAt = Date.now();
    synced.version += 1;
    commitDraftPage(s, pageId, synced);
  },
  updateBlock(pageId: string, blockId: string, patch: Record<string, unknown>, _target: "blocks" | "extraBlocks" = "blocks") {
    const page = editablePage(read(), pageId);
    if (!page) return;
    applyLayoutResult(pageId, updateLayoutBlockData(page, blockId, patch));
  },
  deleteBlock(pageId: string, blockId: string, _target: "blocks" | "extraBlocks" = "blocks") {
    const page = editablePage(read(), pageId);
    if (!page) return;
    if (page.kind === "custom") {
      const next = structuredClone(page);
      next.blocks = next.blocks.filter((b) => b.id !== blockId);
      commitDraftPage(read(), pageId, syncCustomLayoutFromBlocks(next));
      return;
    }
    applyLayoutResult(pageId, removeLayoutBlock(page, blockId));
  },
  moveBlock(pageId: string, blockId: string, dir: -1 | 1, _target: "blocks" | "extraBlocks" = "blocks") {
    const page = editablePage(read(), pageId);
    if (!page) return;
    const item = page.layout.find((i) => i.kind === "block" && i.blockId === blockId);
    if (!item) {
      // Custom pages may still reorder via blocks array
      if (page.kind === "custom") {
        const idx = page.blocks.findIndex((b) => b.id === blockId);
        const nextIdx = idx + dir;
        if (idx < 0 || nextIdx < 0 || nextIdx >= page.blocks.length) return;
        const next = structuredClone(page);
        const arr = next.blocks.slice();
        [arr[idx], arr[nextIdx]] = [arr[nextIdx]!, arr[idx]!];
        next.blocks = arr;
        commitDraftPage(read(), pageId, syncCustomLayoutFromBlocks(next));
      }
      return;
    }
    applyLayoutResult(pageId, moveLayoutItem(page, item.id, dir === -1 ? "up" : "down"));
  },

  /* ============ Overrides (draft / saved) ============ */
  getDraft(pageId: string): PageOverrides {
    const s = read();
    return effectiveOverrides(s.saved[pageId], s.draft[pageId]);
  },
  getSaved(pageId: string): PageOverrides {
    return { ...(read().saved[pageId] || {}) };
  },
  getPageDraft(pageId: string): PageDraft | undefined {
    return read().draft[pageId];
  },
  /**
   * Patch typed fixed-section content on the editor draft.
   * Parent is source of truth — iframe must not invent section documents.
   */
  patchSectionContent(
    pageId: string,
    sectionKey: FixedSectionKey,
    patch: Record<string, unknown>,
  ): { ok: true } | { ok: false; reason: string } {
    const s = read();
    const page = editablePage(s, pageId);
    if (!page || page.kind !== "builtin") {
      return { ok: false, reason: "Alleen vaste pagina's ondersteunen sectie-inhoud." };
    }
    const current = getSectionContent(page, sectionKey) as Record<string, unknown>;
    const merged = mergeSectionPatch(current, patch);
    const parsed = SECTION_CONTENT_SCHEMAS[sectionKey].safeParse(merged);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue?.path?.length ? ` (${issue.path.join(".")})` : "";
      return { ok: false, reason: `Ongeldige inhoud voor ${sectionKey}${path}.` };
    }
    const validated = parsed.data;
    const next = structuredClone(page);
    next.sectionContent = {
      ...(next.sectionContent ?? {}),
      [sectionKey]: validated,
    } as PageSectionContent;
    next.updatedAt = Date.now();
    next.version += 1;
    commitDraftPage(s, pageId, next);

    // Structured sectionContent is now source of truth — drop flat legacy keys so
    // they cannot shadow future reads via migrateLegacyHeroOverrides.
    if (sectionKey === "home.hero") {
      const draft = s.draft[pageId];
      if (draft?.overrides) {
        for (const key of [
          "hero.kicker",
          "hero.title",
          "hero.titleAccent",
          "hero.sub",
          "hero.image",
          "hero.ctaSecondary",
        ] as const) {
          delete draft.overrides[key];
        }
      }
      if (s.saved[pageId]) {
        for (const key of [
          "hero.kicker",
          "hero.title",
          "hero.titleAccent",
          "hero.sub",
          "hero.image",
          "hero.ctaSecondary",
        ] as const) {
          delete s.saved[pageId]![key];
        }
      }
      if (!write(s)) return { ok: false, reason: WRITE_FAIL_REASON };
    }
    return { ok: true };
  },
  setDraft(pageId: string, key: string, value: string) {
    const s = read();
    const d = getOrInitDraft(s, pageId);
    d.overrides[key] = value;
    markPreviewStale(pageId);
    writeOrAlert(s);
  },
  hasDraft(pageId: string) {
    const s = read();
    const page = s.pages.find((p) => p.id === pageId);
    if (page?.isDraftOnly) return true;
    return isDraftDirty(s.draft[pageId]);
  },
  discardDraft(pageId: string) {
    const s = read();
    delete s.draft[pageId];
    sessionPreviewSnapshots.delete(pageId);
    markPreviewStale(pageId);
    const page = s.pages.find((p) => p.id === pageId);
    if (page?.isDraftOnly) {
      s.pages = s.pages.filter((p) => p.id !== pageId);
    }
    writeOrAlert(s);
  },

  reset() {
    clearSessionPreviews();
    clearMemoryState();
    writeOrAlert(initial());
  },
};
