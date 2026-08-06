import type { FixedSectionKey } from "../sections";

/**
 * Ordered migration roles per fixed section key.
 * Each role becomes one block with a deterministic ID.
 */
export type MigrationRoleSpec = {
  role: string;
  /** Target block type once Gate 2 registers it (reported in dry-run). */
  blockType: string;
};

export const FIXED_SECTION_MIGRATION_ROLES: Record<FixedSectionKey, readonly MigrationRoleSpec[]> = {
  "home.hero": [{ role: "primary", blockType: "hero" }],
  "home.partners": [{ role: "primary", blockType: "partnersMarquee" }],
  "home.stats": [{ role: "primary", blockType: "statsCounters" }],
  "home.workGallery": [{ role: "primary", blockType: "gallery" }],
  "about.main": [
    { role: "intro", blockType: "centered" },
    { role: "mission", blockType: "textImage" },
    { role: "vision", blockType: "textImage" },
    { role: "history", blockType: "textImage" },
  ],
  "services.main": [{ role: "intro", blockType: "centered" }],
  "services.cards": [{ role: "primary", blockType: "portfolio" }],
  "products.main": [{ role: "primary", blockType: "textImage" }],
  "products.info": [{ role: "primary", blockType: "featureGrid" }],
  "contact.main": [{ role: "primary", blockType: "hero" }],
  "contact.info": [{ role: "primary", blockType: "contactInfoCards" }],
  "contact.form": [{ role: "primary", blockType: "contactForm" }],
  "vacatures.main": [{ role: "primary", blockType: "hero" }],
  "vacatures.application": [{ role: "primary", blockType: "contactForm" }],
  "offerte.main": [{ role: "primary", blockType: "hero" }],
  "offerte.info": [{ role: "primary", blockType: "contactInfoCards" }],
  "offerte.form": [{ role: "primary", blockType: "quoteRequestForm" }],
  "privacy.main": [{ role: "primary", blockType: "legalArticles" }],
  "terms.main": [{ role: "primary", blockType: "legalArticles" }],
} as const;
