import * as React from "react";
import {
  CMS_EDIT_CHANNEL,
  addTrustedMessageListener,
  canApplyPatch,
  createSessionId,
  ensureBuiltinSectionContent,
  parseCmsEditMessage,
  type CmsEditMessage,
  type CmsMutation,
  type CmsPage,
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

  const pushDraft = React.useCallback(() => {
    const iframe = iframeRef.current;
    const draft = buildDraftSnapshot(pageId);
    const sessionId = sessionIdRef.current;
    if (!iframe?.contentWindow || !draft || !sessionId) return;
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

  const applyMutation = React.useCallback(
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
      // layout ops are applied via BuiltinLayoutEditor directly on parent
      return { ok: true };
    },
    [pageId],
  );

  const patchSection = React.useCallback(
    (sectionKey: FixedSectionKey, patch: Record<string, unknown>) => {
      const result = cms.patchSectionContent(pageId, sectionKey, patch);
      if (result.ok) pushDraft();
      return result;
    },
    [pageId, pushDraft],
  );

  React.useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const iframeWin = iframeRef.current?.contentWindow;

      if (e2eHooksEnabled()) {
        const w = window as Window & {
          __cmsE2EParent?: {
            sessionId: string | null;
            revision: number;
            lastInbound?: {
              origin: string;
              sourceOk: boolean;
              type?: string;
            };
            lastDrop?: { reason: string; got?: string; expected?: string | null };
            lastReject?: { mutationId: string; reason: string; currentRevision: number };
          };
        };
        const data = event.data as { type?: string } | null;
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
        };
      }

      if (!iframeWin || event.source !== iframeWin) {
        if (e2eHooksEnabled()) {
          const w = window as Window & {
            __cmsE2EParent?: {
              sessionId: string | null;
              revision: number;
              lastDrop?: { reason: string; got?: string; expected?: string | null };
              lastReject?: { mutationId: string; reason: string; currentRevision: number };
              lastInbound?: { origin: string; sourceOk: boolean; type?: string };
            };
          };
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
        // Re-sync inspector selection after iframe reconnect (highlight + scroll).
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
            const w = window as Window & {
              __cmsE2EParent?: {
                sessionId: string | null;
                revision: number;
                lastDrop?: { reason: string; got?: string; expected?: string | null };
                lastReject?: { mutationId: string; reason: string; currentRevision: number };
              };
            };
            w.__cmsE2EParent = {
              sessionId: sessionIdRef.current,
              revision: revisionRef.current,
              lastDrop: {
                reason: "session",
                got: msg.sessionId,
                expected: sessionIdRef.current,
              },
              lastReject: w.__cmsE2EParent?.lastReject,
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
            const w = window as Window & {
              __cmsE2EParent?: {
                sessionId: string | null;
                revision: number;
                lastReject?: { mutationId: string; reason: string; currentRevision: number };
                lastDrop?: { reason: string; got?: string; expected?: string | null };
                lastInbound?: { origin: string; sourceOk: boolean; type?: string };
              };
            };
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
    };

    return addTrustedMessageListener(storefrontOrigin, onMessage);
  }, [pageId, storefrontOrigin, iframeRef, pushDraft, applyMutation]);

  React.useEffect(() => {
    if (!e2eHooksEnabled()) return;
    const w = window as Window & { __cmsE2EParent?: CmsE2EParentHook };
    w.__cmsE2EParent = {
      sessionId: sessionIdRef.current,
      revision: revisionRef.current,
      lastReject: w.__cmsE2EParent?.lastReject,
      lastDrop: w.__cmsE2EParent?.lastDrop,
      lastInbound: w.__cmsE2EParent?.lastInbound,
    };
  }, [revision, selection]);

  // Re-push whenever local draft changes (layout ops from Secties drawer, inspector, etc.)
  const bump = React.useCallback(() => {
    if (sessionIdRef.current) pushDraft();
  }, [pushDraft]);

  /** Push inspector selection into the Bewerken iframe (highlight + scroll). */
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

  return {
    selection,
    setSelection: setSelectionAndSync,
    revision,
    pushDraft,
    bump,
    patchSection,
    sessionId: sessionIdRef.current,
    ensureSession: () => {
      if (!sessionIdRef.current) sessionIdRef.current = createSessionId();
    },
  };
}

export function getEditableSectionContent(pageId: string): PageSectionContent {
  const page = cms.getEditablePage(pageId);
  if (!page || page.kind !== "builtin") return {};
  return ensureBuiltinSectionContent(page, cms.getDraft(pageId));
}
