/**
 * Stage 6 — CMS store EN planning / draft-sync slice.
 * Owns protected EN translation and nonblocking Opslaan EN preparation.
 */
import {
  applyEnFieldDraftEditorPatch,
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

export const AUTOMATIC_EN_TRANSLATION_COOLDOWN_MS = 10 * 60 * 1_000;
export const EN_TRANSLATION_BATCH_MAX_ITEMS = 40;
export const EN_TRANSLATION_BATCH_MAX_CHARS = 12_000;

export type AutomaticEnTranslationStatus = {
  state: "queued" | "translating" | "completed" | "failed";
  translated: number;
  failed: number;
  skipped: number;
  updatedAt: number;
  errorCode?: string;
};

type TranslationSelection = {
  path: string;
  sourceValue: string;
  sourceHash: string;
};

type TranslationRunResult =
  | {
      ok: true;
      translated: number;
      failed: number;
      skipped: number;
      warning?: string;
      errorCode?: string;
    }
  | { ok: false; reason: string };

type TranslationBatchResult = {
  attempted: Record<string, string>;
  translated?: Record<string, string>;
  warning?: string;
  errorCode?: string;
};

const automaticTranslationStatuses = new Map<string, AutomaticEnTranslationStatus>();
const automaticTranslationListeners = new Map<
  string,
  Set<(status: AutomaticEnTranslationStatus) => void>
>();

function setAutomaticTranslationStatus(pageId: string, status: AutomaticEnTranslationStatus): void {
  automaticTranslationStatuses.set(pageId, status);
  for (const listener of automaticTranslationListeners.get(pageId) ?? []) {
    listener(status);
  }
}

export function getAutomaticEnTranslationStatus(
  pageId: string,
): AutomaticEnTranslationStatus | null {
  return automaticTranslationStatuses.get(pageId) ?? null;
}

export function subscribeAutomaticEnTranslationStatus(
  pageId: string,
  listener: (status: AutomaticEnTranslationStatus) => void,
): () => void {
  const listeners = automaticTranslationListeners.get(pageId) ?? new Set();
  listeners.add(listener);
  automaticTranslationListeners.set(pageId, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) automaticTranslationListeners.delete(pageId);
  };
}

export function isAutomaticEnTranslationCoolingDown(
  metadata: TranslationFieldMetadata | undefined,
  sourceHash: string,
  now = Date.now(),
): boolean {
  if (metadata?.attemptSourceHash !== sourceHash || typeof metadata.attemptedAt !== "string") {
    return false;
  }
  const attemptedAt = Date.parse(metadata.attemptedAt);
  if (!Number.isFinite(attemptedAt)) return false;
  const elapsed = now - attemptedAt;
  return elapsed >= 0 && elapsed < AUTOMATIC_EN_TRANSLATION_COOLDOWN_MS;
}

function canonicalWorkingPage(page: CmsPage): CmsPage {
  const remapped = remapEnFieldDraftsToCanonicalPaths(page);
  return {
    ...page,
    enFieldDrafts: remapped.enFieldDrafts,
    enFieldDraftSources: remapped.enFieldDraftSources,
    enFieldDraftMeta: remapped.enFieldDraftMeta ?? page.enFieldDraftMeta,
  };
}

function collectEligibleTranslationFields(input: {
  page: CmsPage;
  includeStates: Array<"missing" | "blank" | "stale" | "override_removed">;
  automatic: boolean;
  candidates?: Record<string, string>;
  now: number;
}): { page: CmsPage; fields: TranslationSelection[] } {
  const page = canonicalWorkingPage(input.page);
  const selected = selectTranslateMissingFromPage(page, input.includeStates);
  const fields: TranslationSelection[] = [];

  for (const field of selected) {
    const currentEn = page.enFieldDrafts?.[field.path];
    const metadata = page.enFieldDraftMeta?.[field.path];
    const sourceHash = createTranslationSourceHash(field.sourceValue);
    if ((currentEn ?? "").trim()) continue;
    if (metadata?.status === "intentional_blank") continue;
    if (input.candidates) {
      const candidateSource = input.candidates[field.path];
      if (candidateSource == null || createTranslationSourceHash(candidateSource) !== sourceHash) {
        continue;
      }
    }
    if (input.automatic && isAutomaticEnTranslationCoolingDown(metadata, sourceHash, input.now)) {
      continue;
    }
    fields.push({ ...field, sourceHash });
  }

  return { page, fields };
}

async function requestTranslationBatches(
  fields: Record<string, string>,
): Promise<TranslationBatchResult[]> {
  const chunks = chunkRecordByBudget(fields, {
    maxItems: EN_TRANSLATION_BATCH_MAX_ITEMS,
    maxChars: EN_TRANSLATION_BATCH_MAX_CHARS,
  });
  return Promise.all(
    chunks.map(async (chunk): Promise<TranslationBatchResult> => {
      const attempted = filterNonEmptyTranslateFields(chunk);
      try {
        const response = await translateNlToEn({
          data: { fields: attempted, maxCharsPerField: 4000 },
        });
        if (!response.ok) {
          return {
            attempted,
            warning: response.error,
            errorCode: response.code,
          };
        }
        return {
          attempted,
          translated: response.result.fields,
        };
      } catch (error) {
        return {
          attempted,
          warning: error instanceof Error ? error.message : "Onbekende fout",
          errorCode: "unknown",
        };
      }
    }),
  );
}

function markTranslationPending(
  pageId: string,
  selected: TranslationSelection[],
  now: number,
): TranslationSelection[] {
  const state = read();
  const current = editablePage(state, pageId);
  if (!current) return [];
  const next = canonicalWorkingPage(current);
  const nlFields = collectPageNlFieldDraftMap(next);
  const metadata: Record<string, TranslationFieldMetadata> = {
    ...(next.enFieldDraftMeta ?? {}),
  };
  const pending: TranslationSelection[] = [];
  const attemptedAt = new Date(now).toISOString();

  for (const field of selected) {
    const currentSource = nlFields[field.path]?.trim() ?? "";
    const currentMeta = metadata[field.path];
    if (
      !currentSource ||
      createTranslationSourceHash(currentSource) !== field.sourceHash ||
      (next.enFieldDrafts?.[field.path] ?? "").trim() ||
      currentMeta?.status === "intentional_blank"
    ) {
      continue;
    }
    const pendingMeta: TranslationFieldMetadata = {
      ...currentMeta,
      status: "translation_pending",
      attemptSourceHash: field.sourceHash,
      attemptedAt,
    };
    delete pendingMeta.attemptErrorCode;
    metadata[field.path] = pendingMeta;
    pending.push({ ...field, sourceValue: currentSource });
  }

  if (pending.length > 0) {
    next.enFieldDraftMeta = metadata;
    next.updatedAt = Date.now();
    next.version += 1;
    commitDraftPage(state, pageId, next);
  }
  return pending;
}

function settleTranslationChunk(input: {
  pageId: string;
  attempted: Record<string, string>;
  translated?: Record<string, string>;
  errorCode?: string;
}): { translated: number; failed: number; skipped: number } {
  const state = read();
  const current = editablePage(state, input.pageId);
  if (!current) {
    return { translated: 0, failed: 0, skipped: Object.keys(input.attempted).length };
  }
  const next = canonicalWorkingPage(current);
  const drafts = { ...(next.enFieldDrafts ?? {}) };
  const sources = { ...(next.enFieldDraftSources ?? {}) };
  const metadata: Record<string, TranslationFieldMetadata> = {
    ...(next.enFieldDraftMeta ?? {}),
  };
  const nlFields = collectPageNlFieldDraftMap(next);
  let translated = 0;
  let failed = 0;
  let skipped = 0;
  let changed = false;

  for (const [path, attemptedSource] of Object.entries(input.attempted)) {
    const attemptedHash = createTranslationSourceHash(attemptedSource);
    const currentMeta = metadata[path];
    const ownsAttempt =
      currentMeta?.status === "translation_pending" &&
      currentMeta.attemptSourceHash === attemptedHash;
    if (!ownsAttempt) {
      skipped += 1;
      continue;
    }

    const currentSource = nlFields[path]?.trim() ?? "";
    if (!currentSource || createTranslationSourceHash(currentSource) !== attemptedHash) {
      delete metadata[path];
      changed = true;
      skipped += 1;
      continue;
    }

    // Re-read after the provider request: any manual EN entered in-flight wins.
    if ((drafts[path] ?? "").trim()) {
      delete metadata[path];
      changed = true;
      skipped += 1;
      continue;
    }

    const en = input.translated?.[path]?.trim() ?? "";
    if (!input.errorCode && en) {
      drafts[path] = en;
      sources[path] = currentSource;
      metadata[path] = {
        status: "machine_translated",
        sourceHash: attemptedHash,
        translatedAt: new Date().toISOString(),
        provider: "groq",
      };
      translated += 1;
      changed = true;
      continue;
    }

    metadata[path] = {
      ...currentMeta,
      status: "translation_failed",
      attemptSourceHash: attemptedHash,
      attemptErrorCode: input.errorCode ?? "invalid_result",
    };
    failed += 1;
    changed = true;
  }

  if (changed) {
    next.enFieldDrafts = drafts;
    next.enFieldDraftSources = sources;
    next.enFieldDraftMeta = metadata;
    next.updatedAt = Date.now();
    next.version += 1;
    commitDraftPage(state, input.pageId, next);
  }
  return { translated, failed, skipped };
}

async function runMissingEnTranslation(input: {
  pageId: string;
  includeStates: Array<"missing" | "blank" | "stale" | "override_removed">;
  automatic: boolean;
  candidates?: Record<string, string>;
  now?: number;
}): Promise<TranslationRunResult> {
  const now = input.now ?? Date.now();
  const state = read();
  const editable = editablePage(state, input.pageId);
  if (!editable) return { ok: false, reason: "Pagina niet gevonden." };
  const eligible = collectEligibleTranslationFields({
    page: editable,
    includeStates: input.includeStates,
    automatic: input.automatic,
    candidates: input.candidates,
    now,
  });
  if (eligible.fields.length === 0) {
    return { ok: true, translated: 0, failed: 0, skipped: 0 };
  }

  const pending = markTranslationPending(input.pageId, eligible.fields, now);
  if (pending.length === 0) {
    return {
      ok: true,
      translated: 0,
      failed: 0,
      skipped: eligible.fields.length,
    };
  }

  if (input.automatic) {
    setAutomaticTranslationStatus(input.pageId, {
      state: "translating",
      translated: 0,
      failed: 0,
      skipped: 0,
      updatedAt: Date.now(),
    });
  }

  const toTranslate = Object.fromEntries(pending.map((field) => [field.path, field.sourceValue]));
  let translated = 0;
  let failed = 0;
  let skipped = eligible.fields.length - pending.length;
  let warning: string | undefined;
  let errorCode: string | undefined;

  const batches = await requestTranslationBatches(toTranslate);
  for (const batch of batches) {
    if (batch.warning) warning = batch.warning;
    if (batch.errorCode) errorCode = batch.errorCode;
    const outcome = settleTranslationChunk({
      pageId: input.pageId,
      attempted: batch.attempted,
      translated: batch.translated,
      errorCode: batch.errorCode,
    });
    translated += outcome.translated;
    failed += outcome.failed;
    skipped += outcome.skipped;
  }

  return { ok: true, translated, failed, skipped, warning, errorCode };
}

export type PublishEnTranslationResult = {
  page: CmsPage;
  translated: number;
  failed: number;
  skipped: number;
  providerCalls: number;
  warning?: string;
  errorCode?: string;
};

/**
 * Translate the complete canonical page model before the single publish write.
 * No DOM/editor registry participates: eligibility comes from the schema walker.
 */
export async function translateMissingEnForPublish(
  pageId: string,
  page: CmsPage,
  candidates: Record<string, string>,
  now = Date.now(),
): Promise<PublishEnTranslationResult> {
  const eligible = collectEligibleTranslationFields({
    page,
    includeStates: ["missing", "blank", "override_removed"],
    automatic: true,
    candidates,
    now,
  });
  const output = structuredClone(eligible.page);
  if (eligible.fields.length === 0) {
    setAutomaticTranslationStatus(pageId, {
      state: "completed",
      translated: 0,
      failed: 0,
      skipped: 0,
      updatedAt: Date.now(),
    });
    return {
      page: output,
      translated: 0,
      failed: 0,
      skipped: 0,
      providerCalls: 0,
    };
  }

  setAutomaticTranslationStatus(pageId, {
    state: "translating",
    translated: 0,
    failed: 0,
    skipped: 0,
    updatedAt: Date.now(),
  });

  const attempted = Object.fromEntries(
    eligible.fields.map((field) => [field.path, field.sourceValue]),
  );
  const batches = await requestTranslationBatches(attempted);
  const latest = editablePage(read(), pageId);
  const current = canonicalWorkingPage(latest ?? output);
  const currentNl = collectPageNlFieldDraftMap(current);
  const drafts = { ...(output.enFieldDrafts ?? {}) };
  const sources = { ...(output.enFieldDraftSources ?? {}) };
  const metadata: Record<string, TranslationFieldMetadata> = {
    ...(output.enFieldDraftMeta ?? {}),
  };
  let translated = 0;
  let failed = 0;
  let skipped = 0;
  let warning: string | undefined;
  let errorCode: string | undefined;
  const attemptedAt = new Date(now).toISOString();

  for (const batch of batches) {
    if (batch.warning) warning = batch.warning;
    if (batch.errorCode) errorCode = batch.errorCode;
    for (const [path, source] of Object.entries(batch.attempted)) {
      const sourceHash = createTranslationSourceHash(source);
      const currentSource = currentNl[path]?.trim() ?? "";
      const currentEn = current.enFieldDrafts?.[path] ?? "";
      const currentMeta = current.enFieldDraftMeta?.[path];

      if (currentMeta?.status === "intentional_blank") {
        delete drafts[path];
        delete sources[path];
        metadata[path] = currentMeta;
        skipped += 1;
        continue;
      }
      if (currentEn.trim()) {
        drafts[path] = currentEn;
        sources[path] = current.enFieldDraftSources?.[path] ?? currentSource;
        metadata[path] = currentMeta ?? {
          status: "manually_translated",
          sourceHash: createTranslationSourceHash(currentSource),
          translatedAt: new Date().toISOString(),
        };
        skipped += 1;
        continue;
      }
      if (!currentSource || createTranslationSourceHash(currentSource) !== sourceHash) {
        skipped += 1;
        continue;
      }

      const en = batch.translated?.[path]?.trim() ?? "";
      if (!batch.errorCode && en) {
        drafts[path] = en;
        sources[path] = currentSource;
        metadata[path] = {
          status: "machine_translated",
          sourceHash,
          translatedAt: new Date().toISOString(),
          provider: "groq",
        };
        translated += 1;
      } else {
        metadata[path] = {
          status: "translation_failed",
          attemptSourceHash: sourceHash,
          attemptedAt,
          attemptErrorCode: batch.errorCode ?? "invalid_result",
        };
        failed += 1;
      }
    }
  }

  output.enFieldDrafts = drafts;
  output.enFieldDraftSources = sources;
  output.enFieldDraftMeta = metadata;
  if (failed > 0 && !warning) {
    warning = `${failed} ontbrekende EN-veld(en) konden niet worden vertaald.`;
  }
  setAutomaticTranslationStatus(pageId, {
    state: failed > 0 ? "failed" : "completed",
    translated,
    failed,
    skipped,
    updatedAt: Date.now(),
    errorCode,
  });
  return {
    page: output,
    translated,
    failed,
    skipped,
    providerCalls: batches.length,
    warning,
    errorCode,
  };
}

export async function runAutomaticEnTranslation(
  pageId: string,
  candidates?: Record<string, string>,
  now?: number,
): Promise<TranslationRunResult> {
  const result = await runMissingEnTranslation({
    pageId,
    includeStates: ["missing", "blank", "override_removed"],
    automatic: true,
    candidates,
    now,
  });
  if (!result.ok) {
    setAutomaticTranslationStatus(pageId, {
      state: "failed",
      translated: 0,
      failed: 0,
      skipped: 0,
      updatedAt: Date.now(),
      errorCode: "page_missing",
    });
    return result;
  }
  setAutomaticTranslationStatus(pageId, {
    state: result.failed > 0 ? "failed" : "completed",
    translated: result.translated,
    failed: result.failed,
    skipped: result.skipped,
    updatedAt: Date.now(),
    errorCode: result.errorCode,
  });
  return result;
}

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
   * Explicit retry bypasses the automatic cooldown. Results remain EN drafts.
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
    return runMissingEnTranslation({
      pageId,
      includeStates,
      automatic: false,
    });
  },

  getAutomaticEnTranslationStatus,
  subscribeAutomaticEnTranslationStatus,

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
  hasEnDraftKeys: boolean;
};

/**
 * Remap and retain existing EN drafts for publish.
 *
 * This synchronous plan never calls Groq. The publish path translates
 * `toTranslate` in bounded bulk requests before its single persistence write.
 */
export function preparePageEnForOpslaan(
  nextPage: CmsPage,
  published: CmsPage,
): OpslaanEnPrepResult {
  // Canonicalize legacy index/colon draft keys onto stable-id discovery paths.
  const remapped = remapEnFieldDraftsToCanonicalPaths(nextPage);
  nextPage.enFieldDrafts = remapped.enFieldDrafts;
  nextPage.enFieldDraftSources = remapped.enFieldDraftSources;
  if (remapped.enFieldDraftMeta) {
    nextPage.enFieldDraftMeta = remapped.enFieldDraftMeta;
  }

  // Missing/blank/empty override_removed stay eligible. Every non-empty EN and
  // intentional_blank is retained and excluded from the provider.
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

  const toTranslate = filterNonEmptyTranslateFields(plan.toTranslate);
  nextPage.enFieldDrafts = plan.retainedDrafts;
  nextPage.enFieldDraftSources = plan.retainedSources;

  // Keep localeContent.en SEO bag available whenever EN drafts exist (publish gate).
  const hasEnDraftKeys = Object.keys(plan.retainedDrafts).length > 0;
  if (hasEnDraftKeys || nextPage.localeContent?.en) {
    Object.assign(nextPage, ensureEnglishLocaleContentFromDrafts(nextPage));
  }

  return { nextPage, toTranslate, hasEnDraftKeys };
}
