import {
  defaultSectionContent,
  migrateLegacyHeroOverrides,
  migrateLegacyHeroContent,
  migrateLegacyStatsContent,
  migrateLegacyWorkGalleryContent,
  migrateEmptyPartnersContent,
  migrateOriginalServicesImages,
  parseSectionContent,
  type HomeHeroContent,
  type PageSectionContent,
  type PartnersContent,
  type ServicesMainContent,
  type StatsContent,
  type WorkGalleryContent,
} from "./content";
import { FIXED_SECTIONS_BY_PAGE, type FixedSectionKey } from "./sections";
import type { BuiltinCmsPage } from "./types";

export function ensureBuiltinSectionContent(
  page: BuiltinCmsPage,
  legacyOverrides?: Record<string, string>,
): PageSectionContent {
  const out: PageSectionContent = { ...(page.sectionContent ?? {}) };
  if (!page.pageKey) return out;

  for (const key of FIXED_SECTIONS_BY_PAGE[page.pageKey]) {
    const existing = out[key];
    const parsed = existing ? parseSectionContent(key, existing) : null;
    if (parsed) {
      let next = parsed;
      if (key === "home.stats") {
        next = migrateLegacyStatsContent(parsed as StatsContent) as typeof parsed;
      }
      if (key === "home.hero") {
        // Structured sectionContent already exists — never re-apply flat hero.*
        // overrides on top. Doing so made the Secties inspector look read-only:
        // every patch snapped back to the leftover override on the next render.
        next = migrateLegacyHeroContent(parsed as HomeHeroContent) as typeof next;
      }
      if (key === "home.workGallery") {
        next = migrateLegacyWorkGalleryContent(parsed as WorkGalleryContent) as typeof parsed;
      }
      if (key === "home.partners") {
        next = migrateEmptyPartnersContent(parsed as PartnersContent) as typeof parsed;
      }
      if (key === "services.main") {
        next = migrateOriginalServicesImages(parsed as ServicesMainContent) as typeof parsed;
      }
      // Do not rehydrate removed CTAs, cards, or items — editors may clear them deliberately.
      // Exception: empty partners list is treated as "never seeded" and gets default logos.
      (out as Record<string, unknown>)[key] = next;
      continue;
    }
    // Missing structured content: hydrate from defaults, then one-shot legacy overrides.
    let def = defaultSectionContent(key);
    if (key === "home.hero") {
      def = migrateLegacyHeroOverrides(legacyOverrides, def as HomeHeroContent);
    }
    if (key === "home.stats") {
      def = migrateLegacyStatsContent(def as StatsContent);
    }
    if (key === "home.workGallery") {
      def = migrateLegacyWorkGalleryContent(def as WorkGalleryContent);
    }
    if (key === "services.main") {
      def = migrateOriginalServicesImages(def as ServicesMainContent);
    }
    (out as Record<string, unknown>)[key] = def;
  }
  return out;
}

export function getSectionContent<K extends FixedSectionKey>(
  page: BuiltinCmsPage,
  key: K,
): NonNullable<PageSectionContent[K]> {
  const ensured = ensureBuiltinSectionContent(page);
  const value = ensured[key];
  if (value) return value as NonNullable<PageSectionContent[K]>;
  return defaultSectionContent(key) as NonNullable<PageSectionContent[K]>;
}
