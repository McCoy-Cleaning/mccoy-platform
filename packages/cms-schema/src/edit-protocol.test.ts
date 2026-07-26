import { describe, expect, it } from "vitest";
import {
  CMS_EDIT_CHANNEL,
  MAX_EDIT_MESSAGE_BYTES,
  canApplyPatch,
  createMutationId,
  createSessionId,
  parseCmsEditMessage,
  shouldApplyDraft,
} from "./index";

describe("edit-protocol — session/revision edge cases", () => {
  it("canApplyPatch only accepts an exact revision match (no stale, no future writes)", () => {
    expect(canApplyPatch(0, 0)).toBe(true);
    expect(canApplyPatch(3, 3)).toBe(true);
    expect(canApplyPatch(2, 3)).toBe(false); // stale — parent already moved on
    expect(canApplyPatch(4, 3)).toBe(false); // impossible future revision — reject rather than guess
  });

  it("shouldApplyDraft accepts monotonic-or-equal revisions and rejects stale ones", () => {
    expect(shouldApplyDraft(1, 0)).toBe(true);
    expect(shouldApplyDraft(5, 5)).toBe(true); // re-delivery of same revision is a no-op, not an error
    expect(shouldApplyDraft(4, 5)).toBe(false); // out-of-order delivery must be dropped
    expect(shouldApplyDraft(0, 0)).toBe(true);
  });

  it("two independent sessions never satisfy each other's revision gate implicitly", () => {
    // The gate itself is revision-only; session binding is enforced by callers
    // (edit-bridge.ts / live-edit-draft.tsx) comparing sessionId out of band.
    // Here we assert the raw numeric gate stays correct even when a brand-new
    // session restarts revisions from an unrelated counter.
    const sessionARevision = 12;
    const sessionBRevisionCounterRestartedAtZero = 0;
    expect(canApplyPatch(sessionBRevisionCounterRestartedAtZero, sessionARevision)).toBe(false);
  });
});

describe("edit-protocol — parseCmsEditMessage hardening", () => {
  const sessionId = createSessionId();
  const pageId = "page_home";

  it("rejects payloads on the wrong channel outright", () => {
    expect(
      parseCmsEditMessage({
        channel: "some-other-channel",
        type: "cms-edit-ready",
        sessionId,
        pageId,
      }),
    ).toBeNull();
  });

  it("rejects non-object and nullish payloads without throwing", () => {
    expect(parseCmsEditMessage(null)).toBeNull();
    expect(parseCmsEditMessage(undefined)).toBeNull();
    expect(parseCmsEditMessage("a string")).toBeNull();
    expect(parseCmsEditMessage(42)).toBeNull();
  });

  it("rejects an unknown message type even on the correct channel", () => {
    expect(
      parseCmsEditMessage({ channel: CMS_EDIT_CHANNEL, type: "cms-do-something-else" }),
    ).toBeNull();
  });

  it("rejects cms-edit-ready with a missing or wrong-typed sessionId/pageId", () => {
    expect(
      parseCmsEditMessage({ channel: CMS_EDIT_CHANNEL, type: "cms-edit-ready", pageId }),
    ).toBeNull();
    expect(
      parseCmsEditMessage({
        channel: CMS_EDIT_CHANNEL,
        type: "cms-edit-ready",
        sessionId: 123,
        pageId,
      }),
    ).toBeNull();
  });

  it("rejects a draft-patch whose fixed sectionKey is not in the fixed-section registry", () => {
    expect(
      parseCmsEditMessage({
        channel: CMS_EDIT_CHANNEL,
        type: "cms-draft-patch",
        sessionId,
        pageId,
        baseRevision: 1,
        mutationId: createMutationId(),
        patch: { kind: "section", sectionKey: "made.up.key", patch: { heading: "x" } },
      }),
    ).toBeNull();
  });

  it("rejects a pageMeta patch containing unknown/extra fields (strict schema)", () => {
    expect(
      parseCmsEditMessage({
        channel: CMS_EDIT_CHANNEL,
        type: "cms-draft-patch",
        sessionId,
        pageId,
        baseRevision: 1,
        mutationId: createMutationId(),
        patch: { kind: "pageMeta", patch: { title: "New title", invoiceAllowed: true } },
      }),
    ).toBeNull();
  });

  it("accepts a well-formed pageMeta patch", () => {
    const msg = parseCmsEditMessage({
      channel: CMS_EDIT_CHANNEL,
      type: "cms-draft-patch",
      sessionId,
      pageId,
      baseRevision: 1,
      mutationId: createMutationId(),
      patch: { kind: "pageMeta", patch: { title: "New title", inNav: false } },
    });
    expect(msg?.type).toBe("cms-draft-patch");
  });

  it("accepts a layout op mutation (no side patch payload expected)", () => {
    const msg = parseCmsEditMessage({
      channel: CMS_EDIT_CHANNEL,
      type: "cms-draft-patch",
      sessionId,
      pageId,
      baseRevision: 2,
      mutationId: createMutationId(),
      patch: { kind: "layout", op: "move" },
    });
    expect(msg?.type).toBe("cms-draft-patch");
  });

  it("rejects a layout op outside the known enum", () => {
    expect(
      parseCmsEditMessage({
        channel: CMS_EDIT_CHANNEL,
        type: "cms-draft-patch",
        sessionId,
        pageId,
        baseRevision: 2,
        mutationId: createMutationId(),
        patch: { kind: "layout", op: "teleport" },
      }),
    ).toBeNull();
  });

  it("rejects cms-edit-draft payloads missing a page object", () => {
    expect(
      parseCmsEditMessage({
        channel: CMS_EDIT_CHANNEL,
        type: "cms-edit-draft",
        sessionId,
        pageId,
        revision: 1,
        draft: { sectionContent: {}, overrides: {} },
      }),
    ).toBeNull();
  });

  it("defaults sectionContent/overrides to empty objects when omitted from cms-edit-draft", () => {
    const msg = parseCmsEditMessage({
      channel: CMS_EDIT_CHANNEL,
      type: "cms-edit-draft",
      sessionId,
      pageId,
      revision: 1,
      draft: { page: { id: pageId } },
    });
    expect(msg?.type).toBe("cms-edit-draft");
    if (msg?.type === "cms-edit-draft") {
      expect(msg.draft.sectionContent).toEqual({});
      expect(msg.draft.overrides).toEqual({});
    }
  });

  it("round-trips a cms-selection message for both fixed and block kinds, and null", () => {
    const fixed = parseCmsEditMessage({
      channel: CMS_EDIT_CHANNEL,
      type: "cms-selection",
      sessionId,
      pageId,
      selection: { kind: "fixed", sectionKey: "home.hero" },
    });
    expect(fixed?.type).toBe("cms-selection");

    const block = parseCmsEditMessage({
      channel: CMS_EDIT_CHANNEL,
      type: "cms-selection",
      sessionId,
      pageId,
      selection: { kind: "block", blockId: "b_1", layoutItemId: "li_1" },
    });
    expect(block?.type).toBe("cms-selection");

    const cleared = parseCmsEditMessage({
      channel: CMS_EDIT_CHANNEL,
      type: "cms-selection",
      sessionId,
      pageId,
      selection: null,
    });
    expect(cleared?.type).toBe("cms-selection");
    if (cleared?.type === "cms-selection") expect(cleared.selection).toBeNull();
  });

  it("round-trips a cms-mutation-rejected message", () => {
    const msg = parseCmsEditMessage({
      channel: CMS_EDIT_CHANNEL,
      type: "cms-mutation-rejected",
      sessionId,
      mutationId: createMutationId(),
      reason: "Stale revision",
      currentRevision: 7,
    });
    expect(msg?.type).toBe("cms-mutation-rejected");
    if (msg?.type === "cms-mutation-rejected") {
      expect(msg.currentRevision).toBe(7);
    }
  });

  it("rejects a message that exceeds the maximum payload size (rate/abuse guard)", () => {
    const hugePatch = { kind: "section", sectionKey: "home.hero", patch: { body: "x".repeat(MAX_EDIT_MESSAGE_BYTES) } };
    expect(
      parseCmsEditMessage({
        channel: CMS_EDIT_CHANNEL,
        type: "cms-draft-patch",
        sessionId,
        pageId,
        baseRevision: 1,
        mutationId: createMutationId(),
        patch: hugePatch,
      }),
    ).toBeNull();
  });
});

describe("edit-protocol — id generators", () => {
  it("createSessionId/createMutationId produce distinct, non-empty ids", () => {
    const a = createSessionId();
    const b = createSessionId();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThan(5);

    const m1 = createMutationId();
    const m2 = createMutationId();
    expect(m1).not.toEqual(m2);
  });
});
