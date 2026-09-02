import * as React from "react";
import {
  CMS_EDIT_CHANNEL,
  addTrustedMessageListener,
  canApplyPatch,
  canRedo,
  canUndo,
  classifyCmsHistoryMutation,
  createEmptyEditorHistory,
  createSessionId,
  ensureBuiltinSectionContent,
  parseCmsEditMessage,
  pushEditorHistory,
  redoEditorHistory,
  undoEditorHistory,
  type CmsDraftSnapshot,
  type CmsEditMessage,
  type CmsEditorHistoryState,
  type CmsEditorInteractionMode,
  type CmsMutation,
  type CmsUiCommand,
  type EditableDraftSnapshot,
  type FixedSectionKey,
  type PageSectionContent,
} from "@mccoy/cms-schema";
import { cms } from "@/lib/cms/store";

function e2eHooksEnabled(): boolean {
  return Boolean(import.meta.env.VITE_E2E_CMS) || import.meta.env.DEV === true;
}

type CmsE2EParentHook = {
  sessionId: string | null;
  revision: number;
  lastReject?: { mutationId: string; reason: string; currentRevision: number };
  lastDrop?: { reason: string; got?: string; expected?: string | null };
  lastInbound?: { origin: string; sourceOk: boolean; type?: string };
  history?: { undo: number; redo: number };
};

export type AdminCmsSelection =
  | { kind: "fixed"; sectionKey: FixedSectionKey; part?: string }
  | { kind: "block"; blockId: string; layoutItemId: string }
  | null;

function buildDraftSnapshot(pageId: string): EditableDraftSnapshot | null {
  const page = cms.getEditablePage(pageId);
  if (!page) return null;
  const overrides = cms.getDraft(pageId);
  if (page.kind === "builtin") {
    // Overrides hydrate missing sections only — existing structured content wins.
    const sectionContent = ensureBuiltinSectionContent(page, overrides);
    const next = structuredClone(page);
    next.sectionContent = sectionContent;
    return {
      page: next,
      sectionContent,
      overrides,
    };
  }
  return {
    page: structuredClone(page),
    sectionContent: {},
    overrides,
  };
}

/**
 * Parent-side revisioned edit bridge for the Bewerken iframe.
 * Owns ephemeral per-page undo/redo stacks (draft-only; never published).
 */
export function useCmsEditParentBridge(
  pageId: string,
  iframeRef: React.RefObject<HTMLIFrameElement | null>,
  storefrontOrigin: string,
) {
  const sessionIdRef = React.useRef<string | null>(null);
  const revisionRef = React.useRef(0);
  const [selection, setSelection] = React.useState<AdminCmsSelection>(null);
  const selectionRef = React.useRef<AdminCmsSelection>(null);
  selectionRef.current = selection;
  const [revision, setRevision] = React.useState(0);
  const [uiCommand, setUiCommand] = React.useState<CmsUiCommand | null>(null);
  const [interactionMode, setInteractionMode] =
    React.useState<CmsEditorInteractionMode>("edit");
  const interactionModeRef = React.useRef<CmsEditorInteractionMode>("edit");
  interactionModeRef.current = interactionMode;

  const historyByPageRef = React.useRef<Map<string, CmsEditorHistoryState>>(new Map());
  const recordingHistoryRef = React.useRef(true);
  const [historyTick, setHistoryTick] = React.useState(0);

  const getHistory = React.useCallback((id: string): CmsEditorHistoryState => {
    let state = historyByPageRef.current.get(id);
    if (!state) {
      state = createEmptyEditorHistory();
      historyByPageRef.current.set(id, state);
    }
    return state;
  }, []);

  const setHistory = React.useCallback((id: string, next: CmsEditorHistoryState) => {
    historyByPageRef.current.set(id, next);
    setHistoryTick((n) => n + 1);
  }, []);

  const clearHistoryForPage = React.useCallback((id: string) => {
    historyByPageRef.current.set(id, createEmptyEditorHistory());
    setHistoryTick((n) => n + 1);
  }, []);

  React.useEffect(() => {
    void pageId;
    setHistoryTick((n) => n + 1);
  }, [pageId]);

  const pushDraft = React.useCallback(() => {
    const iframe = iframeRef.current;
    const draft = buildDraftSnapshot(pageId);
    const sessionId = sessionIdRef.current;
    if (!iframe?.contentWindow || !draft || !sessionId) {
      return;
    }
    revisionRef.current += 1;
    const nextRev = revisionRef.current;
    setRevision(nextRev);
    const msg: CmsEditMessage = {
      channel: CMS_EDIT_CHANNEL,
      type: "cms-edit-draft",
      sessionId,
      pageId,
      revision: nextRev,
      draft,
    };
    iframe.contentWindow.postMessage(msg, storefrontOrigin);
  }, [iframeRef, pageId, storefrontOrigin]);

  const applyMutationRaw = React.useCallback(
    (mutation: CmsMutation): { ok: true } | { ok: false; reason: string } => {
      if (mutation.kind === "section") {
        return cms.patchSectionContent(pageId, mutation.sectionKey, mutation.patch);
      }
      if (mutation.kind === "block") {
        cms.updateLayoutBlock(pageId, mutation.blockId, mutation.patch);
        return { ok: true };
      }
      if (mutation.kind === "pageMeta") {
        cms.updatePage(pageId, mutation.patch);
        return { ok: true };
      }
      if (mutation.kind === "enField") {
        cms.setEnFieldDrafts(pageId, { [mutation.path]: mutation.value });
        return { ok: true };
      }
      if (mutation.kind === "layout") {
        const normalize = (
          result: { ok: true } | { ok: false; code?: string; reason?: string },
        ): { ok: true } | { ok: false; reason: string } => {
          if (result.ok) return { ok: true };
          return {
            ok: false,
            reason: result.reason ?? result.code ?? "Layoutbewerking mislukt",
          };
        };
        if (mutation.op === "move") {
          return normalize(cms.moveLayoutItem(pageId, mutation.layoutItemId, mutation.direction));
        }
        if (mutation.op === "toggle") {
          return normalize(cms.toggleLayoutItemHidden(pageId, mutation.layoutItemId));
        }
        if (mutation.op === "remove") {
          if (mutation.blockId) {
            return normalize(cms.removeLayoutBlock(pageId, mutation.blockId));
          }
          return normalize(cms.toggleLayoutItemHidden(pageId, mutation.layoutItemId));
        }
        if (mutation.op === "duplicate") {
          return normalize(cms.duplicateLayoutBlock(pageId, mutation.blockId));
        }
        if (mutation.op === "add") {
          return normalize(
            cms.addLayoutBlock(
              pageId,
              mutation.blockType as Parameters<typeof cms.addLayoutBlock>[1],
              mutation.atIndex,
              mutation.templateId ? { templateId: mutation.templateId } : undefined,
            ),
          );
        }
        return { ok: false, reason: "Unsupported layout op" };
      }
      return { ok: true };
    },
    [pageId],
  );

  const applyMutation = React.useCallback(
    (
      mutation: CmsMutation,
      options?: { recordHistory?: boolean },
    ): { ok: true } | { ok: false; reason: string } => {
      const record = options?.recordHistory !== false && recordingHistoryRef.current;
      const before: CmsDraftSnapshot = record ? cms.captureDraftSnapshot(pageId) : null;
      const result = applyMutationRaw(mutation);
      if (!result.ok) return result;
      if (record) {
        const after = cms.captureDraftSnapshot(pageId);
        const { kind, label } = classifyCmsHistoryMutation(mutation, { before, after });
        setHistory(
          pageId,
          pushEditorHistory(getHistory(pageId), {
            kind,
            label,
            mutation,
            before,
            after,
          }),
        );
      }
      return result;
    },
    [applyMutationRaw, getHistory, pageId, setHistory],
  );

  const restoreSnapshot = React.useCallback(
    (snapshot: CmsDraftSnapshot) => {
      recordingHistoryRef.current = false;
      try {
        const result = cms.restoreDraftSnapshot(pageId, snapshot);
        if (!result.ok) return result;
        pushDraft();
        return { ok: true as const };
      } finally {
        recordingHistoryRef.current = true;
      }
    },
    [pageId, pushDraft],
  );

  const undo = React.useCallback(() => {
    const applied = undoEditorHistory(getHistory(pageId));
    if (!applied.ok) return applied;
    const restored = restoreSnapshot(applied.restore);
    if (!restored.ok) return restored;
    setHistory(pageId, applied.state);
    return { ok: true as const };
  }, [getHistory, pageId, restoreSnapshot, setHistory]);

  const redo = React.useCallback(() => {
    const applied = redoEditorHistory(getHistory(pageId));
    if (!applied.ok) return applied;
    const restored = restoreSnapshot(applied.restore);
    if (!restored.ok) return restored;
    setHistory(pageId, applied.state);
    return { ok: true as const };
  }, [getHistory, pageId, restoreSnapshot, setHistory]);

  const patchSection = React.useCallback(
    (sectionKey: FixedSectionKey, patch: Record<string, unknown>) => {
      const result = applyMutation({ kind: "section", sectionKey, patch });
      if (result.ok) pushDraft();
      return result;
    },
    [applyMutation, pushDraft],
  );

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const iframeWin = iframeRef.current?.contentWindow;

      if (e2eHooksEnabled()) {
        const w = window as Window & { __cmsE2EParent?: CmsE2EParentHook };
        const data = event.data as { type?: string } | null;
        const hist = getHistory(pageId);
        w.__cmsE2EParent = {
          sessionId: sessionIdRef.current,
          revision: revisionRef.current,
          lastInbound: {
            origin: event.origin,
            sourceOk: !!iframeWin && event.source === iframeWin,
            type: data?.type,
          },
          lastDrop: w.__cmsE2EParent?.lastDrop,
          lastReject: w.__cmsE2EParent?.lastReject,
          history: { undo: hist.undoStack.length, redo: hist.redoStack.length },
        };
      }

      if (!iframeWin || event.source !== iframeWin) {
        if (e2eHooksEnabled()) {
          const w = window as Window & { __cmsE2EParent?: CmsE2EParentHook };
          w.__cmsE2EParent = {
            sessionId: sessionIdRef.current,
            revision: revisionRef.current,
            lastDrop: {
              reason: !iframeWin ? "missing-iframe" : "source",
              got: event.origin,
              expected: storefrontOrigin,
            },
            lastReject: w.__cmsE2EParent?.lastReject,
            lastInbound: w.__cmsE2EParent?.lastInbound,
            history: w.__cmsE2EParent?.history,
          };
        }
        return;
      }

      const msg = parseCmsEditMessage(event.data);
      if (!msg) return;

      if (msg.type === "cms-edit-ready") {
        if (msg.pageId !== pageId) return;
        sessionIdRef.current = msg.sessionId;
        pushDraft();
        const currentSelection = selectionRef.current;
        if (currentSelection) {
          const sync: CmsEditMessage = {
            channel: CMS_EDIT_CHANNEL,
            type: "cms-selection",
            sessionId: msg.sessionId,
            pageId,
            selection: currentSelection,
          };
          iframeWin.postMessage(sync, storefrontOrigin);
        }
        const modeMsg: CmsEditMessage = {
          channel: CMS_EDIT_CHANNEL,
          type: "cms-editor-mode",
          sessionId: msg.sessionId,
          pageId,
          interactionMode: interactionModeRef.current,
        };
        iframeWin.postMessage(modeMsg, storefrontOrigin);
        return;
      }

      if (msg.type === "cms-selection") {
        if (msg.pageId !== pageId) return;
        if (sessionIdRef.current && msg.sessionId !== sessionIdRef.current) return;
        setSelection(msg.selection);
        return;
      }

      if (msg.type === "cms-draft-patch") {
        if (msg.pageId !== pageId) return;
        if (!sessionIdRef.current || msg.sessionId !== sessionIdRef.current) {
          if (e2eHooksEnabled()) {
            const w = window as Window & { __cmsE2EParent?: CmsE2EParentHook };
            w.__cmsE2EParent = {
              sessionId: sessionIdRef.current,
              revision: revisionRef.current,
              lastDrop: {
                reason: "session",
                got: msg.sessionId,
                expected: sessionIdRef.current,
              },
              lastReject: w.__cmsE2EParent?.lastReject,
              history: w.__cmsE2EParent?.history,
            };
          }
          return;
        }

        if (!canApplyPatch(msg.baseRevision, revisionRef.current)) {
          const reject: CmsEditMessage = {
            channel: CMS_EDIT_CHANNEL,
            type: "cms-mutation-rejected",
            sessionId: msg.sessionId,
            mutationId: msg.mutationId,
            reason: "Stale revision",
            currentRevision: revisionRef.current,
          };
          iframeWin.postMessage(reject, storefrontOrigin);
          if (e2eHooksEnabled()) {
            const w = window as Window & { __cmsE2EParent?: CmsE2EParentHook };
            w.__cmsE2EParent = {
              sessionId: sessionIdRef.current,
              revision: revisionRef.current,
              lastReject: {
                mutationId: msg.mutationId,
                reason: "Stale revision",
                currentRevision: revisionRef.current,
              },
              lastDrop: w.__cmsE2EParent?.lastDrop,
              lastInbound: w.__cmsE2EParent?.lastInbound,
              history: w.__cmsE2EParent?.history,
            };
          }
          pushDraft();
          return;
        }

        const result = applyMutation(msg.patch);
        if (!result.ok) {
          const reject: CmsEditMessage = {
            channel: CMS_EDIT_CHANNEL,
            type: "cms-mutation-rejected",
            sessionId: msg.sessionId,
            mutationId: msg.mutationId,
            reason: result.reason,
            currentRevision: revisionRef.current,
          };
          iframeWin.postMessage(reject, storefrontOrigin);
          pushDraft();
          return;
        }
        pushDraft();
      }

      if (msg.type === "cms-ui-command") {
        if (msg.pageId !== pageId) return;
        if (!sessionIdRef.current || msg.sessionId !== sessionIdRef.current) return;
        if (msg.command.kind === "undo") {
          undo();
          return;
        }
        if (msg.command.kind === "redo") {
          redo();
          return;
        }
        setUiCommand(msg.command);
      }
    };

    return addTrustedMessageListener(storefrontOrigin, onMessage);
  }, [pageId, storefrontOrigin, iframeRef, pushDraft, applyMutation, getHistory, undo, redo]);

  React.useEffect(() => {
    if (!e2eHooksEnabled()) return;
    const w = window as Window & { __cmsE2EParent?: CmsE2EParentHook };
    const hist = getHistory(pageId);
    w.__cmsE2EParent = {
      sessionId: sessionIdRef.current,
      revision: revisionRef.current,
      lastReject: w.__cmsE2EParent?.lastReject,
      lastDrop: w.__cmsE2EParent?.lastDrop,
      lastInbound: w.__cmsE2EParent?.lastInbound,
      history: { undo: hist.undoStack.length, redo: hist.redoStack.length },
    };
  }, [revision, selection, historyTick, pageId, getHistory]);

  const bump = React.useCallback(() => {
    if (sessionIdRef.current) pushDraft();
  }, [pushDraft]);

  const setSelectionAndSync = React.useCallback(
    (sel: AdminCmsSelection) => {
      setSelection(sel);
      const iframe = iframeRef.current;
      const sessionId = sessionIdRef.current;
      if (!iframe?.contentWindow || !sessionId) return;
      const msg: CmsEditMessage = {
        channel: CMS_EDIT_CHANNEL,
        type: "cms-selection",
        sessionId,
        pageId,
        selection: sel,
      };
      iframe.contentWindow.postMessage(msg, storefrontOrigin);
    },
    [iframeRef, pageId, storefrontOrigin],
  );

  const setInteractionModeAndSync = React.useCallback(
    (mode: CmsEditorInteractionMode) => {
      setInteractionMode(mode);
      const iframe = iframeRef.current;
      const sessionId = sessionIdRef.current;
      if (!iframe?.contentWindow || !sessionId) return;
      const msg: CmsEditMessage = {
        channel: CMS_EDIT_CHANNEL,
        type: "cms-editor-mode",
        sessionId,
        pageId,
        interactionMode: mode,
      };
      iframe.contentWindow.postMessage(msg, storefrontOrigin);
    },
    [iframeRef, pageId, storefrontOrigin],
  );

  const clearUiCommand = React.useCallback(() => setUiCommand(null), []);

  const historyState = getHistory(pageId);
  void historyTick;

  return {
    selection,
    setSelection: setSelectionAndSync,
    revision,
    pushDraft,
    bump,
    patchSection,
    applyMutation,
    sessionId: sessionIdRef.current,
    ensureSession: () => {
      if (!sessionIdRef.current) sessionIdRef.current = createSessionId();
    },
    uiCommand,
    clearUiCommand,
    interactionMode,
    setInteractionMode: setInteractionModeAndSync,
    undo,
    redo,
    canUndo: canUndo(historyState),
    canRedo: canRedo(historyState),
    clearHistory: () => clearHistoryForPage(pageId),
  };
}

export function getEditableSectionContent(pageId: string): PageSectionContent {
  const page = cms.getEditablePage(pageId);
  if (!page || page.kind !== "builtin") return {};
  return ensureBuiltinSectionContent(page, cms.getDraft(pageId));
}
