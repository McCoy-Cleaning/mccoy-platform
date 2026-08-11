/**
 * SEO-7 — centralized technical metadata resolution.
 *
 * Phase 6 may overlay deployed factual titles/descriptions via frozen SEO.
 * Canonical origin is always https://www.mccoy.nl for public head output.
 * Does not invent unsupported marketing claims or emit ranking keywords meta.
 */

import type { CmsSeo } from "./seo";
import type { SiteUrlConfig } from "./paths";
import type { ResolvedPublishedCmsPage } from "./resolve";

export const CANONICAL_SITE_ORIGIN = "https://www.mccoy.nl";

export type CmsHeadSnapshot = {
  title: string;
  meta: Array<Record<string, string>>;
  links: Array<{ rel: string; href: string; hrefLang?: string }>;
  jsonLd: Record<string, unknown>;
};

const PREVIEW_HOST_RE =
  /(^|\.)localhost$|(^|\.)local$|\.vercel\.app$|\.now\.sh$|^127\.0\.0\.1$|^0\.0\.0\.0$|^::1$/i;

/**
 * Fail-closed: preview/dev/admin hosts never become the public canonical origin.
 */
export function resolveCanonicalOrigin(candidate?: string | null): string {
  if (!candidate) return CANONICAL_SITE_ORIGIN;
  try {
    const url = new URL(candidate.includes("://") ? candidate : `https://${candidate}`);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:" && url.protocol !== "http:") return CANONICAL_SITE_ORIGIN;
    if (PREVIEW_HOST_RE.test(host)) return CANONICAL_SITE_ORIGIN;
    if (host === "admin.mccoy.nl") return CANONICAL_SITE_ORIGIN;
    if (host === "www.mccoy.nl" || host === "mccoy.nl") return CANONICAL_SITE_ORIGIN;
    return CANONICAL_SITE_ORIGIN;
  } catch {
    return CANONICAL_SITE_ORIGIN;
  }
}

/** Absolute public URL for a path on the canonical host. */
export function absoluteCanonicalUrl(pathname: string, origin = CANONICAL_SITE_ORIGIN): string {
  const base = resolveCanonicalOrigin(origin).replace(/\/+$/, "");
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (path === "/") return base;
  return `${base}${path.replace(/\/+$/, "")}`;
}

export type ResolveSeoMetadataOptions = {
  /**
   * Optional frozen deployed SEO fields (SEO-7 ≠ SEO-8).
   * When provided, overlays snapshot.content.seo without inventing new marketing copy.
   */
  seo?: Partial<CmsSeo>;
  /** Extra JSON-LD nodes merged into @graph when present; otherwise single WebPage. */
  extraJsonLd?: Record<string, unknown>[];
};

function breadcrumbList(absolute: string, path: string): Record<string, unknown> | null {
  const segments = path.replace(/\/+$/, "").split("/").filter(Boolean);
  if (segments.length === 0) return null;
  const origin = CANONICAL_SITE_ORIGIN;
  const items: Array<Record<string, unknown>> = [
    {
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: origin,
    },
  ];
  let acc = "";
  segments.forEach((seg, i) => {
    acc += `/${seg}`;
    items.push({
      "@type": "ListItem",
      position: i + 2,
      name: seg,
      item: `${origin}${acc}`,
    });
  });
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
    "@id": `${absolute}#breadcrumb`,
  };
}

/**
 * Build technical head from an already-resolved published snapshot.
 * Never rewrites titles/descriptions for keyword optimization.
 */
export function resolveSeoMetadata(
  snapshot: ResolvedPublishedCmsPage,
  site: SiteUrlConfig,
  options?: ResolveSeoMetadataOptions,
): CmsHeadSnapshot {
  const origin = resolveCanonicalOrigin(site.origin);
  const seo: CmsSeo = {
    ...snapshot.content.seo,
    ...options?.seo,
  };
  const absolute = absoluteCanonicalUrl(snapshot.path, origin);

  // og:locale must match the URL locale (NL → nl_NL, EN → en_GB).
  const ogLocale = snapshot.locale === "en" ? "en_GB" : "nl_NL";
  const ogLocaleAlternate = snapshot.locale === "en" ? "nl_NL" : "en_GB";

  const meta: Array<Record<string, string>> = [
    { title: seo.title },
    { name: "description", content: seo.description },
    { property: "og:title", content: seo.title },
    { property: "og:description", content: seo.description },
    { property: "og:url", content: absolute },
    { property: "og:locale", content: ogLocale },
    { property: "og:locale:alternate", content: ogLocaleAlternate },
  ];
  // Do not emit <meta name="keywords"> for ranking — field ignored if present on CmsSeo.
  if (seo.robots) meta.push({ name: "robots", content: seo.robots });
  if (seo.ogImage) meta.push({ property: "og:image", content: seo.ogImage });

  const links: Array<{ rel: string; href: string; hrefLang?: string }> = [
    { rel: "canonical", href: absolute },
  ];
  // snapshot.alternates already exclude unpublished / non-indexable peers.
  for (const alt of snapshot.alternates) {
    const href = absoluteCanonicalUrl(new URL(alt.url, origin).pathname, origin);
    links.push({
      rel: "alternate",
      hrefLang: alt.locale,
      href,
    });
  }

  const webPage: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": absolute,
    url: absolute,
    name: seo.title,
    description: seo.description,
    inLanguage: snapshot.locale,
    dateModified: snapshot.publishedAt,
    isPartOf: {
      "@type": "WebSite",
      name: "McCoy Cleaning",
      url: origin,
    },
  };

  const crumbs = breadcrumbList(absolute, snapshot.path);
  const extras = options?.extraJsonLd ?? [];
  let jsonLd: Record<string, unknown> = webPage;
  if (crumbs || extras.length > 0) {
    jsonLd = {
      "@context": "https://schema.org",
      "@graph": [webPage, ...(crumbs ? [crumbs] : []), ...extras],
    };
  }

  return { title: seo.title, meta, links, jsonLd };
}

/** Assert JSON-LD payload is parseable JSON and contains no invented review/rating claims. */
export function assertFactOnlyJsonLd(payload: unknown): void {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload);
  const parsed = JSON.parse(text) as unknown;
  const stack: unknown[] = [parsed];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    const obj = node as Record<string, unknown>;
    if ("aggregateRating" in obj || "reviewRating" in obj) {
      throw new Error("json-ld: invented ratings/reviews are forbidden");
    }
    if (obj["@type"] === "Review" || obj["@type"] === "AggregateRating") {
      throw new Error("json-ld: Review/AggregateRating nodes are forbidden without sourced facts");
    }
    for (const value of Object.values(obj)) stack.push(value);
  }
}
