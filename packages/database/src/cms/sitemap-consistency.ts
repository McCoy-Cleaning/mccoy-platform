/**
 * Phase 5 SEO — sitemap ↔ indexability consistency invariant.
 *
 * Every URL emitted by the sitemap (loc + xhtml:link href) must resolve as a
 * published, indexable, self-canonical www page (not redirect / 404 / 410 / noindex).
 * Conversely: legacy, alias, preview, and noindex paths must never appear.
 */

import {
  absoluteCanonicalUrl,
  buildCmsHeadFromSnapshot,
  CANONICAL_SITE_ORIGIN,
  robotsIndicateNoindex,
  stripLocalePrefix,
} from "@mccoy/cms-schema";
import { resolveLegacyUrlDecision } from "@mccoy/security";

import {
  forbiddenSitemapPathnames,
  isSitemapExcludedPathname,
} from "./sitemap-eligibility";
import { buildPublishedSitemapEntries, resolvePublicCmsRequest } from "./resolve";
import { DEFAULT_CMS_SITE_ID, type CmsStore } from "./types";

export type SitemapEntry = {
  loc: string;
  lastmod?: string;
  alternates: Array<{ locale: string; url: string }>;
};

export type SitemapConsistencyViolation = {
  url: string;
  reason: string;
};

export type SitemapConsistencyReport = {
  ok: boolean;
  sitemapUrls: string[];
  violations: SitemapConsistencyViolation[];
};

export { forbiddenSitemapPathnames, isSitemapExcludedPathname };

function normalizeAbsoluteUrl(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : absoluteCanonicalUrl(url));
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return `${u.protocol}//${u.host}${path === "/" ? "" : path}`;
  } catch {
    return url;
  }
}

/** Unique absolute URLs emitted in sitemap locs and alternate hrefs. */
export function collectSitemapEmittedUrls(entries: SitemapEntry[]): string[] {
  const urls = new Set<string>();
  for (const entry of entries) {
    urls.add(normalizeAbsoluteUrl(entry.loc));
    for (const alt of entry.alternates) {
      urls.add(normalizeAbsoluteUrl(alt.url));
    }
  }
  return [...urls].sort();
}

function robotsFromHead(meta: Array<Record<string, string>>): string | undefined {
  return meta.find((m) => m.name === "robots")?.content;
}

function canonicalFromHead(links: Array<{ rel: string; href: string }>): string | undefined {
  return links.find((l) => l.rel === "canonical")?.href;
}

/**
 * Cross-system check: sitemap emission vs public resolve + head policy + legacy map.
 */
export async function assertSitemapIndexabilityConsistency(input?: {
  store?: CmsStore;
  siteId?: string;
  /** Extra absolute or path URLs that must not appear (e.g. known noindex EN). */
  additionalForbiddenUrls?: string[];
}): Promise<SitemapConsistencyReport> {
  const store = input?.store;
  const siteId = input?.siteId ?? DEFAULT_CMS_SITE_ID;
  const entries = await buildPublishedSitemapEntries({ store, siteId });
  const sitemapUrls = collectSitemapEmittedUrls(entries);
  const sitemapSet = new Set(sitemapUrls);
  const violations: SitemapConsistencyViolation[] = [];

  for (const url of sitemapUrls) {
    let pathname: string;
    try {
      const parsed = new URL(url);
      if (parsed.origin !== CANONICAL_SITE_ORIGIN) {
        violations.push({
          url,
          reason: `sitemap URL host must be ${CANONICAL_SITE_ORIGIN}, got ${parsed.origin}`,
        });
        continue;
      }
      pathname = parsed.pathname;
    } catch {
      violations.push({ url, reason: "invalid absolute URL in sitemap" });
      continue;
    }

    if (isSitemapExcludedPathname(pathname)) {
      violations.push({
        url,
        reason: "excluded path (legacy / alias / preview) must not appear in sitemap",
      });
      continue;
    }

    const legacy = resolveLegacyUrlDecision(pathname);
    if (legacy) {
      violations.push({
        url,
        reason:
          legacy.kind === "gone"
            ? "HTTP 410 path must not appear in sitemap"
            : "HTTP 301 legacy redirect must not appear in sitemap",
      });
      continue;
    }

    if (!store) {
      violations.push({ url, reason: "store required to resolve public CMS path" });
      continue;
    }

    const resolved = await resolvePublicCmsRequest({ pathname, store, siteId });
    if (resolved.kind === "redirect") {
      violations.push({
        url,
        reason: `sitemap URL would redirect (HTTP ${resolved.statusCode} → ${resolved.toPath})`,
      });
      continue;
    }
    if (resolved.kind === "not_found") {
      violations.push({ url, reason: "sitemap URL would be HTTP 404" });
      continue;
    }

    const head = buildCmsHeadFromSnapshot(resolved.snapshot, {
      origin: CANONICAL_SITE_ORIGIN,
    });
    const robots = robotsFromHead(head.meta);
    if (robotsIndicateNoindex(robots)) {
      violations.push({
        url,
        reason: `sitemap URL is noindex (${robots ?? "noindex"})`,
      });
    }

    const expectedCanonical = absoluteCanonicalUrl(resolved.snapshot.path, CANONICAL_SITE_ORIGIN);
    const canonical = canonicalFromHead(head.links);
    if (!canonical) {
      violations.push({ url, reason: "missing self-canonical" });
    } else if (normalizeAbsoluteUrl(canonical) !== normalizeAbsoluteUrl(expectedCanonical)) {
      violations.push({
        url,
        reason: `canonical "${canonical}" does not match expected "${expectedCanonical}"`,
      });
    } else if (normalizeAbsoluteUrl(url) !== normalizeAbsoluteUrl(expectedCanonical)) {
      violations.push({
        url,
        reason: `sitemap URL is not self-canonical (expected ${expectedCanonical})`,
      });
    }

    const urlLocale = stripLocalePrefix(pathname).locale;
    if (resolved.snapshot.locale !== urlLocale) {
      violations.push({
        url,
        reason: `locale mismatch: URL locale ${urlLocale} vs snapshot ${resolved.snapshot.locale}`,
      });
    }
  }

  for (const path of forbiddenSitemapPathnames()) {
    const abs = absoluteCanonicalUrl(path, CANONICAL_SITE_ORIGIN);
    if (sitemapSet.has(normalizeAbsoluteUrl(abs))) {
      violations.push({
        url: abs,
        reason: "forbidden path present in sitemap",
      });
    }
  }

  for (const raw of input?.additionalForbiddenUrls ?? []) {
    const abs = normalizeAbsoluteUrl(
      raw.startsWith("http") ? raw : absoluteCanonicalUrl(raw, CANONICAL_SITE_ORIGIN),
    );
    if (sitemapSet.has(abs)) {
      violations.push({
        url: abs,
        reason: "explicitly forbidden URL present in sitemap",
      });
    }
  }

  return {
    ok: violations.length === 0,
    sitemapUrls,
    violations,
  };
}
