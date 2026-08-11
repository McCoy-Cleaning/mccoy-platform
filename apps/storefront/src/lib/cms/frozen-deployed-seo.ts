import type { CmsSeo } from "@mccoy/cms-schema";

/**
 * Phase 6 — deployed factual titles/descriptions for marketing routes.
 * Overlays CMS seo fields at head resolve time (NL + published EN).
 * Do not add ranking `<meta name="keywords">` stuffing here.
 */
export type FrozenSeo = Pick<CmsSeo, "title" | "description"> & Partial<CmsSeo>;

export const FROZEN_DEPLOYED_NL_SEO: Record<string, FrozenSeo> = {
  "/": {
    title: "McCoy Cleaning — Schoonmaakbedrijf Twente | Oldenzaal",
    description:
      "Professioneel schoonmaakbedrijf in Twente sinds 1998. Kantoorschoonmaak, glasbewassing, vloer- en horecaschoonmaak vanuit Oldenzaal — met een vast eigen team.",
  },
  "/about": {
    title: "Over McCoy Cleaning — Schoonmaakbedrijf Twente sinds 1998",
    description:
      "Sinds 1998 staat McCoy Cleaning voor schoonmaak met karakter vanuit Oldenzaal. Lees over onze missie, visie en geschiedenis als schoonmaakbedrijf in Twente.",
  },
  "/services": {
    title: "Schoonmaakdiensten Twente — McCoy Cleaning",
    description:
      "Kantoorschoonmaak, horeca-, opleverings- en vloeronderhoud, meubelreiniging en glasbewassing in Twente. Vast eigen team van McCoy Cleaning in Oldenzaal — vraag een offerte aan.",
  },
  "/products": {
    title: "Producten — McCoy Cleaning Products | Groothandel",
    description:
      "McCoy Products: groothandel in hygiënepapier, professionele zepen, reinigingsmiddelen voor horeca en schoonmaakapparatuur. Neem contact op voor het assortiment.",
  },
  "/contact": {
    title: "Contact — McCoy Cleaning Twente | Oldenzaal",
    description:
      "Neem contact op met McCoy Cleaning in Oldenzaal voor vragen of aanvragen over professionele schoonmaak in Twente. Persoonlijk antwoord binnen één werkdag.",
  },
  "/offerte": {
    title: "Offerte aanvragen — Schoonmaak Twente | McCoy Cleaning",
    description:
      "Offerte aanvragen voor kantoorschoonmaak, glasbewassing, vloer- en meubelonderhoud in Twente. Persoonlijk antwoord binnen één werkdag — McCoy Cleaning Oldenzaal.",
  },
  "/vacatures": {
    title: "Vacatures Schoonmaak Twente — Werken bij McCoy Cleaning",
    description:
      "Vacatures schoonmaak Twente: schoonmaakmedewerker, glazenwasser en oproepkracht bij McCoy Cleaning in Oldenzaal. Solliciteer direct.",
  },
  "/privacy": {
    title: "Privacyverklaring — McCoy Cleaning",
    description:
      "Privacyverklaring van McCoy Cleaning B.V.: hoe wij persoonsgegevens verwerken, bewaren en beveiligen.",
  },
  "/terms": {
    title: "Algemene Voorwaarden — McCoy Cleaning",
    description:
      "Algemene voorwaarden van McCoy Schoonmaak en Reiniging — offertes, uitvoering, aansprakelijkheid en geschillen.",
  },
};

/**
 * Localized EN titles only for routes that are genuinely published with EN content.
 * Legal EN bleed pages stay CMS/noindex-driven — not listed here as thin inventions.
 */
export const FROZEN_DEPLOYED_EN_SEO: Record<string, FrozenSeo> = {
  "/": {
    title: "McCoy Cleaning — Cleaning Company Twente | Oldenzaal",
    description:
      "Professional cleaning company in Twente since 1998. Office cleaning, window cleaning, floor care and hospitality cleaning from Oldenzaal — permanent in-house team.",
  },
  "/about": {
    title: "About McCoy Cleaning — Cleaning Company Twente since 1998",
    description:
      "Since 1998 McCoy Cleaning has delivered cleaning with character from Oldenzaal. Read about our mission, vision and history as a cleaning company in Twente.",
  },
  "/services": {
    title: "Cleaning Services Twente — McCoy Cleaning",
    description:
      "Office, hospitality, post-construction and floor cleaning, furniture care and window cleaning in Twente. Permanent in-house team from McCoy Cleaning in Oldenzaal.",
  },
  "/products": {
    title: "Products — McCoy Cleaning Products | Wholesale",
    description:
      "McCoy Products: wholesale hygiene paper, professional soaps, hospitality cleaning agents and cleaning equipment. Contact us about the range.",
  },
  "/contact": {
    title: "Contact — McCoy Cleaning Twente | Oldenzaal",
    description:
      "Contact McCoy Cleaning in Oldenzaal for questions or requests about professional cleaning in Twente. Personal reply within one working day.",
  },
  "/vacatures": {
    title: "Cleaning Jobs Twente — Work at McCoy Cleaning",
    description:
      "Cleaning vacancies in Twente: cleaner, window cleaner and on-call roles at McCoy Cleaning in Oldenzaal. Apply directly.",
  },
};
