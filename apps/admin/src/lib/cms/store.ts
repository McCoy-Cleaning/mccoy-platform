/**
 * Admin CMS store façade (R6 / Stage 6).
 * Public API stays stable: `cms`, `useCms`, `useEditablePage`, etc.
 * Capability modules: store-persistence, store-draft, store-layout, store-en, store-publish.
 */
import * as React from "react";
import {
  applyDraftToPage,
  createPreviewSnapshot,
  effectiveOverrides,
  effectiveSiteFooter,
  effectiveSiteNavigation,
  resolvePreviewStatus,
  type CmsPage,
  type CmsPersistedState,
  type PreviewSnapshot,
  type SiteFooterContent,
  type SiteNavigationContent,
} from "@mccoy/cms-schema";
import { editablePage } from "./store-draft";
import { cmsEnApi } from "./store-en";
import { cmsLayoutApi } from "./store-layout";
import {
  bumpPreviewEpoch,
  clearMemoryState,
  EVENT,
  getServerSnapshot,
  getSnapshot,
  invalidateSnapshotCache,
  markPreviewStale,
  read,
  sessionPreviewSnapshots,
  sessionPreviewVersion,
} from "./store-persistence";
import { cmsPublishApi } from "./store-publish";

export type PagePreviewStatus = "locked" | "outdated" | "up_to_date";

export const cms = {
  getState: read,
  getPage(id: string) {
    return read().pages.find((p) => p.id === id);
  },
  /** Published page with draft layout/meta applied — use in editors. */
  getEditablePage(id: string) {
    return editablePage(read(), id);
  },

  ...cmsPublishApi,
  ...cmsLayoutApi,
  ...cmsEnApi,

  /* ============ Preview snapshot (session + postMessage) ============ */
  capturePreviewSnapshot(pageId: string): PreviewSnapshot | null {
    const s = read();
    const page = s.pages.find((p) => p.id === pageId);
    if (!page) return null;
    const draft = s.draft[pageId];
    const effectivePage = applyDraftToPage(page, draft);
    const overrides = effectiveOverrides(s.saved[pageId], draft);
    const version = bumpPreviewEpoch();
    const snap = createPreviewSnapshot(pageId, effectivePage, overrides, version);
    sessionPreviewSnapshots.set(pageId, snap);
    sessionPreviewVersion.set(pageId, snap.version);
    window.dispatchEvent(new Event(EVENT));
    return snap;
  },
  getSessionPreviewSnapshot(pageId: string): PreviewSnapshot | null {
    return sessionPreviewSnapshots.get(pageId) ?? null;
  },
  clearPreviewSnapshot(pageId: string) {
    sessionPreviewSnapshots.delete(pageId);
    markPreviewStale(pageId);
    window.dispatchEvent(new Event(EVENT));
  },
  getPreviewStatus(pageId: string): PagePreviewStatus {
    return resolvePreviewStatus(
      sessionPreviewSnapshots.get(pageId) ?? null,
      sessionPreviewVersion.get(pageId),
    ) as PagePreviewStatus;
  },
};

export function useCms(): CmsPersistedState {
  const subscribe = React.useCallback((cb: () => void) => {
    const onLocal = () => {
      invalidateSnapshotCache();
      cb();
    };
    const onStorage = () => {
      // Another tab changed disk — drop memory so we reload.
      invalidateSnapshotCache();
      clearMemoryState();
      cb();
    };
    window.addEventListener(EVENT, onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function usePreviewStatus(pageId: string): PagePreviewStatus {
  const state = useCms();
  void state.version;
  void state.draft[pageId];
  return cms.getPreviewStatus(pageId);
}

export function useEditablePage(pageId: string): CmsPage | undefined {
  const state = useCms();
  // Memoize: getEditablePage allocates a new object every call; returning a fresh
  // identity each render retriggers effects that depend on `page` (migration ensure,
  // AI provider, selection sync) and can cause Maximum update depth loops.
  return React.useMemo(() => {
    void state.version;
    return cms.getEditablePage(pageId);
  }, [pageId, state.version, state.draft[pageId], state.pages]);
}

export function useSiteNavigation(): SiteNavigationContent {
  const state = useCms();
  return effectiveSiteNavigation(state.navigation, state.navigationDraft ?? null);
}

export function useSiteFooter(): SiteFooterContent {
  const state = useCms();
  return effectiveSiteFooter(state.footer, state.footerDraft ?? null);
}
