/**
 * Dry-run repair planner for EN field drafts.
 * Never writes — callers must review and apply explicitly.
 */

import {
  remapEnFieldDraftsToCanonicalPaths,
} from "./en-field-sync";
import {
  selectTranslateMissingFromPage,
  type TranslateMissingFieldSelection,
} from "./translation-coverage";
import type { CmsPage } from "./types";

export type TranslationRepairAction =
  | {
      kind: "remap_path";
      fromPath: string;
      toPath: string;
      draftValue: string;
    }
  | {
      kind: "translate_missing";
      path: string;
      sourceValue: string;
      state: TranslateMissingFieldSelection["state"];
    }
  | {
      kind: "prune_orphan";
      path: string;
      draftValue: string;
    };

export type TranslationRepairDryRun = {
  pageId: string;
  remappedCount: number;
  orphanCount: number;
  translateMissingCount: number;
  actions: TranslationRepairAction[];
  /** Canonical drafts after remap only (no AI fills). */
  previewDrafts: Record<string, string>;
  previewSources: Record<string, string>;
};

/**
 * Plan field-path remaps + missing-field translations without mutating the page.
 */
export function planTranslationRepairDryRun(page: CmsPage): TranslationRepairDryRun {
  const remapped = remapEnFieldDraftsToCanonicalPaths(page);
  const previewPage: CmsPage = {
    ...page,
    enFieldDrafts: remapped.enFieldDrafts,
    enFieldDraftSources: remapped.enFieldDraftSources,
    enFieldDraftMeta: remapped.enFieldDraftMeta ?? page.enFieldDraftMeta,
  };

  const actions: TranslationRepairAction[] = [];
  const draftsIn = page.enFieldDrafts ?? {};
  const canonicalValues = new Map(
    Object.entries(remapped.enFieldDrafts).map(([path, value]) => [value, path] as const),
  );

  for (const [path, value] of Object.entries(draftsIn)) {
    if (path in remapped.enFieldDrafts) continue;
    const toPath = canonicalValues.get(value);
    if (toPath && toPath !== path) {
      actions.push({ kind: "remap_path", fromPath: path, toPath, draftValue: value });
    } else {
      actions.push({ kind: "prune_orphan", path, draftValue: value });
    }
  }

  const missing = selectTranslateMissingFromPage(previewPage, ["missing", "blank"]);
  for (const field of missing) {
    actions.push({
      kind: "translate_missing",
      path: field.path,
      sourceValue: field.sourceValue,
      state: field.state,
    });
  }

  return {
    pageId: page.id,
    remappedCount: actions.filter((a) => a.kind === "remap_path").length,
    orphanCount: actions.filter((a) => a.kind === "prune_orphan").length,
    translateMissingCount: actions.filter((a) => a.kind === "translate_missing").length,
    actions,
    previewDrafts: remapped.enFieldDrafts,
    previewSources: remapped.enFieldDraftSources,
  };
}
