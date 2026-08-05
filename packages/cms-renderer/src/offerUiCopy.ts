import type { Locale } from "@mccoy/cms-schema";

/** Hardcoded offer price-card chrome — not CMS fields (badge/title stay CMS-editable). */
export type OfferUiCopy = {
  was: string;
  price: string;
  nowDiscounted: string;
  percentOffAria: (pct: number) => string;
  noImage: string;
  empty: string;
};

export function offerUiCopy(locale: Locale): OfferUiCopy {
  if (locale === "en") {
    return {
      was: "Was",
      price: "Price",
      nowDiscounted: "Now discounted",
      percentOffAria: (pct) => `${pct} percent off`,
      noImage: "No image",
      empty: "No offers added yet.",
    };
  }
  return {
    was: "Was",
    price: "Prijs",
    nowDiscounted: "Nu met korting",
    percentOffAria: (pct) => `${pct} procent korting`,
    noImage: "Geen afbeelding",
    empty: "Nog geen aanbiedingen toegevoegd.",
  };
}
