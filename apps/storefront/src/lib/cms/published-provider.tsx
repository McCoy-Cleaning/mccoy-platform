import * as React from "react";
import { getPublishedCmsBundle } from "@/lib/api/cms-published.functions";
import {
  ensurePublishedChromeBroadcastListener,
  hydratePublishedCmsState,
} from "@/lib/cms/store";
import type { CmsPage } from "@mccoy/cms-schema";

async function loadPublishedBundle(): Promise<boolean> {
  try {
    const bundle = await getPublishedCmsBundle();
    if (!bundle.ok) return false;
    const pages = JSON.parse(bundle.pagesJson) as CmsPage[];
    // Durable nav = published pages with inNav (+ orphan filter in resolveStorefrontNavLinks).
    // Admin chrome sync may update memory sooner; focus/visibility refresh re-reads the file store.
    hydratePublishedCmsState({ pages });
    return true;
  } catch (error) {
    console.error("[cms] failed to load published bundle", error);
    return false;
  }
}

/**
 * B5 / Phase C — load published CMS from server (file or Supabase), not localStorage.
 * Navigation is derived from page.inNav so custom in-nav pages appear in Navbar/MobileMenu.
 *
 * Also re-fetches when the tab becomes visible so Opslaan → shared `.data` shows up even
 * when the cross-origin chrome iframe / BroadcastChannel bridge was missed.
 */
export function PublishedCmsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    ensurePublishedChromeBroadcastListener();
    let cancelled = false;
    void (async () => {
      await loadPublishedBundle();
      if (!cancelled) setReady(true);
    })();

    const refresh = () => {
      void loadPublishedBundle();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Render children immediately with seed SSR snapshot; hydrate when ready.
  void ready;
  return <>{children}</>;
}
