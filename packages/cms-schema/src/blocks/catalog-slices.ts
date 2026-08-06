/**
 * Stage 5 — modular catalog slices already extracted from the monolith.
 * `catalog.ts` spreads these into `catalogDefinitions` (no behaviour change).
 */
import { jobsDefinition } from "./jobs";
import { offersDefinition } from "./offers";
import { plansDefinition } from "./plans";
import { roadmapDefinition } from "./roadmap";
import { timelineDefinition } from "./timeline";
import {
  contactInfoCardsDefinition,
  legalArticlesDefinition,
  partnersMarqueeDefinition,
  quoteRequestFormDefinition,
  statsCountersDefinition,
} from "./new-sections";

/** Family F specialised (+ roadmap/timeline structural extracts). */
export const specialisedCatalogSlice = {
  jobs: jobsDefinition,
  roadmap: roadmapDefinition,
  timeline: timelineDefinition,
  plans: plansDefinition,
  offers: offersDefinition,
} as const;

/** Family C/D new-section extracts. */
export const newSectionsCatalogSlice = {
  partnersMarquee: partnersMarqueeDefinition,
  statsCounters: statsCountersDefinition,
  contactInfoCards: contactInfoCardsDefinition,
  quoteRequestForm: quoteRequestFormDefinition,
  legalArticles: legalArticlesDefinition,
} as const;
