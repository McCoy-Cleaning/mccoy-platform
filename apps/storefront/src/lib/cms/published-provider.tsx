import * as React from "react";
import {
  ensurePublishedChromeBroadcastListener,
  hydratePublishedCmsState,
} from "@/lib/cms/store";
import type { CmsPage } from "@mccoy/cms-schema";
import { clientDevError } from "@/lib/client-log";

async function loadPublishedBundle(): Promise<CmsPage[] | null> {
  try {
    // Dynamic import keeps server-fn stubs off the homepage critical chunk;
    // this only runs after idle / first paint.
    const { getPublishedCmsBundle } = await import("@/lib/api/cms-published.functions");
    const bundle = await getPublishedCmsBundle();
    if (!bundle.ok) return null;
    const pages = JSON.parse(bundle.pagesJson) as CmsPage[];
    // Durable nav = published pages with inNav (+ orphan filter in resolveStorefrontNavLinks).
    // Admin chrome sync may update memory sooner; focus/visibility refresh re-reads the file store.
    hydratePublishedCmsState({ pages });
    return pages;
  } catch (error) {
    clientDevError("[cms] failed to load published bundle", error);
    return null;
  }
}

/**
 * B5 / Phase C — load published CMS from server (file or Supabase), not localStorage.
 * Navigation is derived from page.inNav so custom in-nav pages appear in Navbar/MobileMenu.
 *
 * Deferred until after first paint / idle so homepage LCP is not blocked by the
 * full published bundle round-trip (route loaders already supply the page body).
 *
 * Also re-fetches when the tab becomes visible so Opslaan → shared `.data` shows up even
 * when the cross-origin chrome iframe / BroadcastChannel bridge was missed.
 *
 * Route bodies prefer a newer hydrated page over a stale loader snapshot via
 * `useCmsPageForView` (SSR snapshot cache is also keyed by site configVersion).
 */
export function PublishedCmsProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    ensurePublishedChromeBroadcastListener();
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      if (cancelled) return;
      void (async () => {
        await loadPublishedBundle();
        if (cancelled) return;
        setReady(true);
      })();
    };

    // After LCP opportunity: idle when available, else short timeout.
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(run, 1);
    }

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
      if (idleId != null && "cancelIdleCallback" in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) clearTimeout(timeoutId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Render children immediately with seed SSR snapshot; hydrate when ready.
  void ready;
  return <>{children}</>;
}
