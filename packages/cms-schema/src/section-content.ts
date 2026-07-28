import {
  defaultSectionContent,
  migrateLegacyHeroOverrides,
  migrateLegacyHeroContent,
  migrateLegacyStatsContent,
  migrateLegacyWorkGalleryContent,
  migrateEmptyPartnersContent,
  migrateOriginalServicesImages,
  parseSectionContent,
  type CmsImage,
  type HomeHeroContent,
  type PageSectionContent,
  type PartnersContent,
  type ProductCard,
  type ProductsInfoContent,
  type ProductsMainContent,
  type ServicesMainContent,
  type StatsContent,
  type WorkGalleryContent,
} from "./content";
import { FIXED_SECTIONS_BY_PAGE, type FixedSectionKey } from "./sections";
import type { BuiltinCmsPage } from "./types";

const LEGACY_PRODUCTS_MAIN_HEADING = "McCoy Products";
const LEGACY_PRODUCTS_MAIN_INTRO = "Hygiënepapier, zepen, reinigingsmiddelen en meer.";
/** First-paragraph-only sectietekst before contact copy was folded in. */
const LEGACY_PRODUCTS_MAIN_INTRO_WHOLESALE_ONLY =
  "Een belangrijk onderdeel van McCoy Cleaning is McCoy Products, onze groothandel. In ons assortiment vind je: hygiëne papier, professionele zepen, reinigingsmiddelen voor horeca en apparatuur en hardware om schoon te maken.";
/** Briefly stored as Extra sectietekst before the webshop notice was wired up. */
const LEGACY_PRODUCTS_MAIN_BODY_CONTACT =
  "Voor het verkrijgen van onze producten kunt u bellen of contact op nemen via het contactformulier, we helpen u dan graag.";

function defaultProductsInfoText(): Pick<ProductsInfoContent, "eyebrow" | "heading" | "intro"> {
  const def = defaultSectionContent("products.info") as ProductsInfoContent;
  return {
    eyebrow: def.eyebrow,
    heading: def.heading,
    intro: def.intro,
  };
}

/**
 * Upgrade known legacy Intro placeholders only.
 * Do not refill fields the editor deliberately cleared (empty string stays empty).
 * Extra sectietekst (`body`) is the webshop callout under the CTAs.
 */
export function migrateProductsMainText(content: PageSectionContent): PageSectionContent {
  const raw = content["products.main"] as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object") return content;

  const defaults = defaultSectionContent("products.main") as ProductsMainContent;
  const heading = typeof raw.heading === "string" ? raw.heading : "";
  const intro = typeof raw.intro === "string" ? raw.intro : "";
  const body = typeof raw.body === "string" ? raw.body : "";

  const trimmedHeading = heading.trim();
  const nextHeading =
    trimmedHeading === LEGACY_PRODUCTS_MAIN_HEADING ? defaults.heading : heading;

  const trimmedIntro = intro.trim();
  const nextIntro =
    trimmedIntro === LEGACY_PRODUCTS_MAIN_INTRO ||
    trimmedIntro === LEGACY_PRODUCTS_MAIN_INTRO_WHOLESALE_ONLY
      ? defaults.intro
      : intro;

  // Only rewrite the short-lived contact-as-body mistake; leave empty body cleared.
  const nextBody =
    body.trim() === LEGACY_PRODUCTS_MAIN_BODY_CONTACT ? (defaults.body ?? "") : body;

  if (nextHeading === heading && nextIntro === intro && nextBody === body) {
    return content;
  }

  return {
    ...content,
    "products.main": {
      eyebrow: typeof raw.eyebrow === "string" ? raw.eyebrow : defaults.eyebrow,
      heading: nextHeading || defaults.heading,
      intro: nextIntro,
      body: nextBody || undefined,
      image: raw.image && typeof raw.image === "object" ? (raw.image as CmsImage) : undefined,
    } satisfies ProductsMainContent,
  };
}

/**
 * Ensure Producten-info has title + intro when migrating cards-only legacy rows.
 * Do not refill fields the editor deliberately cleared.
 */
export function migrateProductsInfoText(content: PageSectionContent): PageSectionContent {
  const raw = content["products.info"] as Record<string, unknown> | undefined;
  if (!raw || typeof raw !== "object") return content;

  // Structured docs already have a heading key (even when empty).
  if (typeof raw.heading === "string") return content;

  const defaults = defaultProductsInfoText();
  const cards = Array.isArray(raw.cards) ? (raw.cards as ProductCard[]) : [];
  return {
    ...content,
    "products.info": {
      eyebrow: typeof raw.eyebrow === "string" ? raw.eyebrow : defaults.eyebrow,
      heading: defaults.heading,
      intro: typeof raw.intro === "string" ? raw.intro : defaults.intro,
      cards,
    } satisfies ProductsInfoContent,
  };
}

/**
 * Legacy products.main held Intro + cards.
 * Later briefly split flyer into products.flyer — fold flyer image back into Intro.
 */
export function migrateProductsCompositeSplit(content: PageSectionContent): PageSectionContent {
  let out: PageSectionContent = { ...content };
  let changed = false;
  const loose = out as Record<string, unknown>;

  const rawMain = out["products.main"] as Record<string, unknown> | undefined;
  const rawFlyer = loose["products.flyer"] as { image?: CmsImage } | undefined;

  if (rawMain && typeof rawMain === "object") {
    const cards = rawMain.cards;
    if (Array.isArray(cards)) {
      const nextMain: ProductsMainContent = {
        eyebrow: typeof rawMain.eyebrow === "string" ? rawMain.eyebrow : undefined,
        heading: typeof rawMain.heading === "string" ? rawMain.heading : "",
        intro: typeof rawMain.intro === "string" ? rawMain.intro : "",
        body: typeof rawMain.body === "string" ? rawMain.body : undefined,
        image:
          rawMain.image && typeof rawMain.image === "object"
            ? (rawMain.image as CmsImage)
            : undefined,
      };
      out["products.main"] = nextMain;
      changed = true;

      const existingInfo = out["products.info"] as ProductsInfoContent | undefined;
      if (!existingInfo || !Array.isArray(existingInfo.cards) || existingInfo.cards.length === 0) {
        const text = defaultProductsInfoText();
        out["products.info"] = {
          ...text,
          cards: cards as ProductCard[],
        };
      }
    }
  }

  // Fold short-lived products.flyer back into Intro.image
  if (rawFlyer?.image) {
    const main = (out["products.main"] ?? {}) as ProductsMainContent;
    if (!main.image) {
      out["products.main"] = {
        eyebrow: main.eyebrow,
        heading: main.heading || "",
        intro: main.intro || "",
        body: main.body,
        image: rawFlyer.image,
      };
      changed = true;
    }
  }
  if ("products.flyer" in loose) {
    delete loose["products.flyer"];
    changed = true;
  }

  let next = migrateProductsMainText(out);
  if (next !== out) {
    changed = true;
    out = next;
  }
  next = migrateProductsInfoText(out);
  if (next !== out) {
    changed = true;
    out = next;
  }

  return changed ? out : content;
}

export function ensureBuiltinSectionContent(
  page: BuiltinCmsPage,
  legacyOverrides?: Record<string, string>,
): PageSectionContent {
  let out: PageSectionContent = { ...(page.sectionContent ?? {}) };
  if (!page.pageKey) return out;

  if (page.pageKey === "products") {
    out = migrateProductsCompositeSplit(out);
  }

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
