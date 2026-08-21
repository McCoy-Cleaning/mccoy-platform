import {
  buildCmsHeadFromSnapshot,
  canonicalizePublicIdentityPath,
  getPublishedLocaleAlternates,
  isEnglishLegalDutchBleed,
  normalizeCmsPath,
  resolveCanonicalOrigin,
  resolveEnglishPathAccess,
  resolvePublishedCmsPage,
  robotsIndicateNoindex,
  stripLocalePrefix,
  type CmsRedirect,
  type Locale,
  type ResolvedPublishedCmsPage,
  type SiteUrlConfig,
} from "@mccoy/cms-schema";

import { isSitemapExcludedPathname } from "./sitemap-eligibility";
import { DEFAULT_CMS_SITE_ID, type CmsStore } from "./types";
import { getCmsStore } from "./supabase-store";

export type PublicCmsResolveResult =
  | { kind: "snapshot"; snapshot: ResolvedPublishedCmsPage; site: SiteUrlConfig }
  | {
      kind: "redirect";
      statusCode: 301 | 302 | 308;
      toPath: string;
    }
  | { kind: "not_found" };

/**
 * Phase C public resolver — URL locale + published snapshot or locked redirect policy.
 */
export async function resolvePublicCmsRequest(input: {
  pathname: string;
  store?: CmsStore;
  siteId?: string;
  authenticatedPreview?: boolean;
  previewLocale?: Locale | null;
}): Promise<PublicCmsResolveResult> {
  const store = input.store ?? getCmsStore();
  const siteId = input.siteId ?? DEFAULT_CMS_SITE_ID;
  const siteRecord = await store.getSite(siteId);
  const site: SiteUrlConfig = { origin: siteRecord.origin };

  const stripped = stripLocalePrefix(input.pathname);
  let locale: Locale = stripped.locale;
  if (
    input.authenticatedPreview &&
    (input.previewLocale === "nl" || input.previewLocale === "en")
  ) {
    locale = input.previewLocale;
  }

  const identityPath = canonicalizePublicIdentityPath(stripped.path);
  const requestedPublicPath = normalizeCmsPath(locale, input.pathname);
  const publicPath = normalizeCmsPath(locale, identityPath);

  // Alias slug under /en (or NL) → permanent redirect to the canonical public path.
  if (requestedPublicPath !== publicPath) {
    return { kind: "redirect", statusCode: 301, toPath: publicPath };
  }

  const redirects = await store.listActiveRedirects(siteId);
  const cmsRedirects: CmsRedirect[] = redirects.map((r) => ({
    id: r.id,
    locale: r.locale,
    fromPath: r.fromPath,
    toPath: r.toPath,
    statusCode: r.statusCode,
    createdAt: r.createdAt,
  }));

  const published = await store.findPublishedByPublicPath(locale, publicPath, siteId);

  if (locale === "en") {
    // Known page: NL sibling exists under same identity path
    const nlPublic = normalizeCmsPath("nl", identityPath);
    const nlPublished = await store.findPublishedByPublicPath("nl", nlPublic, siteId);
    const knownPage = Boolean(nlPublished);
    const englishPublished = Boolean(published);
    const dutchPath = nlPublished?.localeState.publicPath ?? nlPublic;

    const access = resolveEnglishPathAccess({
      knownPage,
      englishPublished,
      dutchPath,
      requestPath: publicPath,
      redirects: cmsRedirects,
    });

    if (access.action === "redirect_pending") {
      return { kind: "redirect", statusCode: 302, toPath: access.toPath };
    }
    if (access.action === "redirect_retired") {
      return { kind: "redirect", statusCode: access.statusCode, toPath: access.toPath };
    }
    if (access.action === "not_found") {
      return { kind: "not_found" };
    }
  } else {
    const retired = cmsRedirects.find(
      (r) => r.locale === "nl" && normalizeCmsPath("nl", r.fromPath) === publicPath,
    );
    if (retired && !published) {
      return { kind: "redirect", statusCode: retired.statusCode, toPath: retired.toPath };
    }
  }

  if (!published) return { kind: "not_found" };

  const resolved = resolvePublishedCmsPage({
    page: published.page,
    revisionId: published.revisionId,
    publishedAt: published.publishedAt,
    locale,
    site,
    siteConfigVersion: siteRecord.configVersion,
  });

  if (!resolved.ok) {
    if (locale === "en") {
      const nlPublic = normalizeCmsPath("nl", identityPath);
      return { kind: "redirect", statusCode: 302, toPath: nlPublic };
    }
    return { kind: "not_found" };
  }

  return { kind: "snapshot", snapshot: resolved.snapshot, site };
}

export async function buildPublishedSitemapEntries(input?: {
  store?: CmsStore;
  siteId?: string;
}): Promise<
  Array<{
    loc: string;
    lastmod?: string;
    alternates: Array<{ locale: string; url: string }>;
  }>
> {
  const store = input?.store ?? getCmsStore();
  const siteId = input?.siteId ?? DEFAULT_CMS_SITE_ID;
  const siteRecord = await store.getSite(siteId);
  // Fail-closed: never emit preview/localhost origins in sitemap locs.
  const site: SiteUrlConfig = { origin: resolveCanonicalOrigin(siteRecord.origin) };
  const published = await store.listPublishedLocaleStates(siteId);

  const byPage = new Map<string, typeof published>();
  for (const row of published) {
    const list = byPage.get(row.pageId) ?? [];
    list.push(row);
    byPage.set(row.pageId, list);
  }

  const revisions = await store.listActivePublishedRevisions(siteId);
  const revByPageId = new Map(revisions.map((r) => [r.pageId, r]));

  const entries: Array<{
    loc: string;
    lastmod?: string;
    alternates: Array<{ locale: string; url: string }>;
  }> = [];

  for (const [pageId] of byPage) {
    const rev = revByPageId.get(pageId);
    if (!rev) continue;
    const page = rev.payload;
    const paths = page.paths ?? { nl: page.slug };
    const enLegalBleed = isEnglishLegalDutchBleed(page);
    const localeStates = {
      nl: {
        publicationState: page.localeStates?.nl?.publicationState ?? "missing",
        indexable: !robotsIndicateNoindex(page.localeContent?.nl?.seo?.robots),
      },
      en: page.localeStates?.en
        ? {
            publicationState: page.localeStates.en.publicationState,
            indexable:
              page.localeStates.en.publicationState === "published" &&
              !enLegalBleed &&
              !robotsIndicateNoindex(page.localeContent?.en?.seo?.robots),
          }
        : undefined,
    };
    const alts = getPublishedLocaleAlternates(paths, localeStates, site);
    const alternateLinks = alts
      .filter((a) => {
        try {
          return !isSitemapExcludedPathname(new URL(a.url).pathname);
        } catch {
          return false;
        }
      })
      .map((a) => ({ locale: a.locale, url: a.url }));

    // One <url> per indexable locale (nl / en). x-default stays an alternate only.
    // Phase 3: Dutch-bleed / noindex EN is already omitted via indexable=false.
    for (const alt of alts) {
      if (alt.locale !== "nl" && alt.locale !== "en") continue;
      let pathname: string;
      try {
        pathname = new URL(alt.url).pathname;
      } catch {
        continue;
      }
      if (isSitemapExcludedPathname(pathname)) continue;
      entries.push({
        loc: alt.url,
        lastmod: rev.publishedAt ?? undefined,
        alternates: alternateLinks,
      });
    }
  }

  return entries;
}

export { buildCmsHeadFromSnapshot, resolvePublishedCmsPage };
