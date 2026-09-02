/**
 * E11 integration: draft history + dirty baseline + publish isolation.
 * Uses the real admin cms store APIs (no React bridge).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  canRedo,
  canUndo,
  classifyCmsHistoryMutation,
  createEmptyEditorHistory,
  pushEditorHistory,
  redoEditorHistory,
  undoEditorHistory,
  type CmsDraftSnapshot,
  type CmsEditorHistoryState,
  type CmsMutation,
} from "@mccoy/cms-schema";

vi.mock("@/lib/api/cms-publish.functions", () => ({
  adminGetPublishedCmsPages: vi.fn(),
  adminListPublishedCustomPageIds: vi.fn(),
}));

vi.mock("./server-publish", () => ({
  deleteSavedPageFromServer: vi.fn(),
  publishSavedPageToServer: vi.fn(async () => ({ ok: true as const })),
  publishSiteChromeToServer: vi.fn(),
  saveConceptPageToServer: vi.fn(),
}));

vi.mock("./publish-sync", () => ({
  pushPublishedChromeToStorefront: vi.fn(),
  pushPublishedPageToStorefront: vi.fn(),
}));

import { cms } from "./store";
import { clearMemoryState, initial, write } from "./store-persistence";

const PAGE_ID = "page_home";

function applyWithHistory(
  history: CmsEditorHistoryState,
  mutation: CmsMutation,
  record = true,
): CmsEditorHistoryState {
  const before: CmsDraftSnapshot = record ? cms.captureDraftSnapshot(PAGE_ID) : null;
  if (mutation.kind === "section") {
    const result = cms.patchSectionContent(PAGE_ID, mutation.sectionKey, mutation.patch);
    if (!result.ok) throw new Error(result.reason);
  } else if (mutation.kind === "enField") {
    cms.setEnFieldDrafts(PAGE_ID, { [mutation.path]: mutation.value });
  } else if (mutation.kind === "layout") {
    if (mutation.op === "add") {
      const result = cms.addLayoutBlock(
        PAGE_ID,
        mutation.blockType as Parameters<typeof cms.addLayoutBlock>[1],
        mutation.atIndex,
        mutation.templateId ? { templateId: mutation.templateId } : undefined,
      );
      if (!result.ok) throw new Error(String(result.code ?? "add failed"));
    } else if (mutation.op === "remove" && mutation.blockId) {
      const result = cms.removeLayoutBlock(PAGE_ID, mutation.blockId);
      if (!result.ok) throw new Error(String(result.code ?? "remove failed"));
    } else {
      throw new Error(`unsupported layout op in harness: ${mutation.op}`);
    }
  } else {
    throw new Error(`unsupported mutation kind in harness: ${mutation.kind}`);
  }
  if (!record) return history;
  const after = cms.captureDraftSnapshot(PAGE_ID);
  const { kind, label } = classifyCmsHistoryMutation(mutation, { before, after });
  return pushEditorHistory(history, { kind, label, mutation, before, after });
}

function undo(history: CmsEditorHistoryState): CmsEditorHistoryState {
  const applied = undoEditorHistory(history);
  if (!applied.ok) return history;
  const restored = cms.restoreDraftSnapshot(PAGE_ID, applied.restore);
  if (!restored.ok) throw new Error(restored.reason);
  return applied.state;
}

function redo(history: CmsEditorHistoryState): CmsEditorHistoryState {
  const applied = redoEditorHistory(history);
  if (!applied.ok) return history;
  const restored = cms.restoreDraftSnapshot(PAGE_ID, applied.restore);
  if (!restored.ok) throw new Error(restored.reason);
  return applied.state;
}

/** Local publish simulation: promote editable draft → published pages, clear draft. */
function publishLocal() {
  const editable = cms.getEditablePage(PAGE_ID);
  if (!editable) throw new Error("missing page");
  const s = cms.getState();
  s.pages = s.pages.map((p) => (p.id === PAGE_ID ? structuredClone(editable) : p));
  delete s.draft[PAGE_ID];
  write(s);
}

function heroHeading(): string {
  const page = cms.getEditablePage(PAGE_ID);
  if (!page || page.kind !== "builtin") return "";
  const hero = page.sectionContent?.["home.hero"] as { heading?: string } | undefined;
  return hero?.heading ?? "";
}

function publishedHeading(): string {
  const page = cms.getPage(PAGE_ID);
  if (!page || page.kind !== "builtin") return "";
  const hero = page.sectionContent?.["home.hero"] as { heading?: string } | undefined;
  return hero?.heading ?? "";
}

beforeEach(() => {
  clearMemoryState();
  const seed = initial();
  const home = seed.pages.find((p) => p.id === PAGE_ID);
  if (!home || home.kind !== "builtin") throw new Error("seed home missing");
  home.sectionContent = {
    ...(home.sectionContent ?? {}),
    "home.hero": {
      heading: "A",
      body: "Body",
    },
  } as never;
  write(seed);
});

describe("E11 draft history integration", () => {
  it("dirty becomes clean when undo reaches saved/published baseline", () => {
    let history = createEmptyEditorHistory();
    expect(cms.hasDraft(PAGE_ID)).toBe(false);

    history = applyWithHistory(history, {
      kind: "section",
      sectionKey: "home.hero",
      patch: { heading: "B" },
    });
    expect(cms.hasDraft(PAGE_ID)).toBe(true);
    expect(heroHeading()).toBe("B");

    history = undo(history);
    expect(cms.hasDraft(PAGE_ID)).toBe(false);
    expect(heroHeading()).toBe("A");
    expect(canRedo(history)).toBe(true);

    history = redo(history);
    expect(cms.hasDraft(PAGE_ID)).toBe(true);
    expect(heroHeading()).toBe("B");
  });

  it("after publish, undo restores draft without changing published snapshot", () => {
    let history = createEmptyEditorHistory();
    history = applyWithHistory(history, {
      kind: "section",
      sectionKey: "home.hero",
      patch: { heading: "B" },
    });
    publishLocal();
    expect(cms.hasDraft(PAGE_ID)).toBe(false);
    expect(publishedHeading()).toBe("B");

    history = applyWithHistory(history, {
      kind: "section",
      sectionKey: "home.hero",
      patch: { heading: "C" },
    });
    expect(heroHeading()).toBe("C");
    expect(publishedHeading()).toBe("B");

    history = undo(history);
    expect(heroHeading()).toBe("B");
    expect(publishedHeading()).toBe("B");
    expect(cms.hasDraft(PAGE_ID)).toBe(false);

    history = redo(history);
    expect(heroHeading()).toBe("C");
    expect(publishedHeading()).toBe("B");
    expect(canUndo(history)).toBe(true);
  });

  it("save/publish creates a new dirty baseline for subsequent undo", () => {
    let history = createEmptyEditorHistory();
    history = applyWithHistory(history, {
      kind: "section",
      sectionKey: "home.hero",
      patch: { heading: "B" },
    });
    publishLocal();
    history = applyWithHistory(history, {
      kind: "section",
      sectionKey: "home.hero",
      patch: { heading: "C" },
    });
    expect(cms.hasDraft(PAGE_ID)).toBe(true);
    history = undo(history);
    expect(cms.hasDraft(PAGE_ID)).toBe(false);
    expect(heroHeading()).toBe("B");
  });

  it("EN edit does not mutate NL heading; undo is locale-scoped via snapshot", () => {
    let history = createEmptyEditorHistory();
    history = applyWithHistory(history, {
      kind: "enField",
      path: "section:home.hero:heading",
      value: "Quality you can see",
    });
    expect(heroHeading()).toBe("A");
    const page = cms.getEditablePage(PAGE_ID);
    expect(page?.enFieldDrafts?.["section:home.hero:heading"]).toBe("Quality you can see");

    history = undo(history);
    const afterUndo = cms.getEditablePage(PAGE_ID);
    expect(afterUndo?.enFieldDrafts?.["section:home.hero:heading"]).toBeUndefined();
    expect(heroHeading()).toBe("A");
  });

  it("section add → delete → undo restores the same block id", () => {
    let history = createEmptyEditorHistory();
    history = applyWithHistory(history, {
      kind: "layout",
      op: "add",
      blockType: "cta",
      atIndex: 0,
    });
    const page = cms.getEditablePage(PAGE_ID)!;
    const block = page.blocks.find((b) => b.type === "cta");
    expect(block).toBeTruthy();
    const blockId = block!.id;
    const layoutItem = page.layout.find(
      (item) => item.kind === "block" && item.blockId === blockId,
    );
    expect(layoutItem).toBeTruthy();

    history = applyWithHistory(history, {
      kind: "layout",
      op: "remove",
      layoutItemId: layoutItem!.id,
      blockId,
    });
    expect(cms.getEditablePage(PAGE_ID)!.blocks.some((b) => b.id === blockId)).toBe(false);

    history = undo(history);
    expect(cms.getEditablePage(PAGE_ID)!.blocks.some((b) => b.id === blockId)).toBe(true);

    history = redo(history);
    expect(cms.getEditablePage(PAGE_ID)!.blocks.some((b) => b.id === blockId)).toBe(false);
  });
});
