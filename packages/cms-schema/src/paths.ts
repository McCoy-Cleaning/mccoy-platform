import type { Locale } from "./locale";
import { normalizeSlug, slugToPath } from "./slugs";

/**
 * Stable page identity with optional editor-approved English path.
 * Never invent `en` dynamically on every request — generate as draft, then approve.
 */
export type LocalizedPagePath = {
  nl: string;
  en?: string;
};

export type CmsRedirect = {
  id: string;
  locale: Locale;
  fromPath: string;
  toPath: string;
  statusCode: 301 | 308;
  createdAt: string;
};

export type MissingEnglishUrlAction =
  | { action: "render" }
  | { action: "redirect_pending"; statusCode: 302; toPath: string }
  | { action: "redirect_retired"; statusCode: 301 | 308; toPath: string }
  | { action: "not_found" };

/**
 * Normalize a CMS path for uniqueness checks and routing.
 * Always returns a leading-slash path without trailing slash (except `/`).
 */
export function normalizeCmsPath(locale: Locale, path: string): string {
  const trimmed = path.trim();
  let withoutLocale = trimmed;
  if (locale === "en") {
    withoutLocale = trimmed.replace(/^\/en(?=\/|$)/i, "") || "/";
  }
  const normalized = normalizeSlug(withoutLocale.replace(/^\/+/, "").replace(/\/+$/, ""));
  const asPath = slugToPath(normalized);

  if (locale === "en") {
    if (asPath === "/") return "/en";
    return `/en${asPath}`;
  }
  return asPath;
}

/** Strip `/en` prefix for identity matching against LocalizedPagePath.en or .nl. */
export function stripLocalePrefix(pathname: string): { locale: Locale; path: string } {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (p === "/en" || p.startsWith("/en/")) {
    const rest = p === "/en" ? "/" : p.slice(3) || "/";
    return { locale: "en", path: rest === "" ? "/" : rest };
  }
  return { locale: "nl", path: p === "" ? "/" : p };
}

export function pathsFromLegacySlug(slug: string): LocalizedPagePath {
  const nl = slug.startsWith("/") ? slug : slugToPath(normalizeSlug(slug));
  return { nl: nl === "" ? "/" : nl.replace(/\/+$/, "") || "/" };
}

export function legacySlugFromPaths(paths: LocalizedPagePath): string {
  return paths.nl;
}

/**
 * Locked missing-English URL policy:
 * - known page, EN not published → 302 to Dutch sibling
 * - retired EN path in redirect history → 301/308
 * - unknown → 404
 */
export function resolveEnglishPathAccess(input: {
  knownPage: boolean;
  englishPublished: boolean;
  dutchPath: string;
  requestPath: string;
  redirects: CmsRedirect[];
}): MissingEnglishUrlAction {
  const { knownPage, englishPublished, dutchPath, requestPath, redirects } = input;

  const retired = redirects.find(
    (r) => r.locale === "en" && normalizeCmsPath("en", r.fromPath) === normalizeCmsPath("en", requestPath),
  );

  // Retired paths take precedence even if a new EN publication exists elsewhere.
  if (retired && !englishPublished) {
    return {
      action: "redirect_retired",
      statusCode: retired.statusCode,
      toPath: retired.toPath,
    };
  }

  if (englishPublished) {
    return { action: "render" };
  }

  if (knownPage) {
    return {
      action: "redirect_pending",
      statusCode: 302,
      toPath: dutchPath,
    };
  }

  return { action: "not_found" };
}

export function assertRedirectValid(redirect: CmsRedirect): { ok: true } | { ok: false; error: string } {
  const from = normalizeCmsPath(redirect.locale, redirect.fromPath);
  const to = normalizeCmsPath(redirect.locale, redirect.toPath);
  if (from === to) {
    return { ok: false, error: "Redirect target cannot equal source." };
  }
  if (!redirect.fromPath || !redirect.toPath) {
    return { ok: false, error: "Redirect paths are required." };
  }
  return { ok: true };
}

export type LocaleAlternate = {
  locale: "nl" | "en" | "x-default";
  url: string;
  published: boolean;
};

export type SiteUrlConfig = {
  origin: string; // e.g. https://www.mccoy.nl — no trailing slash
};

/**
 * Shared alternate builder for head() and sitemap — published locales only.
 */
export function getPublishedLocaleAlternates(
  paths: LocalizedPagePath,
  localeStates: { nl: { publicationState: string }; en?: { publicationState: string } },
  site: SiteUrlConfig,
): LocaleAlternate[] {
  const origin = site.origin.replace(/\/+$/, "");
  const alts: LocaleAlternate[] = [];

  const nlPublished = localeStates.nl.publicationState === "published";
  const enPublished = localeStates.en?.publicationState === "published";

  if (nlPublished) {
    alts.push({
      locale: "nl",
      url: `${origin}${paths.nl === "/" ? "/" : paths.nl}`,
      published: true,
    });
  }

  if (enPublished && paths.en) {
    const enPath = normalizeCmsPath("en", paths.en.startsWith("/en") ? paths.en : paths.en);
    alts.push({
      locale: "en",
      url: `${origin}${enPath}`,
      published: true,
    });
  }

  if (nlPublished) {
    alts.push({
      locale: "x-default",
      url: `${origin}${paths.nl === "/" ? "/" : paths.nl}`,
      published: true,
    });
  }

  return alts;
}
