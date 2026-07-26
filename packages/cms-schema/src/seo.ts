import type { Localized, TranslationMetadata } from "./locale";
import { emptyLocalized, missingEnglishTranslationMeta } from "./locale";

export type CmsSeo = {
  title: string;
  description: string;
  keywords?: string;
  ogImage?: string;
  robots?: string;
};

/**
 * Per-locale page copy — navigation, H1, and SEO titles are independent.
 */
export type CmsPageLocaleContent = {
  navigationLabel: string;
  pageTitle: string;
  seo: CmsSeo;
};

export function cmsSeo(title: string, description: string, extra?: Partial<CmsSeo>): CmsSeo {
  return {
    title,
    description,
    ...extra,
  };
}

export function cmsPageLocaleContent(
  navigationLabel: string,
  pageTitle: string,
  seo: CmsSeo,
): CmsPageLocaleContent {
  return { navigationLabel, pageTitle, seo };
}

/** Build NL locale content from legacy flat title/description. */
export function localeContentFromLegacy(title: string, description: string): Localized<CmsPageLocaleContent> {
  const seo = cmsSeo(title, description);
  return emptyLocalized(cmsPageLocaleContent(title, title, seo));
}

export type PageTranslationMetaMap = {
  /** Page-level SEO / intro translation tracking for EN. */
  page?: TranslationMetadata;
  /** Fixed section keys → EN translation meta. */
  sections?: Record<string, TranslationMetadata>;
  /** Block id → EN translation meta. */
  blocks?: Record<string, TranslationMetadata>;
};

export function defaultPageTranslationMeta(sourceRevision = 1): PageTranslationMetaMap {
  return {
    page: missingEnglishTranslationMeta(sourceRevision),
    sections: {},
    blocks: {},
  };
}
