import type { CmsPage } from "@mccoy/cms-schema";
import { hydratePublishedCmsState, isPublishedCmsBundleHydrated } from "@/lib/cms/store";
import { clientDevError } from "@/lib/client-log";

let hydratePromise: Promise<boolean> | null = null;

async function fetchAndHydratePublishedBundle(): Promise<boolean> {
  try {
    const { getPublishedCmsBundle } = await import("@/lib/api/cms-published.functions");
    const bundle = await getPublishedCmsBundle();
    if (!bundle.ok) return false;
    const pages = JSON.parse(bundle.pagesJson) as CmsPage[];
    hydratePublishedCmsState({ pages });
    return true;
  } catch (error) {
    clientDevError("[cms] failed to load published bundle", error);
    return false;
  }
}

/**
 * Warm the published CMS memory store (nav + page bodies) without blocking first paint.
 * Safe to call multiple times — shares one in-flight request.
 */
export function ensurePublishedCmsHydrated(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (isPublishedCmsBundleHydrated()) return Promise.resolve(true);
  if (!hydratePromise) {
    hydratePromise = fetchAndHydratePublishedBundle().finally(() => {
      if (!isPublishedCmsBundleHydrated()) {
        // Allow retry on next intent if the first attempt failed.
        hydratePromise = null;
      }
    });
  }
  return hydratePromise;
}

/** Kick hydrate on nav hover/focus so the click can use the client-side page cache. */
export function warmPublishedCmsOnNavIntent(): void {
  void ensurePublishedCmsHydrated();
}
