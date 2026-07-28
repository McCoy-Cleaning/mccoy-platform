import {
  CMS_SCHEMA_VERSION,
  defaultSiteNavigation,
  normalizeCmsPage,
  type BuiltinPageKey,
  type CmsPage,
} from "@mccoy/cms-schema";

function emptyBuiltin(input: {
  id: string;
  slug: string;
  title: string;
  description: string;
  inNav: boolean;
  pageKey: BuiltinPageKey | null;
}): CmsPage {
  return normalizeCmsPage({
    kind: "builtin",
    isCustom: false,
    pageKey: input.pageKey,
    id: input.id,
    slug: input.slug,
    title: input.title,
    description: input.description,
    inNav: input.inNav,
    blocks: [],
    layout: [],
    layoutVersion: 0,
    sectionContent: {},
    updatedAt: Date.now(),
    version: 1,
    localeStates: {
      nl: { publicationState: "published", freshness: "current" },
      en: { publicationState: "published", freshness: "current" },
    },
  });
}

/** F1 — built-in page seeds for first publish. */
export function builtinCmsSeedPages(): CmsPage[] {
  return [
    emptyBuiltin({
      id: "page_home",
      slug: "/",
      title: "Home",
      description: "McCoy Cleaning — professioneel schoonmaakbedrijf in Twente.",
      inNav: true,
      pageKey: "home",
    }),
    emptyBuiltin({
      id: "page_about",
      slug: "/about",
      title: "Over ons",
      description: "Over McCoy Cleaning — ons verhaal, team en waarden.",
      inNav: true,
      pageKey: "about",
    }),
    emptyBuiltin({
      id: "page_services",
      slug: "/services",
      title: "Diensten",
      description: "Ons volledige aanbod aan schoonmaakdiensten.",
      inNav: true,
      pageKey: "services",
    }),
    emptyBuiltin({
      id: "page_products",
      slug: "/products",
      title: "Producten",
      description: "McCoy Products — hygiënepapier, zepen en meer.",
      inNav: true,
      pageKey: "products",
    }),
    emptyBuiltin({
      id: "page_contact",
      slug: "/contact",
      title: "Contact",
      description: "Neem contact op met McCoy Cleaning.",
      inNav: true,
      pageKey: "contact",
    }),
    emptyBuiltin({
      id: "page_vacatures",
      slug: "/vacatures",
      title: "Vacatures",
      description: "Werken bij McCoy Cleaning.",
      inNav: true,
      pageKey: "vacatures",
    }),
    emptyBuiltin({
      id: "page_offerte",
      slug: "/offerte",
      title: "Offerte",
      description: "Vraag een offerte aan bij McCoy Cleaning.",
      inNav: true,
      pageKey: "offerte",
    }),
    emptyBuiltin({
      id: "page_privacy",
      slug: "/privacy",
      title: "Privacyverklaring",
      description: "Privacyverklaring van McCoy Cleaning B.V.",
      inNav: false,
      pageKey: "privacy",
    }),
    emptyBuiltin({
      id: "page_terms",
      slug: "/terms",
      title: "Algemene voorwaarden",
      description: "Algemene voorwaarden van McCoy Schoonmaak en Reiniging.",
      inNav: false,
      pageKey: "terms",
    }),
  ];
}

export const CMS_SEED_NAVIGATION = defaultSiteNavigation();
export const CMS_SEED_SCHEMA_VERSION = CMS_SCHEMA_VERSION;
