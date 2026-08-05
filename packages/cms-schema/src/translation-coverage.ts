/**
 * Field-level EN translation coverage scanner.
 * Does not invent translations — reports which fields still need work.
 */

import { collectPageNlFieldDraftMap } from "./en-field-sync";
import type { CmsPage } from "./types";
import {
  classifyTranslationField,
  createTranslationSourceHash,
  translationFieldIsResolved,
  type TranslationFieldMetadata,
  type TranslationFieldState,
} from "./translation-field";

export type TranslationFieldCoverage = {
  path: string;
  blockId?: string;
  blockType?: string;
  label: string;
  state: TranslationFieldState;
  sourcePreview?: string;
  targetPreview?: string;
  sourceHash?: string;
  translatedSourceHash?: string;
};

export type TranslationCoverageResult = {
  totalRequired: number;
  translated: number;
  missing: number;
  blank: number;
  stale: number;
  invalid: number;
  intentionalBlank: number;
  /** Cleared EN overrides (NL fallback; resolved for publish completeness). */
  overrideRemoved: number;
  sourceEmpty: number;
  fields: TranslationFieldCoverage[];
  /** True when every required field is resolved (stale allowed until optionally refreshed). */
  complete: boolean;
};

export type TranslateMissingFieldSelection = {
  path: string;
  sourceValue: string;
  state: TranslationFieldState;
};

function preview(value: unknown, max = 80): string | undefined {
  if (typeof value !== "string") return undefined;
  const t = value.trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function labelFromPath(path: string): string {
  const parts = path.split(":");
  return parts[parts.length - 1] ?? path;
}

function blockMeta(
  page: CmsPage,
  path: string,
): { blockId?: string; blockType?: string } {
  if (!path.startsWith("block:")) return {};
  const blockId = path.split(":")[1];
  if (!blockId) return {};
  const block = page.blocks?.find((b) => b.id === blockId);
  return { blockId, blockType: block?.type };
}

function fieldMetadataForPath(
  page: CmsPage,
  path: string,
  override?: Record<string, TranslationFieldMetadata>,
): TranslationFieldMetadata | undefined {
  return override?.[path] ?? page.enFieldDraftMeta?.[path];
}

/**
 * Scan every discovered NL source field against EN overlays + optional metadata.
 */
export function scanTranslationCoverage(input: {
  page: CmsPage;
  /** Optional per-path metadata (status / sourceHash). Overrides page.enFieldDraftMeta. */
  fieldMetadata?: Record<string, TranslationFieldMetadata>;
}): TranslationCoverageResult {
  const nlFields = collectPageNlFieldDraftMap(input.page);
  const drafts = input.page.enFieldDrafts ?? {};
  const sources = input.page.enFieldDraftSources ?? {};

  const list: TranslationFieldCoverage[] = [];

  let translated = 0;
  let missing = 0;
  let blank = 0;
  let stale = 0;
  let invalid = 0;
  let intentionalBlank = 0;
  let overrideRemoved = 0;
  let sourceEmpty = 0;
  let totalRequired = 0;

  for (const [path, nlRaw] of Object.entries(nlFields)) {
    const sourceHash = createTranslationSourceHash(nlRaw);
    const sourceBaseline = sources[path];
    const meta = fieldMetadataForPath(input.page, path, input.fieldMetadata);
    const translatedSourceHash = sourceBaseline
      ? createTranslationSourceHash(sourceBaseline)
      : meta?.sourceHash;
    const state = classifyTranslationField({
      path,
      sourceLocale: "nl",
      targetLocale: "en",
      sourceValue: nlRaw,
      targetValue: Object.prototype.hasOwnProperty.call(drafts, path)
        ? drafts[path]
        : undefined,
      sourceHash,
      translatedSourceHash,
      metadata: meta,
    });

    if (state !== "source_empty" && state !== "not_translatable") {
      totalRequired += 1;
    }
    if (state === "source_empty") sourceEmpty += 1;
    if (state === "missing") missing += 1;
    if (state === "blank") blank += 1;
    if (state === "stale") stale += 1;
    if (state === "invalid") invalid += 1;
    if (state === "intentional_blank") intentionalBlank += 1;
    if (state === "override_removed") overrideRemoved += 1;
    if (state === "machine_translated" || state === "manually_translated") {
      translated += 1;
    }

    const { blockId, blockType } = blockMeta(input.page, path);
    list.push({
      path,
      blockId,
      blockType,
      label: labelFromPath(path),
      state,
      sourcePreview: preview(nlRaw),
      targetPreview: preview(drafts[path]),
      sourceHash,
      translatedSourceHash,
    });
  }

  // Blocking incompleteness: missing / blank / invalid (stale is soft).
  const blocking = list.filter(
    (f) =>
      f.state === "missing" ||
      f.state === "blank" ||
      f.state === "invalid",
  );

  const complete =
    blocking.length === 0 &&
    (totalRequired === 0 ||
      list
        .filter((f) => f.state !== "source_empty" && f.state !== "not_translatable")
        .every((f) => translationFieldIsResolved(f.state) || f.state === "stale"));

  return {
    totalRequired,
    translated,
    missing,
    blank,
    stale,
    invalid,
    intentionalBlank,
    overrideRemoved,
    sourceEmpty,
    fields: list,
    complete,
  };
}

type TranslateMissingIncludeState = "missing" | "blank" | "stale" | "override_removed";

/** Fields to send to the translation provider for “translate missing”. */
export function selectFieldsForTranslateMissing(input: {
  coverage: TranslationCoverageResult;
  nlFields: Record<string, string>;
  /**
   * Default includes `override_removed` so “vertaal ontbrekende” (and Opslaan via
   * `planEnFieldDraftSync`) can refill empty cleared overrides without another clear.
   */
  includeStates?: TranslateMissingIncludeState[];
}): TranslateMissingFieldSelection[] {
  const include = new Set<TranslateMissingIncludeState>(
    input.includeStates ?? ["missing", "blank", "override_removed"],
  );
  const out: TranslateMissingFieldSelection[] = [];
  for (const field of input.coverage.fields) {
    if (!include.has(field.state as TranslateMissingIncludeState)) continue;
    const sourceValue = input.nlFields[field.path]?.trim() ?? "";
    if (!sourceValue) continue;
    out.push({ path: field.path, sourceValue, state: field.state });
  }
  return out;
}

export function selectTranslateMissingFromPage(
  page: CmsPage,
  includeStates?: TranslateMissingIncludeState[],
): TranslateMissingFieldSelection[] {
  const coverage = scanTranslationCoverage({ page });
  const nlFields = collectPageNlFieldDraftMap(page);
  return selectFieldsForTranslateMissing({ coverage, nlFields, includeStates });
}

/** True when EN publish should be blocked until missing/blank/invalid are resolved. */
export function enPublishBlockedByCoverage(coverage: TranslationCoverageResult): boolean {
  return coverage.missing > 0 || coverage.blank > 0 || coverage.invalid > 0;
}
