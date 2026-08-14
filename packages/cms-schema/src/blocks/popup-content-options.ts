import {
  POPUP_CONTENT_BLOCK_TYPES,
  type PopupContentBlockType,
} from "../button";
import type { BlockCategory } from "../block-types";
import { getBlockDataDefinition } from "./registry";

/**
 * Optional Dutch blurbs for the popup content picker.
 * Prefer these over sparse catalog `description` fields when present.
 */
const POPUP_CONTENT_BLURBS: Partial<Record<PopupContentBlockType, string>> = {
  richText: "Kop met opgemaakte tekst en optionele knop.",
  centered: "Titel, tekst en knop in het midden.",
  hero: "Grote intro met titel, tekst, knop en afbeelding.",
  gallery: "Raster of mozaïek met foto’s.",
  offers: "Aanbiedingen met afbeelding, badge en prijzen.",
  textImage: "Tekst naast een afbeelding.",
  featureGrid: "Raster met icoon, titel en korte tekst.",
  steps: "Horizontale stappenslider met zoom op de actieve stap.",
  benefits: "Checklist met voordelen.",
  columns: "Meerdere tekstkolommen naast elkaar.",
  quote: "Citaat met optionele auteur.",
  video: "Ingesloten video met titel.",
  beforeAfter: "Vergelijking vóór en na met schuifregelaar.",
  carousel: "Horizontale slides met afbeeldingen.",
  comparisonTable: "Vergelijkingstabel met rijen en kolommen.",
  spacer: "Lege ruimte tussen secties.",
  teamGrid: "Raster met teamleden.",
  teamProfile: "Uitgelicht profiel van een teamlid.",
  values: "Kernwaarden met icoon en tekst.",
  timeline: "Chronologische tijdlijn.",
  roadmap: "Roadmap met mijlpalen.",
  plans: "Prijs- of abonnementsplannen.",
  newsletter: "Aanmeldformulier voor nieuwsbrief.",
  contactForm: "Contactformulier.",
  announcement: "Korte aankondiging of melding.",
  portfolio: "Portfolio- of projectoverzicht.",
  jobs: "Vacaturelijst.",
  latestPosts: "Recente berichten of updates.",
  partnersMarquee: "Partnerlogo’s in een doorlopende rij.",
  statsCounters: "Cijfers en statistieken.",
  contactInfoCards: "Contactgegevens op kaarten.",
  quoteRequestForm: "Offerteaanvraagformulier.",
  legalArticles: "Juridische artikelen of voorwaarden.",
};

export type PopupContentTypeOption = {
  type: PopupContentBlockType;
  label: string;
  description: string;
  category: BlockCategory;
};

/** All section types allowed as button-popup body (everything except CTA/popup). */
export function listPopupContentTypeOptions(): PopupContentTypeOption[] {
  return POPUP_CONTENT_BLOCK_TYPES.map((type) => {
    const def = getBlockDataDefinition(type);
    return {
      type,
      label: def.label,
      description: POPUP_CONTENT_BLURBS[type] || def.description || def.label,
      category: def.category,
    };
  });
}

/** Case-insensitive filter on label, description, and category. */
export function filterPopupContentTypeOptions(
  options: readonly PopupContentTypeOption[],
  query: string,
): PopupContentTypeOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...options];
  return options.filter((opt) => {
    const haystack = `${opt.label} ${opt.description} ${opt.category}`.toLowerCase();
    return haystack.includes(q);
  });
}

export function getPopupContentTypeOption(
  type: PopupContentBlockType,
): PopupContentTypeOption {
  const found = listPopupContentTypeOptions().find((opt) => opt.type === type);
  if (found) return found;
  const def = getBlockDataDefinition(type);
  return {
    type,
    label: def.label,
    description: POPUP_CONTENT_BLURBS[type] || def.description || def.label,
    category: def.category,
  };
}
