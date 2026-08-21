import type { ReactNode } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";
import { EdgeSeoOverlayProvider } from "@/lib/cms/aether-edge-overlay-context";
import type { EdgePagePatch } from "@/lib/cms/aether-edge-overlay";

/**
 * Persistent storefront chrome so SPA navigations do not remount the header
 * (and flash a blank shell while the next route loader resolves).
 *
 * Footer is eager (not lazy): the admin edit iframe must always show it so
 * editors can scroll to and work with site chrome; lazy+Suspense(null) hid it.
 */
function edgePatchFromMatches(matches: ReadonlyArray<{ loaderData?: unknown }>): EdgePagePatch | null {
  for (const match of matches) {
    const data = match.loaderData;
    if (data && typeof data === "object" && "edgePatch" in data) {
      const patch = (data as { edgePatch?: EdgePagePatch | null }).edgePatch;
      if (patch) return patch;
      return null;
    }
  }
  return null;
}

export function MarketingChrome({ children }: { children: ReactNode }) {
  const patch = useRouterState({
    select: (s) => edgePatchFromMatches(s.matches),
  });
  return (
    <EdgeSeoOverlayProvider patch={patch}>
      <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
        <Navbar />
        {children}
        <Footer />
      </div>
    </EdgeSeoOverlayProvider>
  );
}