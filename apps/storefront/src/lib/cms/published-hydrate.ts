import {
  parseSiteFooterResult,
  parseSiteNavigationResult,
  type CmsPage,
  type SiteFooterContent,
  type SiteNavigationContent,
} from "@mccoy/cms-schema";
import { hydratePublishedCmsState, isPublishedCmsBundleHydrated } from "@/lib/cms/store";
import { clientDevError } from "@/lib/client-log";

let hydratePromise: Promise<boolean> | null = null;

function parseBundleChrome(
  navigationJson: string | null | undefined,
  footerJson: string | null | undefined,
): {
  navigation?: SiteNavigationContent;
  footer?: SiteFooterContent;
} {
  let navigation: SiteNavigationContent | undefined;
  let footer: SiteFooterContent | undefined;
  if (typeof navigationJson === "string" && navigationJson.length > 0) {
    try {
      const parsed = parseSiteNavigationResult(JSON.parse(navigationJson) as unknown);
      if (parsed.ok) navigation = parsed.data;
    } catch {
      /* ignore corrupt durable chrome */
    }
  }
  if (typeof footerJson === "string" && footerJson.length > 0) {
    try {
      const parsed = parseSiteFooterResult(JSON.parse(footerJson) as unknown);
      if (parsed.ok) footer = parsed.data;
    } catch {
      /* ignore corrupt durable chrome */
    }
  }
  return { navigation, footer };
}

async function fetchAndHydratePublishedBundle(): Promise<boolean> {
  try {
    const { getPublishedCmsBundle } = await import("@/lib/api/cms-published.functions");
    const bundle = await getPublishedCmsBundle();
    if (!bundle.ok) return false;
    const pages = JSON.parse(bundle.pagesJson) as CmsPage[];
    const chrome = parseBundleChrome(
      "navigationJson" in bundle ? bundle.navigationJson : null,
      "footerJson" in bundle ? bundle.footerJson : null,
    );
    hydratePublishedCmsState({ pages, ...chrome });
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
