import type { CmsSeo } from "@mccoy/cms-schema";

/**
 * SEO-7 ≠ SEO-8: when NL marketing routes switch to CMS head plumbing,
 * keep the previously deployed hardcoded titles/descriptions.
 * Do not invent better keyword copy here — that belongs in proposed-metadata.md.
 */
export const FROZEN_DEPLOYED_NL_SEO: Record<string, Pick<CmsSeo, "title" | "description"> & Partial<CmsSeo>> = {
  "/about": {
    title: "Over ons — McCoy Cleaning Twente",
    description:
      "Sinds 1998 staat McCoy Cleaning voor schoonmaak met karakter. Lees over onze missie, visie en geschiedenis als toonaangevend schoonmaakbedrijf in Twente.",
  },
  "/services": {
    title: "Diensten — McCoy Cleaning Twente",
    description:
      "Kantoorschoonmaak, horeca-, opleverings- en vloeronderhoud, meubelreiniging en glasbewassing in Twente. Vraag direct een offerte aan bij McCoy Cleaning.",
  },
  "/contact": {
    title: "Contact — Schoonmaak Twente | McCoy Cleaning",
    description:
      "Neem contact op met McCoy Cleaning voor algemene vragen of aanvragen voor professionele schoonmaak in Twente. Persoonlijk antwoord binnen één werkdag.",
  },
  "/offerte": {
    title: "Contact & Offerte — Schoonmaak Twente | McCoy Cleaning",
    description:
      "Offerte aanvragen voor kantoorschoonmaak, glasbewassing, vloer- en meubelonderhoud in Twente. Persoonlijk antwoord binnen één werkdag — McCoy Cleaning Oldenzaal.",
  },
  "/vacatures": {
    title: "Vacatures Schoonmaak Twente — Werken bij McCoy Cleaning",
    description:
      "Vacatures schoonmaak Twente: schoonmaakmedewerker, glazenwasser en oproepkracht bij McCoy Cleaning in Oldenzaal. Solliciteer direct.",
    keywords:
      "vacatures schoonmaak Twente, schoonmaker Oldenzaal, glazenwasser vacature, baan schoonmaak Hengelo, werken bij schoonmaakbedrijf",
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
