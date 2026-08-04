/**
 * Frozen Producten picker starters — not coupled to mutable defaultSectionContent().
 * Changing these fixtures must not rewrite already-migrated pages.
 */

import type { CmsImage } from "../content";
import { DEFAULT_PRODUCTS_INTRO_METRICS } from "../blocks/catalog";

function localFlyer(): CmsImage {
  return {
    assetId: "local:products-flyer",
    src: "/images/cms/products-flyer.png",
    alt: "McCoy Cleaning Products flyer",
    decorative: false,
  };
}

/** Picker template: Assortiment / kenmerken → featureGrid (Producten chrome) */
export const productAssortmentTemplateData = {
  presentation: "productsAssortment" as const,
  eyebrow: "Ons assortiment",
  title: "McCoy Cleaning Products",
  intro:
    "Hygiënepapier, professionele zepen, reinigingsmiddelen en hardware voor een frisse, representatieve omgeving.",
  features: [
    {
      id: "prod_hygiene",
      icon: "sparkles",
      title: "Hygiëne papier",
      body: "Professioneel hygiënepapier voor sanitair, keukens en bedrijfspanden.",
      cta: {
        label: "Productofferte aanvragen",
        action: "link" as const,
        link: { type: "internal_route" as const, route: "contact" as const },
      },
    },
    {
      id: "prod_soaps",
      icon: "sparkles",
      title: "Professionele zepen",
      body: "Hoogwaardige zepen en dispensers voor een frisse, representatieve sanitaire ruimte.",
      cta: {
        label: "Productofferte aanvragen",
        action: "link" as const,
        link: { type: "internal_route" as const, route: "contact" as const },
      },
    },
    {
      id: "prod_agents",
      icon: "sparkles",
      title: "Reinigingsmiddelen & hardware",
      body: "Reinigingsmiddelen voor horeca plus apparatuur en hardware om schoon te maken.",
      cta: {
        label: "Productofferte aanvragen",
        action: "link" as const,
        link: { type: "internal_route" as const, route: "contact" as const },
      },
    },
  ],
} as const;

/** @deprecated Prefer DEFAULT_PRODUCTS_INTRO_METRICS from catalog */
export const defaultProductsIntroMetrics = DEFAULT_PRODUCTS_INTRO_METRICS;

/** Picker template: Productintro met flyer → textImage (Producten chrome) */
export const productIntroTemplateData = {
  presentation: "productsIntro" as const,
  eyebrow: "Producten",
  title: "Geurproducten met een premium sanitaire beleving.",
  body: [
    "Een belangrijk onderdeel van McCoy Cleaning is McCoy Products, onze groothandel. In ons assortiment vind je: hygiëne papier, professionele zepen, reinigingsmiddelen voor horeca en apparatuur en hardware om schoon te maken.",
    "Voor het verkrijgen van onze producten kunt u bellen of contact op nemen via het contactformulier, we helpen u dan graag.",
  ].join("\n\n"),
  notice: "We zijn momenteel druk achter de schermen met de online webshop! Deze volgt binnenkort.",
  image: localFlyer(),
  reverse: false,
  metrics: DEFAULT_PRODUCTS_INTRO_METRICS.map((m) => ({ ...m })),
} as const;
