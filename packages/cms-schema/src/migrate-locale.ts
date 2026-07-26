import type { CmsPage } from "./types";
import { defaultLocaleStates, missingEnglishTranslationMeta } from "./locale";
import { defaultPageTranslationMeta, localeContentFromLegacy } from "./seo";
import { pathsFromLegacySlug } from "./paths";

/**
 * Ensure Phase A locale fields exist on a page (idempotent).
 * Syncs legacy slug/title/description mirrors from NL locale bags.
 */
export function ensurePageLocaleFields(page: CmsPage): CmsPage {
  const paths = page.paths ?? pathsFromLegacySlug(page.slug);
  const localeContent =
    page.localeContent ?? localeContentFromLegacy(page.title, page.description);
  const localeStates = page.localeStates ?? defaultLocaleStates();
  const translationMetaRaw = page.translationMeta ?? {};
  const translationMeta = {
    ...defaultPageTranslationMeta(page.version ?? 1),
    ...translationMetaRaw,
    page: translationMetaRaw.page ?? missingEnglishTranslationMeta(page.version ?? 1),
    sections: translationMetaRaw.sections ?? {},
    blocks: translationMetaRaw.blocks ?? {},
  };
  const redirects = page.redirects ?? [];

  const nlPath = paths.nl;
  const nlContent = localeContent.nl;

  return {
    ...page,
    paths: { ...paths, nl: nlPath },
    localeContent,
    localeStates,
    translationMeta,
    redirects,
    // Legacy mirrors — keep storefront/admin readers working until Phase C/D.
    slug: nlPath,
    title: nlContent.pageTitle || nlContent.navigationLabel || page.title,
    description: nlContent.seo.description || page.description,
  };
}

/** True when page already carries v6 locale bags. */
export function hasLocaleFields(page: unknown): boolean {
  if (!page || typeof page !== "object") return false;
  const p = page as Record<string, unknown>;
  return (
    typeof p.paths === "object" &&
    p.paths !== null &&
    typeof p.localeContent === "object" &&
    p.localeContent !== null &&
    typeof p.localeStates === "object" &&
    p.localeStates !== null
  );
}
