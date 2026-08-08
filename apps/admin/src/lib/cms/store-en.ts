/**
 * Stage 6 — CMS store EN planning / draft-sync slice.
 * Owns EN field draft mutations and Opslaan EN preparation (plan → translate → sync).
 */
import {
  applyEnFieldDraftEditorPatch,
  applyTranslatedEnFields,
  chunkRecordByBudget,
  collectPageNlFieldDraftCollection,
  collectPageNlFieldDraftMap,
  createTranslationSourceHash,
  ensureEnglishLocaleContentFromDrafts,
  filterNonEmptyTranslateFields,
  planEnFieldDraftSync,
  remapEnFieldDraftsToCanonicalPaths,
  scanTranslationCoverage,
  selectTranslateMissingFromPage,
  type CmsPage,
  type TranslationFieldMetadata,
} from "@mccoy/cms-schema";
import { translateNlToEn } from "@/lib/api/content-ai.functions";
import { commitDraftPage, editablePage } from "./store-draft";
import { read } from "./store-persistence";

export const cmsEnApi = {
  /** Phase E MVP — set/merge English field drafts (does not publish). */
  setEnFieldDrafts(pageId: string, patch: Record<string, string>) {
    const s = read();
    const page = editablePage(s, pageId);
    if (!page) return;
    const next = structuredClone(page);
    const { fields: nlNow, aliases } = collectPageNlFieldDraftCollection(next);
    const patched = applyEnFieldDraftEditorPatch({
      drafts: next.enFieldDrafts,
      sources: next.enFieldDraftSources,
      meta: next.enFieldDraftMeta,
      patch,
      nlFields: nlNow,
      aliases,
    });
    next.enFieldDrafts = patched.enFieldDrafts;
    next.enFieldDraftSources = patched.enFieldDraftSources;
    next.enFieldDraftMeta =
      Object.keys(patched.enFieldDraftMeta).length > 0 ? patched.enFieldDraftMeta : undefined;
    next.updatedAt = Date.now();
    next.version += 1;
    // Editing EN drafts must not unpublish a live EN locale — publication and
    // freshness are separate. Mark published EN as stale until Opslaan republishes.
    const merged = patched.enFieldDrafts;
    if (Object.keys(merged).length > 0 || Object.keys(patch).length > 0) {
      const prevEn = next.localeStates?.en;
      const keepPublication =
        prevEn?.publicationState && prevEn.publicationState !== "missing"
          ? prevEn.publicationState
          : ("draft" as const);
      next.localeStates = {
        ...(next.localeStates ?? { nl: { publicationState: "published", freshness: "current" } }),
        nl: next.localeStates?.nl ?? { publicationState: "published", freshness: "current" },
        en: {
          publicationState: keepPublication,
          freshness: keepPublication === "published" ? "stale" : (prevEn?.freshness ?? "unknown"),
        },
      };
    }
    commitDraftPage(s, pageId, next);
  },

  /**
   * Translate only missing/blank EN fields (never overwrites manual or intentional_blank).
   * Persists into enFieldDrafts as drafts — does not publish.
   */
  async translateMissingEnFields(
    pageId: string,
    includeStates: Array<"missing" | "blank" | "stale" | "override_removed"> = [
      "missing",
      "blank",
      "override_removed",
    ],
  ): Promise<
    | { ok: true; translated: number; skipped: number; warning?: string }
    | { ok: false; reason: string }
  > {
    const s = read();
    const page = editablePage(s, pageId);
    if (!page) return { ok: false, reason: "Pagina niet gevonden." };

    const remapped = remapEnFieldDraftsToCanonicalPaths(page);
    const working: CmsPage = {
      ...page,
      enFieldDrafts: remapped.enFieldDrafts,
      enFieldDraftSources: remapped.enFieldDraftSources,
      enFieldDraftMeta: remapped.enFieldDraftMeta ?? page.enFieldDraftMeta,
    };

    const selected = selectTranslateMissingFromPage(working, includeStates);
    if (selected.length === 0) {
      return { ok: true, translated: 0, skipped: 0 };
    }

    const toTranslate: Record<string, string> = {};
    for (const field of selected) toTranslate[field.path] = field.sourceValue;

    const translated: Record<string, string> = {};
    let warning: string | undefined;
    for (const chunk of chunkRecordByBudget(toTranslate, { maxItems: 8, maxChars: 3500 })) {
      const fields = filterNonEmptyTranslateFields(chunk);
      if (Object.keys(fields).length === 0) continue;
      try {
        const res = await translateNlToEn({
          data: { fields, maxCharsPerField: 2000 },
        });
        if (!res.ok) {
          warning = res.error;
          continue;
        }
        Object.assign(translated, res.result.fields);
      } catch (error) {
        warning = error instanceof Error ? error.message : "Onbekende fout";
      }
    }

    const next = structuredClone(working);
    const drafts = { ...(next.enFieldDrafts ?? {}) };
    const sources = { ...(next.enFieldDraftSources ?? {}) };
    const meta: Record<string, TranslationFieldMetadata> = {
      ...(next.enFieldDraftMeta ?? {}),
    };
    let applied = 0;
    for (const field of selected) {
      // Never overwrite intentional_blank / manually_translated.
      // override_removed may be refilled by an explicit “vertaal ontbrekende”.
      const existingMeta = meta[field.path]?.status;
      if (existingMeta === "intentional_blank" || existingMeta === "manually_translated") {
        continue;
      }
      const en = translated[field.path]?.trim();
      if (!en || en === field.sourceValue.trim()) continue;
      drafts[field.path] = en;
      sources[field.path] = field.sourceValue;
      meta[field.path] = {
        status: "machine_translated",
        sourceHash: createTranslationSourceHash(field.sourceValue),
        translatedAt: new Date().toISOString(),
        provider: "groq",
      };
      applied += 1;
    }
    next.enFieldDrafts = drafts;
    next.enFieldDraftSources = sources;
    next.enFieldDraftMeta = meta;
    next.updatedAt = Date.now();
    next.version += 1;
    commitDraftPage(s, pageId, next);
    return {
      ok: true,
      translated: applied,
      skipped: selected.length - applied,
      warning,
    };
  },

  /** Field-level EN coverage for the editable page (editor UI). */
  getTranslationCoverage(pageId: string) {
    const page = editablePage(read(), pageId);
    if (!page) return null;
    const remapped = remapEnFieldDraftsToCanonicalPaths(page);
    return scanTranslationCoverage({
      page: {
        ...page,
        enFieldDrafts: remapped.enFieldDrafts,
        enFieldDraftSources: remapped.enFieldDraftSources,
        enFieldDraftMeta: remapped.enFieldDraftMeta ?? page.enFieldDraftMeta,
      },
    });
  },
};

export type OpslaanEnPrepResult = {
  nextPage: CmsPage;
  toTranslate: Record<string, string>;
  translated: Record<string, string>;
  translateWarning: string | undefined;
  hasEnDraftKeys: boolean;
};

/**
 * Remap → plan → Groq translate missing → apply retained/translated drafts.
 * Mutates a structuredClone of `nextPage` and returns prep metadata for Opslaan.
 */
export async function preparePageEnForOpslaan(
  nextPage: CmsPage,
  published: CmsPage,
): Promise<OpslaanEnPrepResult> {
  // Canonicalize legacy index/colon draft keys onto stable-id discovery paths.
  const remapped = remapEnFieldDraftsToCanonicalPaths(nextPage);
  nextPage.enFieldDrafts = remapped.enFieldDrafts;
  nextPage.enFieldDraftSources = remapped.enFieldDraftSources;
  if (remapped.enFieldDraftMeta) {
    nextPage.enFieldDraftMeta = remapped.enFieldDraftMeta;
  }

  // Auto-sync EN drafts: missing/blank/source_echo/empty override_removed → Groq.
  // Valid distinct EN and intentional_blank / manually_translated are retained.
  const baselineNlFields = collectPageNlFieldDraftMap(published);
  const nlFields = collectPageNlFieldDraftMap(nextPage);
  const plan = planEnFieldDraftSync({
    nlFields,
    existingDrafts: nextPage.enFieldDrafts,
    existingSources: nextPage.enFieldDraftSources,
    existingMeta: nextPage.enFieldDraftMeta,
    baselineNlFields,
    baselineEnDrafts: published.enFieldDrafts,
  });

  const translated: Record<string, string> = {};
  let translateWarning: string | undefined;
  const toTranslate = filterNonEmptyTranslateFields(plan.toTranslate);
  if (Object.keys(toTranslate).length > 0) {
    // Budget-aware chunks reduce Groq json_validate_failed from truncated JSON.
    for (const chunk of chunkRecordByBudget(toTranslate, { maxItems: 8, maxChars: 3500 })) {
      const fields = filterNonEmptyTranslateFields(chunk);
      if (Object.keys(fields).length === 0) continue;
      try {
        const res = await translateNlToEn({
          data: { fields, maxCharsPerField: 2000 },
        });
        if (!res.ok) {
          // Keep successful prior chunks; continue so later fields may still translate.
          translateWarning = res.error;
          continue;
        }
        Object.assign(translated, res.result.fields);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Onbekende fout";
        translateWarning = message;
        continue;
      }
    }
  }

  const synced = applyTranslatedEnFields({
    retainedDrafts: plan.retainedDrafts,
    retainedSources: plan.retainedSources,
    toTranslate,
    translated,
  });
  nextPage.enFieldDrafts = synced.enFieldDrafts;
  nextPage.enFieldDraftSources = synced.enFieldDraftSources;

  // Mark successfully auto-filled paths as machine_translated (durable meta).
  const appliedPaths = Object.keys(toTranslate).filter((p) => synced.enFieldDrafts[p]?.trim());
  if (appliedPaths.length > 0) {
    const meta = { ...(nextPage.enFieldDraftMeta ?? {}) };
    for (const path of appliedPaths) {
      const nl = toTranslate[path] ?? "";
      meta[path] = {
        status: "machine_translated",
        sourceHash: createTranslationSourceHash(nl),
        translatedAt: new Date().toISOString(),
        provider: "groq",
      };
    }
    nextPage.enFieldDraftMeta = meta;
  }
  const rejectedAsDutch = Object.keys(toTranslate).filter((p) => {
    const en = translated[p]?.trim();
    return en && !synced.enFieldDrafts[p]?.trim();
  }).length;
  const missingAfterApply = Object.keys(toTranslate).filter(
    (p) => !synced.enFieldDrafts[p]?.trim(),
  ).length;
  if (Object.keys(toTranslate).length > 0 && missingAfterApply > 0 && !translateWarning) {
    translateWarning =
      rejectedAsDutch > 0
        ? `AI gaf ${rejectedAsDutch} veld(en) terug die gelijk bleven aan NL (afgewezen).`
        : `${missingAfterApply} veld(en) niet vertaald.`;
  }

  // Keep localeContent.en SEO bag available whenever EN drafts exist (publish gate).
  const hasEnDraftKeys = Object.keys(synced.enFieldDrafts).length > 0;
  if (hasEnDraftKeys || nextPage.localeContent?.en) {
    Object.assign(nextPage, ensureEnglishLocaleContentFromDrafts(nextPage));
  }

  return { nextPage, toTranslate, translated, translateWarning, hasEnDraftKeys };
}
