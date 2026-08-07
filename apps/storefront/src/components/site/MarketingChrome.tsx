import type { ReactNode } from "react";
import { Navbar } from "@/components/site/Navbar";
import { Footer } from "@/components/site/Footer";

/**
 * Persistent storefront chrome so SPA navigations do not remount the header
 * (and flash a blank shell while the next route loader resolves).
 *
 * Footer is eager (not lazy): the admin edit iframe must always show it so
 * editors can scroll to and work with site chrome; lazy+Suspense(null) hid it.
 */
export function MarketingChrome({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <Navbar />
      {children}
      <Footer />
    </div>
  );
}
