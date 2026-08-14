import { redirect } from "@tanstack/react-router";
import {
  buildCmsHeadFromSnapshot,
  CANONICAL_SITE_ORIGIN,
  canonicalizePublicIdentityPath,
  resolvePublishedCmsPage,
  resolveSeoMetadata,
  stripLocalePrefix,
  type CmsPage,
  type ResolvedPublishedCmsPage,
} from "@mccoy/cms-schema";
import { cms, isPublishedCmsBundleHydrated } from "@/lib/cms/store";
import { ensurePublishedCmsHydrated } from "@/lib/cms/published-hydrate";
import {
  FROZEN_DEPLOYED_EN_SEO,
  FROZEN_DEPLOYED_NL_SEO,
} from "@/lib/cms/frozen-deployed-seo";

const BUILTIN_PATH_TO_PAGE_ID: Record<string, string> = {
  "/": "page_home",
  "/about": "page_about",
  "/services": "page_services",
  "/products": "page_products",
  "/contact": "page_contact",
  "/vacatures": "page_vacatures",
  "/offerte": "page_offerte",
  "/privacy": "page_privacy",
  "/terms": "page_terms",
};

export type MarketingPageLoaderData = {
  snapshot: ResolvedPublishedCmsPage;
  head: ReturnType<typeof buildCmsHeadFromSnapshot>;
};

function identityPath(pathname: string): string {
  return canonicalizePublicIdentityPath(
    stripLocalePrefix(pathname).path.replace(/\/+$/, "") || "/",
  );
}

function pathnameLocale(pathname: string): "nl" | "en" {
  const trimmed = pathname.replace(/\/+$/, "") || "/";
  return trimmed === "/en" || trimmed.startsWith("/en/") ? "en" : "nl";
}

function headFromSnapshot(snapshot: ResolvedPublishedCmsPage, pathname: string) {
  const identity = identityPath(pathname);
  const locale = pathnameLocale(pathname);
  const frozen =
    locale === "en" ? FROZEN_DEPLOYED_EN_SEO[identity] : FROZEN_DEPLOYED_NL_SEO[identity];
  // Always emit www canonicals — never window / preview origin (SEO Safe Mode).
  return resolveSeoMetadata(snapshot, { origin: CANONICAL_SITE_ORIGIN }, { seo: frozen });
}

/**
 * Build a client snapshot only from the real published bundle. The store also
 * contains same-id seed pages, but those are loading sentinels rather than
 * publishable content and must never become a route's first visible page.
 */
export function publishedClientSnapshotForPage(
  pathname: string,
  page: CmsPage | undefined,
  bundleHydrated: boolean,
): MarketingPageLoaderData | null {
  if (!bundleHydrated || !page || page.isDraftOnly) return null;
  const identity = identityPath(pathname);
  const pageId = BUILTIN_PATH_TO_PAGE_ID[identity];
  if (!pageId) return null;
  if (page.id !== pageId) return null;

  const locale = pathnameLocale(pathname);
  const resolved = resolvePublishedCmsPage({
    page,
    revisionId: `client:${page.id}:${page.updatedAt ?? 0}`,
    publishedAt: new Date(page.updatedAt ?? Date.now()).toISOString(),
    locale,
    site: { origin: CANONICAL_SITE_ORIGIN },
  });
  if (!resolved.ok) return null;
  return {
    snapshot: resolved.snapshot,
    head: headFromSnapshot(resolved.snapshot, pathname),
  };
}

/**
 * Instant SPA navigations may reuse a matching, validated published page.
 * Before bundle hydration, wait for the route server snapshot instead of
 * flashing generic seed content from another page/locale state.
 */
function snapshotFromClientMemory(pathname: string): MarketingPageLoaderData | null {
  if (typeof window === "undefined") return null;
  const pageId = BUILTIN_PATH_TO_PAGE_ID[identityPath(pathname)];
  const page = pageId ? cms.getPage(pageId) : undefined;
  return publishedClientSnapshotForPage(
    pathname,
    page,
    isPublishedCmsBundleHydrated(),
  );
}

/**
 * Shared marketing-page loader: client memory first, server fn fallback.
 */
export async function loadMarketingPublishedPage(pathname: string): Promise<MarketingPageLoaderData> {
  const cached = snapshotFromClientMemory(pathname);
  if (cached) {
    // Refresh published bundle in the background without blocking navigation.
    void ensurePublishedCmsHydrated();
    return cached;
  }

  // Cold path: kick hydrate and wait for server snapshot (SSR / first visit).
  void ensurePublishedCmsHydrated();
  const { loadPublishedPageForPath } = await import("@/lib/api/cms-published.functions");
  const { resultJson } = await loadPublishedPageForPath({ data: { pathname } });
  const result = JSON.parse(resultJson) as
    | { kind: "snapshot"; snapshot: ResolvedPublishedCmsPage; head: MarketingPageLoaderData["head"] }
    | { kind: "redirect"; toPath: string; statusCode: number }
    | { kind: "not_found" };

  if (result.kind === "redirect") {
    throw redirect({ href: result.toPath, statusCode: result.statusCode as 301 | 302 | 308 });
  }
  if (result.kind !== "snapshot") {
    throw new Error(`cms: loader for ${pathname} must return a snapshot`);
  }
  // Re-resolve head with frozen deployed NL SEO + canonical origin (ignore any preview origin).
  return {
    snapshot: result.snapshot,
    head: headFromSnapshot(result.snapshot, pathname),
  };
}

/** Prefetch a marketing path into the router loader cache (nav hover). */
export function prefetchMarketingPage(pathname: string): void {
  if (typeof window === "undefined") return;
  void loadMarketingPublishedPage(pathname).catch(() => {
    /* ignore prefetch errors */
  });
}
