/**
 * Ephemeral editor draft history (E11).
 * Not persisted to CMS schemas, localStorage, or published payloads.
 */
import type { CmsMutation } from "./edit-protocol";
import type { PageDraft } from "./types";

export const CMS_EDITOR_HISTORY_LIMIT = 50;

export type CmsHistoryKind =
  | "TEXT_UPDATED"
  | "MEDIA_REPLACED"
  | "CTA_UPDATED"
  | "SECTION_ADDED"
  | "SECTION_DELETED"
  | "SECTION_DUPLICATED"
  | "SECTION_MOVED"
  | "SECTION_TOGGLED"
  | "FORM_FIELD_ADDED"
  | "FORM_FIELD_DELETED"
  | "FORM_FIELD_MOVED"
  | "FORM_FIELD_UPDATED"
  | "EN_FIELD_UPDATED"
  | "PAGE_META_UPDATED"
  | "CONTENT_UPDATED";

/** Serializable draft snapshot for undo/redo (null = no draft / published baseline). */
export type CmsDraftSnapshot = PageDraft | null;

export type CmsHistoryEntry = {
  id: string;
  kind: CmsHistoryKind;
  timestamp: number;
  label: string;
  /** Forward mutation that produced `after` (debug / labeling). */
  mutation: CmsMutation;
  before: CmsDraftSnapshot;
  after: CmsDraftSnapshot;
};

export type CmsEditorHistoryState = {
  undoStack: CmsHistoryEntry[];
  redoStack: CmsHistoryEntry[];
};

export function createEmptyEditorHistory(): CmsEditorHistoryState {
  return { undoStack: [], redoStack: [] };
}

export function createHistoryEntryId(): string {
  return `hist_${Math.random().toString(36).slice(2, 12)}`;
}

/** Classify a CmsMutation into a history kind + Dutch label. */
export function classifyCmsHistoryMutation(
  mutation: CmsMutation,
  opts?: { before?: CmsDraftSnapshot; after?: CmsDraftSnapshot },
): {
  kind: CmsHistoryKind;
  label: string;
} {
  if (mutation.kind === "enField") {
    return { kind: "EN_FIELD_UPDATED", label: "Engelse tekst gewijzigd" };
  }
  if (mutation.kind === "pageMeta") {
    return { kind: "PAGE_META_UPDATED", label: "Paginagegevens gewijzigd" };
  }
  if (mutation.kind === "layout") {
    if (mutation.op === "add") return { kind: "SECTION_ADDED", label: "Sectie toegevoegd" };
    if (mutation.op === "remove") return { kind: "SECTION_DELETED", label: "Sectie verwijderd" };
    if (mutation.op === "duplicate") {
      return { kind: "SECTION_DUPLICATED", label: "Sectie gedupliceerd" };
    }
    if (mutation.op === "move") return { kind: "SECTION_MOVED", label: "Sectie verplaatst" };
    if (mutation.op === "toggle") return { kind: "SECTION_TOGGLED", label: "Sectie zichtbaarheid" };
    return { kind: "CONTENT_UPDATED", label: "Indeling gewijzigd" };
  }
  if (mutation.kind === "section" || mutation.kind === "block") {
    const patch = mutation.patch;
    const keys = Object.keys(patch);
    if (keys.length === 1 && (keys[0] === "fields" || keys[0]?.endsWith(".fields"))) {
      return refineFormFieldsHistory(opts?.before, opts?.after, mutation);
    }
    if (keys.some((k) => k === "image" || k.endsWith(".image") || k === "media" || k.endsWith(".media"))) {
      return { kind: "MEDIA_REPLACED", label: "Afbeelding vervangen" };
    }
    if (
      keys.some(
        (k) =>
          k === "cta" ||
          k === "primaryCta" ||
          k === "secondaryCta" ||
          k === "button" ||
          k.endsWith(".cta") ||
          k.endsWith("Cta") ||
          k.endsWith(".button"),
      )
    ) {
      return { kind: "CTA_UPDATED", label: "Knop gewijzigd" };
    }
    if (
      keys.some(
        (k) =>
          k === "heading" ||
          k === "body" ||
          k === "eyebrow" ||
          k === "title" ||
          k === "text" ||
          k === "headingAccent" ||
          k.includes("headingAccent") ||
          k.endsWith(".label") ||
          k.endsWith(".placeholder"),
      )
    ) {
      return { kind: "TEXT_UPDATED", label: "Tekst gewijzigd" };
    }
    return { kind: "CONTENT_UPDATED", label: "Inhoud gewijzigd" };
  }
  return { kind: "CONTENT_UPDATED", label: "Inhoud gewijzigd" };
}

function fieldIdsFromDraft(draft: CmsDraftSnapshot, mutation: CmsMutation): string[] {
  if (!draft || mutation.kind !== "section") return [];
  const fromPage =
    draft.page && draft.page.kind === "builtin"
      ? (draft.page.sectionContent?.[mutation.sectionKey] as { fields?: Array<{ id?: string }> } | undefined)
      : undefined;
  const fromSection = draft.sectionContent?.[mutation.sectionKey] as
    | { fields?: Array<{ id?: string }> }
    | undefined;
  const fields = fromPage?.fields ?? fromSection?.fields;
  if (!Array.isArray(fields)) return [];
  return fields.map((f) => (typeof f?.id === "string" ? f.id : "")).filter(Boolean);
}

function refineFormFieldsHistory(
  before: CmsDraftSnapshot | undefined,
  after: CmsDraftSnapshot | undefined,
  mutation: CmsMutation,
): { kind: CmsHistoryKind; label: string } {
  const beforeIds = fieldIdsFromDraft(before ?? null, mutation);
  const afterIds = fieldIdsFromDraft(after ?? null, mutation);
  if (afterIds.length > beforeIds.length) {
    return { kind: "FORM_FIELD_ADDED", label: "Formulierveld toegevoegd" };
  }
  if (afterIds.length < beforeIds.length) {
    return { kind: "FORM_FIELD_DELETED", label: "Formulierveld verwijderd" };
  }
  if (
    beforeIds.length === afterIds.length &&
    beforeIds.some((id, i) => id !== afterIds[i]) &&
    [...beforeIds].sort().join() === [...afterIds].sort().join()
  ) {
    return { kind: "FORM_FIELD_MOVED", label: "Formulierveld verplaatst" };
  }
  return { kind: "FORM_FIELD_UPDATED", label: "Formulierveld gewijzigd" };
}

export function snapshotsEqual(a: CmsDraftSnapshot, b: CmsDraftSnapshot): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  try {
    return JSON.stringify(normalizeSnapshotForCompare(a)) === JSON.stringify(normalizeSnapshotForCompare(b));
  } catch {
    return false;
  }
}

function normalizeSnapshotForCompare(draft: PageDraft): unknown {
  const { editorMeta: _drop, ...rest } = draft;
  void _drop;
  return rest;
}

/**
 * Push a completed mutation onto the undo stack; clears redo (branching).
 * No-ops when before === after.
 */
export function pushEditorHistory(
  state: CmsEditorHistoryState,
  entry: Omit<CmsHistoryEntry, "id" | "timestamp"> & {
    id?: string;
    timestamp?: number;
  },
  limit = CMS_EDITOR_HISTORY_LIMIT,
): CmsEditorHistoryState {
  if (snapshotsEqual(entry.before, entry.after)) {
    return state;
  }
  const nextEntry: CmsHistoryEntry = {
    id: entry.id ?? createHistoryEntryId(),
    kind: entry.kind,
    timestamp: entry.timestamp ?? Date.now(),
    label: entry.label,
    mutation: entry.mutation,
    before: entry.before,
    after: entry.after,
  };
  const undoStack = [...state.undoStack, nextEntry];
  while (undoStack.length > limit) {
    undoStack.shift();
  }
  return { undoStack, redoStack: [] };
}

export type HistoryApplyResult =
  | { ok: true; state: CmsEditorHistoryState; restore: CmsDraftSnapshot }
  | { ok: false; reason: string; state: CmsEditorHistoryState };

/** Pop undo → apply `before`; move entry to redo. */
export function undoEditorHistory(state: CmsEditorHistoryState): HistoryApplyResult {
  if (state.undoStack.length === 0) {
    return { ok: false, reason: "Niets om ongedaan te maken", state };
  }
  const entry = state.undoStack[state.undoStack.length - 1]!;
  return {
    ok: true,
    restore: entry.before,
    state: {
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, entry],
    },
  };
}

/** Pop redo → apply `after`; move entry back to undo. */
export function redoEditorHistory(state: CmsEditorHistoryState): HistoryApplyResult {
  if (state.redoStack.length === 0) {
    return { ok: false, reason: "Niets om opnieuw uit te voeren", state };
  }
  const entry = state.redoStack[state.redoStack.length - 1]!;
  return {
    ok: true,
    restore: entry.after,
    state: {
      undoStack: [...state.undoStack, entry],
      redoStack: state.redoStack.slice(0, -1),
    },
  };
}

export function canUndo(state: CmsEditorHistoryState): boolean {
  return state.undoStack.length > 0;
}

export function canRedo(state: CmsEditorHistoryState): boolean {
  return state.redoStack.length > 0;
}
