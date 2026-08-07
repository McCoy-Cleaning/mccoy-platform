import * as React from "react";
import { ensurePublishedChromeBroadcastListener } from "@/lib/cms/store";
import { ensurePublishedCmsHydrated } from "@/lib/cms/published-hydrate";

/**
 * Load published CMS after first paint so homepage LCP is not blocked, then
 * keep memory warm for instant SPA navigations.
 */
export function PublishedCmsProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    ensurePublishedChromeBroadcastListener();
    let cancelled = false;
    let raf = 0;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const run = () => {
      if (cancelled) return;
      void ensurePublishedCmsHydrated();
    };

    // Next frame + short timeout: sooner than a long idle window so the first
    // nav click usually hits the client page cache.
    raf = window.requestAnimationFrame(() => {
      timeoutId = setTimeout(run, 120);
    });

    const refresh = () => {
      void ensurePublishedCmsHydrated();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const onPointer = () => {
      run();
      window.removeEventListener("pointerdown", onPointer, true);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pointerdown", onPointer, true);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(raf);
      if (timeoutId != null) clearTimeout(timeoutId);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointerdown", onPointer, true);
    };
  }, []);

  return <>{children}</>;
}
