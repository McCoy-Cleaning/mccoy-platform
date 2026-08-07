import * as React from "react";
import {
  CMS_EDIT_CHANNEL,
  addTrustedMessageListener,
  createSessionId,
  createMutationId,
  parseCmsEditMessage,
  resolveAdminParentOrigins,
  shouldApplyDraft,
  type CmsMutation,
  type EditableDraftSnapshot,
} from "@mccoy/cms-schema";
import {
  LiveEditCtx,
  type CmsCanvasSelection,
  type LiveEditApi,
  type LiveEditDraft,
} from "./live-edit-api-context";

export type { CmsCanvasSelection, LiveEditDraft } from "./live-edit-api-context";
export { useLiveEditApi, useLiveEditDraft } from "./live-edit-api-context";
export { useCmsPageForView, useSectionContentMap } from "./use-cms-page-for-view";

function scrollCanvasToSelection(sel: CmsCanvasSelection) {
  if (!sel || typeof document === "undefined") return;
  const run = () => {
    let el: Element | null = null;
    if (sel.kind === "fixed") {
      const key = sel.sectionKey.replace(/"/g, "");
      if (sel.part) {
        el = document.querySelector(`[data-cms-select="${key}:${sel.part.replace(/"/g, "")}"]`);
      }
      if (!el) {
        el = document.querySelector(`[data-cms-select="${key}"]`);
      }
    } else {
      el = document.querySelector(`[data-cms-select-block="${sel.blockId.replace(/"/g, "")}"]`);
    }
    if (!(el instanceof HTMLElement)) return;
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    if (document.activeElement === document.body || document.activeElement === document.documentElement) {
      el.focus({ preventScroll: true });
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(run));
}

function useEditRoute(): { isEdit: boolean; pageId: string | null } {
  const [route, setRoute] = React.useState(() => {
    if (typeof window === "undefined") return { isEdit: false, pageId: null as string | null };
    const sp = new URLSearchParams(window.location.search);
    return {
      isEdit: sp.get("_cmsMode") === "edit",
      pageId: sp.get("_cmsPage"),
    };
  });

  React.useEffect(() => {
    const detect = () => {
      const sp = new URLSearchParams(window.location.search);
      setRoute({
        isEdit: sp.get("_cmsMode") === "edit",
        pageId: sp.get("_cmsPage"),
      });
    };
    detect();
    window.addEventListener("popstate", detect);
    return () => window.removeEventListener("popstate", detect);
  }, []);

  return route;
}

function parentOrigins(): string[] {
  const ancestors =
    typeof location !== "undefined" && "ancestorOrigins" in location
      ? location.ancestorOrigins
      : null;
  return resolveAdminParentOrigins({
    currentOrigin: window.location.origin,
    envAdminOrigin: import.meta.env.VITE_ADMIN_ORIGIN as string | undefined,
    referrer: typeof document !== "undefined" ? document.referrer : null,
    ancestorOrigins: ancestors,
  });
}

/**
 * Receives revisioned drafts from the admin parent via postMessage.
 * Parent remains source of truth; iframe never invents authoritative draft state.
 */
export function LiveEditDraftProvider({ children }: { children: React.ReactNode }) {
  const { isEdit, pageId } = useEditRoute();
  const [live, setLive] = React.useState<LiveEditDraft | null>(null);
  const [selection, setSelectionState] = React.useState<CmsCanvasSelection>(null);
  const sessionIdRef = React.useRef(createSessionId());
  const lastAppliedRevision = React.useRef(0);

  const postToParents = React.useCallback((msg: Record<string, unknown>) => {
    const payload = { channel: CMS_EDIT_CHANNEL, ...msg };
    for (const origin of parentOrigins()) {
      try {
        window.parent.postMessage(payload, origin);
      } catch {
        /* ignore invalid targetOrigin */
      }
    }
  }, []);

  const setSelection = React.useCallback(
    (sel: CmsCanvasSelection) => {
      setSelectionState(sel);
      scrollCanvasToSelection(sel);
      if (!pageId) return;
      postToParents({
        type: "cms-selection",
        sessionId: sessionIdRef.current,
        pageId,
        selection: sel,
      });
    },
    [pageId, postToParents],
  );

  const sendMutation = React.useCallback(
    (patch: CmsMutation) => {
      if (!pageId || !live) return;
      postToParents({
        type: "cms-draft-patch",
        sessionId: sessionIdRef.current,
        pageId,
        baseRevision: live.revision,
        mutationId: createMutationId(),
        patch,
      });
    },
    [pageId, live, postToParents],
  );

  React.useEffect(() => {
    if (!isEdit || !pageId) {
      setLive(null);
      lastAppliedRevision.current = 0;
      return;
    }

    sessionIdRef.current = createSessionId();
    const sessionId = sessionIdRef.current;
    const allowed = parentOrigins();

    const onMessage = (event: MessageEvent) => {
      if (window.parent !== window && event.source !== window.parent) return;

      const msg = parseCmsEditMessage(event.data);
      if (!msg) return;
      if (msg.sessionId !== sessionId && msg.type !== "cms-edit-draft") {
        return;
      }

      if (msg.type === "cms-edit-draft") {
        if (msg.pageId !== pageId) return;
        if (msg.sessionId !== sessionId && lastAppliedRevision.current > 0) return;
        if (!shouldApplyDraft(msg.revision, lastAppliedRevision.current)) return;
        lastAppliedRevision.current = msg.revision;
        const draft: EditableDraftSnapshot = msg.draft;
        setLive({
          pageId: msg.pageId,
          page: draft.page,
          overrides: draft.overrides ?? {},
          sectionContent: draft.sectionContent ?? {},
          revision: msg.revision,
          sessionId: msg.sessionId,
        });
        return;
      }

      if (msg.type === "cms-selection") {
        if (msg.pageId !== pageId) return;
        if (msg.sessionId !== sessionId) return;
        setSelectionState(msg.selection);
        scrollCanvasToSelection(msg.selection);
        return;
      }

      if (msg.type === "cms-mutation-rejected") {
        if (msg.sessionId !== sessionId) return;
        if (import.meta.env.VITE_E2E_CMS) {
          const w = window as Window & {
            __cmsE2E?: {
              sessionId: string;
              revision: number;
              pageId: string | null;
              lastRejection?: { mutationId: string; reason: string; currentRevision: number };
            };
          };
          w.__cmsE2E = {
            sessionId: w.__cmsE2E?.sessionId ?? sessionId,
            revision: w.__cmsE2E?.revision ?? lastAppliedRevision.current,
            pageId,
            lastRejection: {
              mutationId: msg.mutationId,
              reason: msg.reason,
              currentRevision: msg.currentRevision,
            },
          };
        }
      }
    };

    const unsubscribe = addTrustedMessageListener(allowed, onMessage);

    postToParents({
      type: "cms-edit-ready",
      sessionId,
      pageId,
    });

    return unsubscribe;
  }, [isEdit, pageId, postToParents]);

  const api = React.useMemo<LiveEditApi>(
    () => ({
      draft: live,
      selection,
      setSelection,
      sendMutation,
      isEdit,
      pageId,
    }),
    [live, selection, setSelection, sendMutation, isEdit, pageId],
  );

  React.useEffect(() => {
    if (!import.meta.env.VITE_E2E_CMS) return;
    const w = window as Window & {
      __cmsE2E?: {
        sessionId: string;
        revision: number;
        pageId: string | null;
        lastRejection?: { mutationId: string; reason: string; currentRevision: number };
      };
    };
    w.__cmsE2E = {
      sessionId: live?.sessionId ?? sessionIdRef.current,
      revision: live?.revision ?? lastAppliedRevision.current,
      pageId,
      lastRejection: w.__cmsE2E?.lastRejection,
    };
    return () => {
      delete w.__cmsE2E;
    };
  }, [live, pageId]);

  return <LiveEditCtx.Provider value={api}>{children}</LiveEditCtx.Provider>;
}

