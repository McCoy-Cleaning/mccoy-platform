import { lazy, Suspense, type ReactNode } from "react";
import { Navbar } from "@/components/site/Navbar";

/** Below-fold — keep lucide social icons off the critical path. */
const Footer = lazy(() =>
  import("@/components/site/Footer").then((m) => ({ default: m.Footer })),
);

/**
 * Persistent storefront chrome so SPA navigations do not remount the header
 * (and flash a blank shell while the next route loader resolves).
 */
export function MarketingChrome({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Navbar />
      {children}
      <Suspense fallback={null}>
        <Footer />
      </Suspense>
    </div>
  );
}
