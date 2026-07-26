/**
 * Default McCoy partner logos (storefront public paths).
 * Used by the homepage marquee fallback and CMS partners seeding.
 *
 * Existing / seeded logos use a white logo box unless listed in
 * {@link PARTNER_BACKDROP_OVERRIDES}. New uploads capture the removed plate
 * color at compress time (see logoBackdropFromPlateMatte).
 */
import {
  LOGO_BACKDROP_BLACK,
  LOGO_BACKDROP_WHITE,
  type LogoBackdropPreference,
  type LogoBackdropResolved,
} from "./infer-logo-backdrop";

export type PartnerLogo = {
  id: string;
  name: string;
  /** Public path under /images/partners/… */
  src: string;
  /** Editor preference for the logo box. */
  logoBackdrop: LogoBackdropPreference;
  /** Resolved logo-box CSS color. */
  resolvedBackdrop: LogoBackdropResolved;
  /** Exact CSS color for the logo card. */
  cardBackground: string;
};

export type PartnerBackdropOverride = {
  resolvedBackdrop: LogoBackdropResolved;
  logoBackdrop: LogoBackdropPreference;
};

/**
 * Per-partner card mats that differ from the seeded white default.
 * Hex values are authoritative for `resolvedBackdrop` / CMS migration.
 *
 * Steggink yellow sampled from the logo plate (`#fdf100`).
 */
export const PARTNER_BACKDROP_OVERRIDES: Record<string, PartnerBackdropOverride> = {
  "de-dominee-grand-cafe": {
    resolvedBackdrop: LOGO_BACKDROP_BLACK,
    logoBackdrop: "dark",
  },
  finbrokers: {
    resolvedBackdrop: LOGO_BACKDROP_BLACK,
    logoBackdrop: "dark",
  },
  benitech: {
    resolvedBackdrop: LOGO_BACKDROP_BLACK,
    logoBackdrop: "dark",
  },
  laurens: {
    resolvedBackdrop: LOGO_BACKDROP_WHITE,
    logoBackdrop: "light",
  },
  benerink: {
    resolvedBackdrop: LOGO_BACKDROP_WHITE,
    logoBackdrop: "light",
  },
  steggink: {
    // Dominant yellow plate sampled from steggink.png
    resolvedBackdrop: "#fdf100",
    logoBackdrop: "auto",
  },
};

/** @deprecated Prefer {@link PARTNER_BACKDROP_OVERRIDES}. */
export const PARTNER_FORCE_BLACK_IDS = new Set(
  Object.entries(PARTNER_BACKDROP_OVERRIDES)
    .filter(([, v]) => v.resolvedBackdrop === LOGO_BACKDROP_BLACK)
    .map(([id]) => id),
);

/** Filenames in `apps/storefront/public/images/partners/`. */
const PARTNER_FILES = [
  "aircrete-europe.png",
  "akom-oldenzaal.png",
  "alfa-europe.png",
  "benerink.png",
  "benitech.png",
  "cafe-vanouds.png",
  "dancing-bruins.png",
  "de-bonte-koe.png",
  "de-dominee-grand-cafe.png",
  "die-grenze.png",
  "dumeta.png",
  "finbrokers.png",
  "hortec-electronics.png",
  "huka-bikes.png",
  "infinity-pharma.png",
  "keizers.png",
  "laurens.png",
  "nanomi.png",
  "nutsschool.png",
  "oatmossche.png",
  "oltc.png",
  "platvoet-beveiligingssystemen.png",
  "plaza-fit-healthclub.png",
  "quick20-oldenzaal.png",
  "steggink.png",
  "tandartspraktijk-brummelhuis.png",
  "tante-annies.png",
  "vehgro.png",
  "vitaal-verder.png",
  "wijco-technics.png",
] as const;

function formatPartnerName(fileName: string) {
  return fileName
    .replace(/\.(png|jpe?g|webp|svg)$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function partnerId(fileName: string) {
  return fileName.replace(/\.(png|jpe?g|webp|svg)$/i, "").toLowerCase();
}

/** Normalize partner id / CMS id / public path to filename stem. */
export function normalizePartnerId(idOrSrc: string): string {
  return idOrSrc
    .replace(/^partner_/, "")
    .replace(/^.*\/images\/partners\//, "")
    .replace(/\.(png|jpe?g|webp|svg)$/i, "")
    .toLowerCase();
}

export function getPartnerBackdropOverride(
  idOrSrc: string,
): PartnerBackdropOverride | undefined {
  return PARTNER_BACKDROP_OVERRIDES[normalizePartnerId(idOrSrc)];
}

export function isForcedBlackPartner(idOrSrc: string): boolean {
  return getPartnerBackdropOverride(idOrSrc)?.resolvedBackdrop === LOGO_BACKDROP_BLACK;
}

export const DEFAULT_PARTNER_LOGOS: PartnerLogo[] = PARTNER_FILES.map((fileName) => {
  const id = partnerId(fileName);
  const override = PARTNER_BACKDROP_OVERRIDES[id];
  const resolvedBackdrop = override?.resolvedBackdrop ?? LOGO_BACKDROP_WHITE;
  const logoBackdrop = override?.logoBackdrop ?? ("auto" as const);
  return {
    id,
    name: formatPartnerName(fileName),
    src: `/images/partners/${fileName}`,
    logoBackdrop,
    resolvedBackdrop,
    cardBackground: resolvedBackdrop,
  };
}).sort((a, b) => a.name.localeCompare(b.name));

/** Lookup by partner id or public src path. */
export function defaultPartnerResolvedBackdrop(
  idOrSrc: string,
): LogoBackdropResolved | undefined {
  const normalized = normalizePartnerId(idOrSrc);
  const hit = DEFAULT_PARTNER_LOGOS.find((p) => p.id === normalized);
  return hit?.resolvedBackdrop;
}

export function defaultPartnerCmsItems(): Array<{
  id: string;
  name: string;
  logoBackdrop: LogoBackdropPreference;
  resolvedBackdrop: LogoBackdropResolved;
  image: {
    assetId: string;
    src: string;
    alt: string;
    decorative: boolean;
  };
}> {
  return DEFAULT_PARTNER_LOGOS.map((p) => ({
    id: `partner_${p.id}`,
    name: p.name,
    logoBackdrop: p.logoBackdrop,
    resolvedBackdrop: p.resolvedBackdrop,
    image: {
      assetId: `local:images/partners/${p.id}`,
      src: p.src,
      alt: p.name,
      decorative: false,
    },
  }));
}
