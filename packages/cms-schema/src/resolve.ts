/**
 * Phase C — Resolved published CMS snapshot shared by loader, head, JSON-LD, and body.
 */
import type { Locale, LocaleState } from "./locale";
import type { CmsPageLocaleContent } from "./seo";
import {
  getPublishedLocaleAlternates,
  normalizeCmsPath,
  type LocaleAlternate,
  type LocalizedPagePath,
  type SiteUrlConfig,
} from "./paths";
import type { CmsPage } from "./types";
import { ensurePageLocaleFields } from "./migrate-locale";
import { localizeCmsPageForLocale } from "./en-field-drafts";
import { normalizeCmsPage } from "./pipeline";

export type ResolvedSection = {
  key: string;
  content: unknown;
};

export type ResolvedPublishedCmsPage = {
  pageId: string;
  revisionId: string;
  locale: Locale;
  path: string;
  content: CmsPageLocaleContent;
  /** Full page payload for layout/section renderers. */
  page: CmsPage;
  sections: ResolvedSection[];
  alternates: LocaleAlternate[];
  publishedAt: string;
  localeStates: { nl: LocaleState; en?: LocaleState };
  cacheKey: string;
};

export type LocaleResolution = {
  locale: Locale;
  source: "url" | "authenticated_preview";
};

export type ResolvePublishedCmsPageInput = {
  page: CmsPage;
  revisionId: string;
  publishedAt: string;
  locale: Locale;
  site: SiteUrlConfig;
  siteConfigVersion?: number;
  seoBuilderVersion?: string;
};

export type ResolvePublishedCmsPageResult =
  | { ok: true; snapshot: ResolvedPublishedCmsPage }
  | { ok: false; reason: "locale_not_published" | "missing_content" };

/**
 * Build one immutable public snapshot. Head and body must consume this object only.
 * Never falls back to Dutch body when locale is `en`.
 *
 * Normalizes the page so required fixed sections (e.g. contact.info / contact.form)
 * are restored even when an older published revision omitted them.
 */
export function resolvePublishedCmsPage(
  input: ResolvePublishedCmsPageInput,
): ResolvePublishedCmsPageResult {
  const page = normalizeCmsPage(ensurePageLocaleFields(input.page));
  const localeStates = page.localeStates ?? {
    nl: { publicationState: "published" as const, freshness: "current" as const },
  };
  const state = localeStates[input.locale];
  if (!state || state.publicationState !== "published") {
    return { ok: false, reason: "locale_not_published" };
  }

  // EN may be marked published before localeContent.en exists (older revisions /
  // missing SEO bag). Prefer EN meta drafts, then NL bag title/description.
  let localeContent = page.localeContent?.[input.locale];
  if (!localeContent && input.locale === "en") {
    const enTitle =
      page.enFieldDrafts?.["page:meta:title"]?.trim() ||
      page.localeContent?.nl?.pageTitle ||
      page.title;
    const enDesc =
      page.enFieldDrafts?.["page:meta:description"]?.trim() ||
      page.localeContent?.nl?.seo.description ||
      page.description;
    localeContent = {
      navigationLabel: enTitle,
      pageTitle: enTitle,
      seo: { title: enTitle, description: enDesc },
    };
  }
  if (!localeContent) {
    return { ok: false, reason: "missing_content" };
  }

  const paths = page.paths ?? { nl: page.slug };
  const path =
    input.locale === "en"
      ? normalizeCmsPath("en", paths.en ?? paths.nl)
      : normalizeCmsPath("nl", paths.nl);

  const alternates = getPublishedLocaleAlternates(
    paths as LocalizedPagePath,
    {
      nl: { publicationState: localeStates.nl.publicationState },
      en: localeStates.en
        ? { publicationState: localeStates.en.publicationState }
        : undefined,
    },
    input.site,
  );

  // Body follows the requested locale: EN overlays enFieldDrafts onto NL base fields.
  // Never serve Dutch SEO under /en (checked above); never ignore stored EN section drafts.
  const localizedPage = localizeCmsPageForLocale(page, input.locale);

  const sections: ResolvedSection[] = [];
  if (localizedPage.kind === "builtin" && localizedPage.sectionContent) {
    for (const [key, content] of Object.entries(localizedPage.sectionContent)) {
      sections.push({ key, content });
    }
  }

  const siteConfigVersion = input.siteConfigVersion ?? 1;
  const seoBuilderVersion = input.seoBuilderVersion ?? "v1";
  const cacheKey = [
    page.id,
    input.locale,
    input.revisionId,
    String(siteConfigVersion),
    seoBuilderVersion,
  ].join(":");

  return {
    ok: true,
    snapshot: {
      pageId: page.id,
      revisionId: input.revisionId,
      locale: input.locale,
      path,
      content: localeContent,
      page: localizedPage,
      sections,
      alternates,
      publishedAt: input.publishedAt,
      localeStates: {
        nl: localeStates.nl,
        en: localeStates.en,
      },
      cacheKey,
    },
  };
}

export function buildCmsHeadFromSnapshot(
  snapshot: ResolvedPublishedCmsPage,
  site: SiteUrlConfig,
): {
  title: string;
  meta: Array<Record<string, string>>;
  links: Array<{ rel: string; href: string; hrefLang?: string }>;
  jsonLd: Record<string, unknown>;
} {
  const origin = site.origin.replace(/\/+$/, "");
  const absolute = `${origin}${snapshot.path === "/" ? "" : snapshot.path}` || origin;
  const seo = snapshot.content.seo;
  const meta: Array<Record<string, string>> = [
    { title: seo.title },
    { name: "description", content: seo.description },
    { property: "og:title", content: seo.title },
    { property: "og:description", content: seo.description },
    { property: "og:url", content: absolute },
    { property: "og:locale", content: snapshot.locale === "en" ? "en_GB" : "nl_NL" },
  ];
  if (seo.keywords) meta.push({ name: "keywords", content: seo.keywords });
  if (seo.robots) meta.push({ name: "robots", content: seo.robots });
  if (seo.ogImage) meta.push({ property: "og:image", content: seo.ogImage });

  const links: Array<{ rel: string; href: string; hrefLang?: string }> = [
    { rel: "canonical", href: absolute },
  ];
  for (const alt of snapshot.alternates) {
    links.push({
      rel: "alternate",
      hrefLang: alt.locale,
      href: alt.url,
    });
  }

  const jsonLd: Record<string, unknown> = {
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

  return { title: seo.title, meta, links, jsonLd };
}

export function resolveLocaleFromUrl(pathname: string): LocaleResolution {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (p === "/en" || p.startsWith("/en/")) {
    return { locale: "en", source: "url" };
  }
  return { locale: "nl", source: "url" };
}

export function resolveLocaleForRequest(input: {
  pathname: string;
  previewLocale?: string | null;
  authenticatedPreview: boolean;
}): LocaleResolution {
  if (
    input.authenticatedPreview &&
    (input.previewLocale === "nl" || input.previewLocale === "en")
  ) {
    return { locale: input.previewLocale, source: "authenticated_preview" };
  }
  return resolveLocaleFromUrl(input.pathname);
}
