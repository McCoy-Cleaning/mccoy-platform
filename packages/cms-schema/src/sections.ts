/** Page-qualified fixed section keys and capabilities (no React). */

/**
 * Current publishable layout version for fixed+block hybrid layouts.
 * Blocks-only target is {@link BLOCKS_ONLY_LAYOUT_VERSION} in migration/ — applied only after verified migration (Gate 5+).
 */
export const CURRENT_LAYOUT_VERSION = 7 as const;

/** @deprecated Use CURRENT_LAYOUT_VERSION — alias documenting the last fixed-section layout era. */
export const FIXED_SECTIONS_LAYOUT_VERSION = CURRENT_LAYOUT_VERSION;

export type BuiltinPageKey =
  | "home"
  | "about"
  | "services"
  | "products"
  | "contact"
  | "vacatures"
  | "offerte"
  | "privacy"
  | "terms";

export type FixedSectionKey =
  | "home.hero"
  | "home.partners"
  | "home.stats"
  | "home.workGallery"
  | "about.main"
  | "services.main"
  | "services.cards"
  | "products.main"
  | "products.info"
  | "contact.main"
  | "contact.info"
  | "contact.form"
  | "vacatures.main"
  | "vacatures.application"
  | "offerte.main"
  | "offerte.info"
  | "offerte.form"
  | "privacy.main"
  | "terms.main";

export type FixedSectionDefinition = {
  label: string;
  movable: boolean;
  hideable: boolean;
  /**
   * When true, the section must remain in the layout (cannot delete).
   * Prefer false so editors can remove chrome; catalog keys still exist for restore.
   */
  required: boolean;
  /** Soft preference: keep this section first while present. Omitted = freely ordered. */
  lockedPosition?: "first" | "last";
};

export const FIXED_SECTIONS_BY_PAGE: Record<BuiltinPageKey, readonly FixedSectionKey[]> = {
  home: ["home.hero", "home.partners", "home.stats", "home.workGallery"],
  about: ["about.main"],
  services: ["services.main", "services.cards"],
  products: ["products.main", "products.info"],
  contact: ["contact.main", "contact.info", "contact.form"],
  vacatures: ["vacatures.main", "vacatures.application"],
  offerte: ["offerte.main", "offerte.info", "offerte.form"],
  privacy: ["privacy.main"],
  terms: ["terms.main"],
} as const;

/**
 * Fixed section capabilities — all hideable/removable so existing page chrome
 * can be managed like flexible blocks, except contact.form / offerte.form
 * (required, hide-only). Vacatures application is required + last-locked so it
 * stays below jobs listing chrome. Vacatures jobs block policy remains separate
 * (`page-block-policies`: minInstances 1).
 */
export const FIXED_SECTION_DEFS: Record<FixedSectionKey, FixedSectionDefinition> = {
  "home.hero": {
    label: "Hero",
    movable: true,
    hideable: true,
    required: false,
  },
  "home.partners": {
    label: "Partners",
    movable: true,
    hideable: true,
    required: false,
  },
  "home.stats": {
    label: "Statistieken",
    movable: true,
    hideable: true,
    required: false,
  },
  "home.workGallery": {
    label: "Werkgalerij",
    movable: true,
    hideable: true,
    required: true,
  },
  "about.main": {
    label: "Over ons",
    movable: true,
    hideable: true,
    required: false,
  },
  "services.main": {
    label: "Diensten - Intro",
    movable: true,
    hideable: true,
    required: false,
  },
  "services.cards": {
    label: "Dienstkaarten",
    movable: true,
    hideable: true,
    required: false,
  },
  "products.main": {
    label: "Intro",
    movable: true,
    hideable: true,
    required: false,
  },
  "products.info": {
    label: "Producten-info",
    movable: true,
    hideable: true,
    required: false,
  },
  "contact.main": {
    label: "Intro",
    movable: true,
    hideable: true,
    required: false,
  },
  "contact.info": {
    label: "Contactgegevens",
    movable: true,
    hideable: true,
    required: true,
  },
  "contact.form": {
    label: "Contactformulier",
    movable: true,
    hideable: true,
    required: true,
  },
  "vacatures.main": {
    label: "Vacatures",
    movable: true,
    hideable: true,
    required: false,
  },
  "vacatures.application": {
    label: "Sollicitatie + video",
    movable: true,
    hideable: true,
    required: true,
    lockedPosition: "last",
  },
  "offerte.main": {
    label: "Intro",
    movable: true,
    hideable: true,
    required: false,
  },
  "offerte.info": {
    label: "Contactgegevens",
    movable: true,
    hideable: true,
    required: true,
  },
  "offerte.form": {
    label: "Offerteformulier",
    movable: true,
    hideable: true,
    required: true,
  },
  "privacy.main": {
    label: "Privacyverklaring",
    movable: true,
    hideable: true,
    required: false,
  },
  "terms.main": {
    label: "Algemene voorwaarden",
    movable: true,
    hideable: true,
    required: false,
  },
};

/** Stable deterministic layout IDs for fixed sections. */
export function fixedLayoutId(key: FixedSectionKey): `fixed:${string}` {
  return `fixed:${key.replace(/\./g, ":")}` as `fixed:${string}`;
}

export function isBuiltinPageKey(value: string): value is BuiltinPageKey {
  return (
    value === "home" ||
    value === "about" ||
    value === "services" ||
    value === "products" ||
    value === "contact" ||
    value === "vacatures" ||
    value === "offerte" ||
    value === "privacy" ||
    value === "terms"
  );
}

export function isFixedSectionKey(value: string): value is FixedSectionKey {
  return Object.prototype.hasOwnProperty.call(FIXED_SECTION_DEFS, value);
}

export function pageKeyFromSlug(slug: string): BuiltinPageKey | null {
  const s = slug === "/" ? "home" : slug.replace(/^\//, "");
  if (isBuiltinPageKey(s)) return s;
  return null;
}

export function pageKeyFromPageId(id: string): BuiltinPageKey | null {
  const map: Record<string, BuiltinPageKey> = {
    page_home: "home",
    page_about: "about",
    page_services: "services",
    page_products: "products",
    page_contact: "contact",
    page_vacatures: "vacatures",
    page_offerte: "offerte",
    page_privacy: "privacy",
    page_terms: "terms",
  };
  return map[id] ?? null;
}

export function isLayoutCapableBuiltin(page: { isCustom: boolean; pageKey?: BuiltinPageKey | null }): boolean {
  return !page.isCustom && page.pageKey != null && isBuiltinPageKey(page.pageKey);
}
