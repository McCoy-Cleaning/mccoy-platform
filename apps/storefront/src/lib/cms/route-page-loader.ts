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
import {
  applyEdgeHead,
  edgeDocumentFromDump,
  lookupEdgePatch,
  type EdgePagePatch,
} from "@/lib/cms/aether-edge-overlay";

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
  edgePatch: EdgePagePatch | null;
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

function headFromSnapshot(
  snapshot: ResolvedPublishedCmsPage,
  pathname: string,
  edgePatch: EdgePagePatch | null,
) {
  const identity = identityPath(pathname);
  const locale = pathnameLocale(pathname);
  const frozen =
    locale === "en" ? FROZEN_DEPLOYED_EN_SEO[identity] : FROZEN_DEPLOYED_NL_SEO[identity];
  const head = resolveSeoMetadata(snapshot, { origin: CANONICAL_SITE_ORIGIN }, { seo: frozen });
  return applyEdgeHead(head, edgePatch);
}

async function loadEdgePatchForPath(pathname: string): Promise<EdgePagePatch | null> {
  if (typeof window === "undefined") {
    const { loadEdgePatchesDocument } = await import("@/lib/cms/aether-edge-overlay.server");
    const doc = await loadEdgePatchesDocument();
    return lookupEdgePatch(doc, pathname);
  }
  try {
    const res = await fetch("/aether-edge-patches.json", { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return lookupEdgePatch(edgeDocumentFromDump(await res.json()), pathname);
  } catch {
    return null;
  }
}

export function publishedClientSnapshotForPage(
  pathname: string,
  page: CmsPage | undefined,
  bundleHydrated: boolean,
  edgePatch: EdgePagePatch | null = null,
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
    head: headFromSnapshot(resolved.snapshot, pathname, edgePatch),
    edgePatch,
  };
}

function snapshotFromClientMemory(
  pathname: string,
  edgePatch: EdgePagePatch | null,
): MarketingPageLoaderData | null {
  if (typeof window === "undefined") return null;
  const pageId = BUILTIN_PATH_TO_PAGE_ID[identityPath(pathname)];
  const page = pageId ? cms.getPage(pageId) : undefined;
  return publishedClientSnapshotForPage(
    pathname,
    page,
    isPublishedCmsBundleHydrated(),
    edgePatch,
  );
}

export async function loadMarketingPublishedPage(pathname: string): Promise<MarketingPageLoaderData> {
  const edgePatch = await loadEdgePatchForPath(pathname);
  const cached = snapshotFromClientMemory(pathname, edgePatch);
  if (cached) {
    void ensurePublishedCmsHydrated();
    return cached;
  }

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
  return {
    snapshot: result.snapshot,
    head: headFromSnapshot(result.snapshot, pathname, edgePatch),
    edgePatch,
  };
}

export function prefetchMarketingPage(pathname: string): void {
  if (typeof window === "undefined") return;
  void loadMarketingPublishedPage(pathname).catch(() => {
    /* ignore prefetch errors */
  });
}
