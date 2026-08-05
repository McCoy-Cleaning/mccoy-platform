import {
  buildCmsHeadFromSnapshot,
  canonicalizePublicIdentityPath,
  getPublishedLocaleAlternates,
  normalizeCmsPath,
  resolveEnglishPathAccess,
  resolvePublishedCmsPage,
  stripLocalePrefix,
  type CmsRedirect,
  type Locale,
  type ResolvedPublishedCmsPage,
  type SiteUrlConfig,
} from "@mccoy/cms-schema";

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
  const site: SiteUrlConfig = { origin: siteRecord.origin };
  const published = await store.listPublishedLocaleStates(siteId);

  const byPage = new Map<string, typeof published>();
  for (const row of published) {
    const list = byPage.get(row.pageId) ?? [];
    list.push(row);
    byPage.set(row.pageId, list);
  }

  const entries: Array<{
    loc: string;
    lastmod?: string;
    alternates: Array<{ locale: string; url: string }>;
  }> = [];

  for (const [pageId, rows] of byPage) {
    const rev = await store.getActivePublishedRevision(pageId, siteId);
    if (!rev) continue;
    const page = rev.payload;
    const paths = page.paths ?? { nl: page.slug };
    const localeStates = {
      nl: {
        publicationState: page.localeStates?.nl?.publicationState ?? "missing",
      },
      en: page.localeStates?.en
        ? { publicationState: page.localeStates.en.publicationState }
        : undefined,
    };
    const alts = getPublishedLocaleAlternates(paths, localeStates, site);
    const nl = alts.find((a) => a.locale === "nl");
    if (!nl) continue;
    entries.push({
      loc: nl.url,
      lastmod: rev.publishedAt ?? undefined,
      alternates: alts.map((a) => ({ locale: a.locale, url: a.url })),
    });
  }

  return entries;
}

export { buildCmsHeadFromSnapshot, resolvePublishedCmsPage };
