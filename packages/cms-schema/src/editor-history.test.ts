import { describe, expect, it } from "vitest";
import type { CmsMutation } from "./edit-protocol";
import {
  CMS_EDITOR_HISTORY_LIMIT,
  canRedo,
  canUndo,
  classifyCmsHistoryMutation,
  createEmptyEditorHistory,
  pushEditorHistory,
  redoEditorHistory,
  snapshotsEqual,
  undoEditorHistory,
  type CmsDraftSnapshot,
  type CmsHistoryEntry,
} from "./editor-history";

const textMutation = (value: string): CmsMutation => ({
  kind: "section",
  sectionKey: "home.hero",
  patch: { heading: value },
});

function entry(
  before: CmsDraftSnapshot,
  after: CmsDraftSnapshot,
  mutation: CmsMutation = textMutation("x"),
): Omit<CmsHistoryEntry, "id" | "timestamp"> {
  const { kind, label } = classifyCmsHistoryMutation(mutation, { before, after });
  return { kind, label, mutation, before, after };
}

function draftWithHeading(heading: string): CmsDraftSnapshot {
  return {
    overrides: {},
    page: {
      id: "page_home",
      kind: "builtin",
      isCustom: false,
      pageKey: "home",
      slug: "/",
      title: "Home",
      description: "",
      inNav: true,
      blocks: [],
      layout: [],
      layoutVersion: 1,
      sectionContent: {
        "home.hero": { heading },
      },
      updatedAt: 1,
      version: 1,
    } as never,
  };
}

describe("editor-history stack", () => {
  it("starts empty", () => {
    const state = createEmptyEditorHistory();
    expect(canUndo(state)).toBe(false);
    expect(canRedo(state)).toBe(false);
    expect(undoEditorHistory(state).ok).toBe(false);
    expect(redoEditorHistory(state).ok).toBe(false);
  });

  it("edit → undo restores before; redo restores after", () => {
    const a = draftWithHeading("A");
    const b = draftWithHeading("B");
    let state = pushEditorHistory(createEmptyEditorHistory(), entry(a, b, textMutation("B")));
    expect(canUndo(state)).toBe(true);

    const undone = undoEditorHistory(state);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.restore).toEqual(a);
    state = undone.state;
    expect(canRedo(state)).toBe(true);

    const redone = redoEditorHistory(state);
    expect(redone.ok).toBe(true);
    if (!redone.ok) return;
    expect(redone.restore).toEqual(b);
  });

  it("edit A → edit B → undo B leaves A on stack", () => {
    const a = draftWithHeading("A");
    const b = draftWithHeading("B");
    const c = draftWithHeading("C");
    let state = pushEditorHistory(createEmptyEditorHistory(), entry(null, a));
    state = pushEditorHistory(state, entry(a, b));
    state = pushEditorHistory(state, entry(b, c));

    const undone = undoEditorHistory(state);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    expect(undone.restore).toEqual(b);
    expect(undone.state.undoStack).toHaveLength(2);
  });

  it("undo then new edit clears redo (branching)", () => {
    const a = draftWithHeading("A");
    const b = draftWithHeading("B");
    const c = draftWithHeading("C");
    let state = pushEditorHistory(createEmptyEditorHistory(), entry(null, a));
    state = pushEditorHistory(state, entry(a, b));
    const undone = undoEditorHistory(state);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    state = undone.state;
    expect(canRedo(state)).toBe(true);

    state = pushEditorHistory(state, entry(a, c));
    expect(canRedo(state)).toBe(false);
    expect(state.undoStack.map((e) => e.after)).toEqual([a, c]);
  });

  it("no-ops when before === after", () => {
    const a = draftWithHeading("A");
    const state = pushEditorHistory(createEmptyEditorHistory(), entry(a, structuredClone(a)));
    expect(state.undoStack).toHaveLength(0);
  });

  it("bounds history to CMS_EDITOR_HISTORY_LIMIT and drops oldest", () => {
    let state = createEmptyEditorHistory();
    for (let i = 0; i < CMS_EDITOR_HISTORY_LIMIT + 5; i++) {
      state = pushEditorHistory(
        state,
        entry(draftWithHeading(`h${i}`), draftWithHeading(`h${i + 1}`)),
      );
    }
    expect(state.undoStack).toHaveLength(CMS_EDITOR_HISTORY_LIMIT);
    expect(state.undoStack[0]?.after).toEqual(draftWithHeading("h6"));
  });

  it("history execution helpers do not push entries themselves", () => {
    const a = draftWithHeading("A");
    const b = draftWithHeading("B");
    let state = pushEditorHistory(createEmptyEditorHistory(), entry(a, b));
    const beforeLen = state.undoStack.length + state.redoStack.length;
    const undone = undoEditorHistory(state);
    expect(undone.ok).toBe(true);
    if (!undone.ok) return;
    state = undone.state;
    expect(state.undoStack.length + state.redoStack.length).toBe(beforeLen);
    const redone = redoEditorHistory(state);
    expect(redone.ok).toBe(true);
    if (!redone.ok) return;
    expect(redone.state.undoStack.length + redone.state.redoStack.length).toBe(beforeLen);
  });
});

describe("editor-history classification", () => {
  it("classifies quoteRequestForm field presentation patches as FORM_FIELD_UPDATED", () => {
    expect(
      classifyCmsHistoryMutation({
        kind: "block",
        blockId: "b1",
        patch: { "tabs.0.fields": [{ id: "quote-glass-windows", label: "Hoeveel ramen?" }] },
      }).kind,
    ).toBe("FORM_FIELD_UPDATED");
  });

  it("classifies text, media, cta, layout, and form field ops", () => {
    expect(classifyCmsHistoryMutation(textMutation("Hi")).kind).toBe("TEXT_UPDATED");
    expect(
      classifyCmsHistoryMutation({
        kind: "section",
        sectionKey: "home.hero",
        patch: { image: { src: "/a.jpg" } },
      }).kind,
    ).toBe("MEDIA_REPLACED");
    expect(
      classifyCmsHistoryMutation({
        kind: "section",
        sectionKey: "home.hero",
        patch: { primaryCta: { label: "X", href: "/" } },
      }).kind,
    ).toBe("CTA_UPDATED");
    expect(
      classifyCmsHistoryMutation({
        kind: "layout",
        op: "add",
        blockType: "cta",
        atIndex: 1,
      }).kind,
    ).toBe("SECTION_ADDED");
    expect(
      classifyCmsHistoryMutation({ kind: "layout", op: "remove", layoutItemId: "x" }).kind,
    ).toBe("SECTION_DELETED");
    expect(
      classifyCmsHistoryMutation({ kind: "layout", op: "duplicate", blockId: "b1" }).kind,
    ).toBe("SECTION_DUPLICATED");
    expect(
      classifyCmsHistoryMutation({
        kind: "layout",
        op: "move",
        layoutItemId: "x",
        direction: "up",
      }).kind,
    ).toBe("SECTION_MOVED");
  });

  it("refines form field add/delete/move from snapshots", () => {
    const mutation: CmsMutation = {
      kind: "section",
      sectionKey: "contact.form",
      patch: { fields: [] },
    };
    const before: CmsDraftSnapshot = {
      overrides: {},
      page: {
        kind: "builtin",
        sectionContent: {
          "contact.form": {
            fields: [
              { id: "a", label: "A" },
              { id: "b", label: "B" },
            ],
          },
        },
      } as never,
    };
    const afterAdd: CmsDraftSnapshot = {
      overrides: {},
      page: {
        kind: "builtin",
        sectionContent: {
          "contact.form": {
            fields: [
              { id: "a", label: "A" },
              { id: "b", label: "B" },
              { id: "c", label: "C" },
            ],
          },
        },
      } as never,
    };
    const afterMove: CmsDraftSnapshot = {
      overrides: {},
      page: {
        kind: "builtin",
        sectionContent: {
          "contact.form": {
            fields: [
              { id: "b", label: "B" },
              { id: "a", label: "A" },
            ],
          },
        },
      } as never,
    };
    const afterDelete: CmsDraftSnapshot = {
      overrides: {},
      page: {
        kind: "builtin",
        sectionContent: {
          "contact.form": {
            fields: [{ id: "a", label: "A" }],
          },
        },
      } as never,
    };

    expect(classifyCmsHistoryMutation(mutation, { before, after: afterAdd }).kind).toBe(
      "FORM_FIELD_ADDED",
    );
    expect(classifyCmsHistoryMutation(mutation, { before, after: afterDelete }).kind).toBe(
      "FORM_FIELD_DELETED",
    );
    expect(classifyCmsHistoryMutation(mutation, { before, after: afterMove }).kind).toBe(
      "FORM_FIELD_MOVED",
    );
  });

  it("preserves dotted-path sibling semantics via snapshot equality of full draft", () => {
    const before = draftWithHeading("visible.");
    const after = structuredClone(before)!;
    (after.page as { sectionContent: Record<string, { headingAccent?: { accent: string; emphasis: boolean } }> }).sectionContent[
      "home.hero"
    ] = {
      headingAccent: { accent: "noticeable.", emphasis: true },
    };
    expect(snapshotsEqual(before, after)).toBe(false);
    const restored = structuredClone(before);
    expect(snapshotsEqual(restored, before)).toBe(true);
  });

  it("EN field mutations are classified separately from NL section text", () => {
    expect(
      classifyCmsHistoryMutation({
        kind: "enField",
        path: "section:home.hero:heading",
        value: "Quality",
      }).kind,
    ).toBe("EN_FIELD_UPDATED");
  });
});
