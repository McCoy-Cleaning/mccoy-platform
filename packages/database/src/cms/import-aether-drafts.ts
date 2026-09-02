/**
 * Pull Aether staged fixes into McCoy CMS drafts via DraftUpdateCommand / saveDraft.
 * Never calls publishPage.
 */

import type { CmsPage } from "@mccoy/cms-schema";
import {
  applyAetherLocalePatch,
  currentValueForCmsField,
  FROZEN_LIVE_TITLE_NOTE,
  mapKindToLocalePatch,
  parseAetherStagedFixesDump,
  resolveCmsPageFromUrl,
  type AetherResolvedPage,
  type AetherStagedFixesDump,
} from "@mccoy/cms-schema";
import type { CmsStore } from "./types";

export type AetherImportRow = {
  pageId: string | null;
  pageUrl: string;
  locale: string | null;
  field: string | null;
  current: string | null;
  proposed: string;
  drafted: boolean;
  skippedReason?: string;
  frozenLiveTitle: boolean;
  freezeNote?: string;
};

export type AetherImportResult = { source: string; drafted: number; skipped: number; rows: AetherImportRow[]; published: false };

async function extraPagesFromStore(store: CmsStore): Promise<Array<{ pageId: string; pageKey: string; nl: string; en: string }>> {
  const extra: Array<{ pageId: string; pageKey: string; nl: string; en: string }> = [];
  const pages = await store.listPages();
  for (const row of pages) {
    const payload = (await store.getDraftPayload(row.id)) ?? (await store.getActivePublishedRevision(row.id))?.payload;
    if (!payload) continue;
    extra.push({ pageId: row.id, pageKey: row.pageKey ?? payload.id, nl: payload.paths?.nl ?? payload.slug, en: payload.paths?.en ? (payload.paths.en.startsWith("/en") ? payload.paths.en : "/en" + (payload.paths.en === "/" ? "" : payload.paths.en)) : "/en" });
  }
  return extra;
}

export async function importAetherStagedFixes(input: { store: CmsStore; dump: unknown; dryRun?: boolean; includePending?: boolean }): Promise<AetherImportResult> {
  const dump: AetherStagedFixesDump = parseAetherStagedFixesDump(input.dump);
  const extra = await extraPagesFromStore(input.store);
  const rows: AetherImportRow[] = [];
  let drafted = 0;
  let skipped = 0;
  for (const patch of dump.patches) {
    const mapped = mapKindToLocalePatch(patch.kind, patch.proposedValue);
    const resolved: AetherResolvedPage | null = resolveCmsPageFromUrl(patch.pageUrl, extra);
    const frozen = mapped.frozenLiveTitle;
    const freezeNote = frozen ? FROZEN_LIVE_TITLE_NOTE : undefined;
    if (patch.status && patch.status !== "approved" && patch.status !== "pending_review") {
      skipped += 1; rows.push({ pageId: resolved?.pageId ?? null, pageUrl: patch.pageUrl, locale: resolved?.locale ?? null, field: mapped.cmsField, current: patch.currentValue ?? null, proposed: patch.proposedValue, drafted: false, skippedReason: "status_not_importable", frozenLiveTitle: frozen, freezeNote }); continue;
    }
    if (patch.status === "pending_review" && input.includePending === false) {
      skipped += 1; rows.push({ pageId: resolved?.pageId ?? null, pageUrl: patch.pageUrl, locale: resolved?.locale ?? null, field: mapped.cmsField, current: patch.currentValue ?? null, proposed: patch.proposedValue, drafted: false, skippedReason: "pending_review_not_imported", frozenLiveTitle: frozen, freezeNote }); continue;
    }
    if (mapped.skipReason || !resolved) {
      skipped += 1; rows.push({ pageId: resolved?.pageId ?? null, pageUrl: patch.pageUrl, locale: resolved?.locale ?? null, field: mapped.cmsField, current: patch.currentValue ?? null, proposed: patch.proposedValue, drafted: false, skippedReason: mapped.skipReason ?? "mccoy_page_not_resolved", frozenLiveTitle: frozen, freezeNote }); continue;
    }
    const pageRow = await input.store.getPage(resolved.pageId);
    if (!pageRow) {
      skipped += 1; rows.push({ pageId: resolved.pageId, pageUrl: patch.pageUrl, locale: resolved.locale, field: mapped.cmsField, current: patch.currentValue ?? null, proposed: patch.proposedValue, drafted: false, skippedReason: "cms_page_not_found", frozenLiveTitle: frozen, freezeNote }); continue;
    }
    const payload = (await input.store.getDraftPayload(resolved.pageId)) ?? (await input.store.getActivePublishedRevision(resolved.pageId))?.payload;
    if (!payload) {
      skipped += 1; rows.push({ pageId: resolved.pageId, pageUrl: patch.pageUrl, locale: resolved.locale, field: mapped.cmsField, current: patch.currentValue ?? null, proposed: patch.proposedValue, drafted: false, skippedReason: "cms_draft_missing", frozenLiveTitle: frozen, freezeNote }); continue;
    }
    const current = currentValueForCmsField(payload, resolved.locale, mapped.cmsField, patch.currentValue ?? null);
    if (input.dryRun) {
      rows.push({ pageId: resolved.pageId, pageUrl: patch.pageUrl, locale: resolved.locale, field: mapped.cmsField, current, proposed: patch.proposedValue, drafted: false, skippedReason: "dry_run", frozenLiveTitle: frozen, freezeNote }); continue;
    }
    try {
      const next: CmsPage = applyAetherLocalePatch(payload, resolved.locale, mapped.localePatch);
      await input.store.saveDraft({ pageId: resolved.pageId, expectedRevisionNumber: pageRow.draftRevisionNumber, changes: { localePatches: { [resolved.locale]: mapped.localePatch } }, payload: next });
      drafted += 1;
      rows.push({ pageId: resolved.pageId, pageUrl: patch.pageUrl, locale: resolved.locale, field: mapped.cmsField, current, proposed: patch.proposedValue, drafted: true, frozenLiveTitle: frozen, freezeNote });
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as { code?: unknown }).code) : "";
      skipped += 1;
      rows.push({ pageId: resolved.pageId, pageUrl: patch.pageUrl, locale: resolved.locale, field: mapped.cmsField, current, proposed: patch.proposedValue, drafted: false, skippedReason: code === "conflict" ? "draft_revision_conflict" : (err instanceof Error ? err.message : "draft_write_failed"), frozenLiveTitle: frozen, freezeNote });
    }
  }
  return { source: dump.source ?? "aether-crawler", drafted, skipped, rows, published: false };
}
