import { describe, expect, it } from "vitest";
import { isDraftDirty, type CmsPage, type PageDraft } from "@mccoy/cms-schema";

/**
 * Documents the reconcile rule: a dirty local draft must never be discarded
 * solely because the remote published `updatedAt` is newer (file-picker focus
 * used to trigger that wipe and hide just-uploaded canvas media).
 */
function mergePageForReconcile(input: {
  local: CmsPage;
  remote: CmsPage;
  draft: PageDraft | undefined;
}): { page: CmsPage; keepDraft: boolean } {
  const localFresh = typeof input.local.updatedAt === "number" ? input.local.updatedAt : 0;
  const remoteFresh = typeof input.remote.updatedAt === "number" ? input.remote.updatedAt : 0;
  const dirty = isDraftDirty(input.draft);
  if (remoteFresh > localFresh) {
    if (dirty) return { page: input.local, keepDraft: true };
    return { page: input.remote, keepDraft: false };
  }
  if (dirty) return { page: input.local, keepDraft: true };
  return { page: input.remote, keepDraft: false };
}

describe("reconcile dirty draft preservation", () => {
  it("keeps dirty draft when remote published is newer", () => {
    const local = { id: "page_home", updatedAt: 100 } as CmsPage;
    const remote = { id: "page_home", updatedAt: 200 } as CmsPage;
    const draft: PageDraft = {
      overrides: {},
      page: { ...local, blocks: [{ id: "b1", type: "beforeAfter", data: { before: { src: "x" } } }] } as CmsPage,
    };
    const result = mergePageForReconcile({ local, remote, draft });
    expect(result.keepDraft).toBe(true);
    expect(result.page).toBe(local);
  });

  it("takes remote when there is no dirty draft", () => {
    const local = { id: "page_home", updatedAt: 100 } as CmsPage;
    const remote = { id: "page_home", updatedAt: 200 } as CmsPage;
    const result = mergePageForReconcile({ local, remote, draft: undefined });
    expect(result.keepDraft).toBe(false);
    expect(result.page).toBe(remote);
  });
});
