import * as React from "react";
import { ensurePublishedChromeBroadcastListener } from "@/lib/cms/store";
import { ensurePublishedCmsHydrated } from "@/lib/cms/published-hydrate";

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
  React.useEffect(() => {
    ensurePublishedChromeBroadcastListener();
    let cancelled = false;
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      if (cancelled) return;
      void ensurePublishedCmsHydrated();
    };

    // Prefer a short idle window so SPA nav can hit the client page cache sooner.
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      idleId = window.requestIdleCallback(run, { timeout: 900 });
    } else {
      timeoutId = setTimeout(run, 1);
    }

    const refresh = () => {
      void ensurePublishedCmsHydrated();
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

  return <>{children}</>;
}
