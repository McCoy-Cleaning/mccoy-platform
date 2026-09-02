import { z } from "zod";
import type { CmsImage } from "../cms-image";
import { createItemId } from "../ids";
import type { CmsBlockDataDefinition } from "./definition";
import { normalizeCmsImage } from "./image-normalize";

/**
 * Promotional CMS display prices (euros, major units) — used only when migrating
 * legacy numeric offer fields into display strings. Not checkout/order money.
 */
const MAX_DISPLAY_PRICE_EUR = 1_000_000;

export type OfferItem = {
  id: string;
  image?: CmsImage;
  badge?: string;
  title: string;
  description?: string;
  /** Marketing strikethrough / was-price copy (e.g. `€ 99,00`). */
  originalPrice: string;
  /** Marketing sale-price copy (e.g. `€ 79,00`). */
  discountPrice: string;
  /** Marketing discount badge copy (e.g. `−20%`). Independent of price math. */
  discountBadge?: string;
};

/** rows = wide editorial rows; cards = compact premium grid cards. */
export type OffersLayout = "rows" | "cards";

export type OffersBlockData = {
  title: string;
  subtitle?: string;
  layout?: OffersLayout;
  offers: OfferItem[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function str(rec: Record<string, unknown>, key: string, fallback = ""): string {
  return typeof rec[key] === "string" ? (rec[key] as string) : fallback;
}

/** EUR formatting for promotional CMS display prices (content only, not checkout). */
export function formatOfferPrice(amount: number, locale: "nl" | "en" = "nl"): string {
  return new Intl.NumberFormat(locale === "en" ? "en-NL" : "nl-NL", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/** @deprecated Prefer `formatOfferPrice(amount, "nl")`. */
export function formatOfferPriceNl(amount: number): string {
  return formatOfferPrice(amount, "nl");
}

/** Coerce legacy numeric (or number-like string) prices for migration only. */
function coerceLegacyPriceNumber(raw: unknown): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.min(raw, MAX_DISPLAY_PRICE_EUR);
  }
  if (typeof raw === "string" && raw.trim()) {
    const cleaned = raw
      .trim()
      .replace(/€/g, "")
      .replace(/\s/g, "")
      .replace(",", ".");
    const n = Number(cleaned);
    if (Number.isFinite(n) && n >= 0) return Math.min(n, MAX_DISPLAY_PRICE_EUR);
  }
  return 0;
}

/**
 * Normalize a price field to marketing display copy.
 * Legacy numbers / bare numeric strings become formatted EUR; other strings stay as-is.
 */
export function normalizeOfferPriceDisplay(raw: unknown, fallback = ""): string {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return fallback;
    // Already looks like display copy (currency symbol or letters) — keep.
    if (/[€$£a-zA-Z]/.test(trimmed)) return trimmed;
    const n = coerceLegacyPriceNumber(trimmed);
    if (n > 0) return formatOfferPriceNl(n);
    if (n === 0 && /^[\d.,]+$/.test(trimmed)) return fallback;
    return trimmed;
  }
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return formatOfferPriceNl(Math.min(raw, MAX_DISPLAY_PRICE_EUR));
  }
  return fallback;
}

/** Percentage off for migrating legacy numeric offers — content math only, not checkout. */
export function offerDiscountPercent(originalPrice: number, discountPrice: number): number {
  if (!(originalPrice > 0) || !(discountPrice >= 0)) return 0;
  if (discountPrice >= originalPrice) return 0;
  return Math.round((1 - discountPrice / originalPrice) * 100);
}

function normalizeDiscountBadge(
  entry: Record<string, unknown>,
  originalRaw: unknown,
  discountRaw: unknown,
): string | undefined {
  const explicit =
    str(entry, "discountBadge").trim() || str(entry, "discountPercent").trim();
  if (explicit) {
    if (/^\d{1,3}$/.test(explicit)) return `−${explicit}%`;
    return explicit;
  }
  // Seed from legacy numeric prices only (not from already-formatted display strings
  // unless they parse cleanly — coerceLegacyPriceNumber strips €).
  const hadLegacyNumber =
    typeof originalRaw === "number" ||
    typeof discountRaw === "number" ||
    (typeof originalRaw === "string" && /^[\d.,\s]+$/.test(originalRaw.trim())) ||
    (typeof discountRaw === "string" && /^[\d.,\s]+$/.test(discountRaw.trim()));
  if (!hadLegacyNumber) return undefined;
  const pct = offerDiscountPercent(
    coerceLegacyPriceNumber(originalRaw),
    coerceLegacyPriceNumber(discountRaw),
  );
  return pct > 0 ? `−${pct}%` : undefined;
}

const offerItemSchema: z.ZodType<OfferItem> = z.object({
  id: z.string().min(1),
  image: z
    .custom<CmsImage | undefined>((v) => v === undefined || normalizeCmsImage(v) != null)
    .optional(),
  badge: z.string().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  originalPrice: z.string(),
  discountPrice: z.string(),
  discountBadge: z.string().optional(),
});

export const offersBlockSchema: z.ZodType<OffersBlockData> = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  layout: z.enum(["rows", "cards"]).optional(),
  offers: z.array(offerItemSchema),
});

export function normalizeOffersLayout(raw: unknown): OffersLayout {
  return raw === "cards" ? "cards" : "rows";
}

/** Default marketing copy for new offer cards (canvas + admin add). */
export const DEFAULT_OFFER_TITLE = "Nieuwe aanbieding";
export const DEFAULT_OFFER_BADGE = "Aanbieding";
export const DEFAULT_OFFER_DESCRIPTION =
  "Vervang deze tekst, afbeelding en prijzen in de CMS-editor.";
export const DEFAULT_OFFER_ORIGINAL_PRICE = formatOfferPriceNl(99);
export const DEFAULT_OFFER_DISCOUNT_PRICE = formatOfferPriceNl(79);
export const DEFAULT_OFFER_DISCOUNT_BADGE = "−20%";

/**
 * True when all three marketing price fields are blank.
 * Used to heal items created during the empty-seed regression without
 * resurrecting prices the editor intentionally cleared on a named offer.
 */
export function isOfferPriceTripleBlank(offer: {
  originalPrice?: unknown;
  discountPrice?: unknown;
  discountBadge?: unknown;
}): boolean {
  const original = normalizeOfferPriceDisplay(offer.originalPrice, "").trim();
  const discount = normalizeOfferPriceDisplay(offer.discountPrice, "").trim();
  const badge =
    typeof offer.discountBadge === "string" ? offer.discountBadge.trim() : "";
  return !original && !discount && !badge;
}

/**
 * Seed familiar €99 / €79 / −20% copy when a brand-new offer still has the
 * default title and a blank price triple (canvas/admin add regression heal).
 * Intentional clears on renamed offers stay blank.
 */
export function seedOfferPricesIfFreshBlank<T extends {
  title: string;
  originalPrice: string;
  discountPrice: string;
  discountBadge?: string;
}>(offer: T): T {
  if (offer.title.trim() !== DEFAULT_OFFER_TITLE) return offer;
  if (!isOfferPriceTripleBlank(offer)) return offer;
  return {
    ...offer,
    originalPrice: DEFAULT_OFFER_ORIGINAL_PRICE,
    discountPrice: DEFAULT_OFFER_DISCOUNT_PRICE,
    discountBadge: DEFAULT_OFFER_DISCOUNT_BADGE,
  };
}

export function createOfferItem(partial?: Partial<Omit<OfferItem, "id">>): OfferItem {
  // Prefer nullish coalescing so callers can pass "" to clear a field intentionally.
  return {
    id: createItemId("offer"),
    image: partial?.image,
    badge: partial?.badge ?? DEFAULT_OFFER_BADGE,
    title: partial?.title ?? DEFAULT_OFFER_TITLE,
    description: partial?.description ?? DEFAULT_OFFER_DESCRIPTION,
    originalPrice: partial?.originalPrice ?? DEFAULT_OFFER_ORIGINAL_PRICE,
    discountPrice: partial?.discountPrice ?? DEFAULT_OFFER_DISCOUNT_PRICE,
    discountBadge: partial?.discountBadge ?? DEFAULT_OFFER_DISCOUNT_BADGE,
  };
}

export function createDefaultOffers(): OffersBlockData {
  return {
    title: "Aanbiedingen",
    subtitle: "Tijdelijke acties en scherpe prijzen — volledig aanpasbaar in de CMS.",
    layout: "rows",
    offers: [
      createOfferItem({
        badge: "Actie",
        title: "Voorbeeld aanbieding",
        description: DEFAULT_OFFER_DESCRIPTION,
      }),
    ],
  };
}

export function normalizeOffers(value: unknown): OffersBlockData {
  const rec = isRecord(value) ? value : {};
  const offersRaw = Array.isArray(rec.offers) ? rec.offers : [];
  const offers: OfferItem[] = [];
  for (const entry of offersRaw) {
    if (!isRecord(entry)) continue;
    const title = str(entry, "title").trim() || "Aanbieding";
    const originalRaw = entry.originalPrice;
    const discountRaw = entry.discountPrice;
    const normalized = seedOfferPricesIfFreshBlank({
      id: str(entry, "id") || createItemId("offer"),
      image: normalizeCmsImage(entry.image, title),
      badge: str(entry, "badge") || undefined,
      title,
      description: str(entry, "description") || undefined,
      originalPrice: normalizeOfferPriceDisplay(originalRaw, ""),
      discountPrice: normalizeOfferPriceDisplay(discountRaw, ""),
      discountBadge: normalizeDiscountBadge(entry, originalRaw, discountRaw),
    });
    offers.push(normalized);
  }
  const data: OffersBlockData = {
    title: str(rec, "title") || "Aanbiedingen",
    subtitle: str(rec, "subtitle") || undefined,
    layout: normalizeOffersLayout(rec.layout),
    offers,
  };
  const parsed = offersBlockSchema.safeParse(data);
  return parsed.success ? parsed.data : createDefaultOffers();
}

export const offersDefinition: CmsBlockDataDefinition<"offers", OffersBlockData> = {
  type: "offers",
  label: "Aanbiedingen",
  category: "Showcase",
  description: "Promotionele aanbiedingen met afbeelding, badge, tekst en prijzen.",
  dataVersion: 1,
  schema: offersBlockSchema,
  createDefault: createDefaultOffers,
  normalize: normalizeOffers,
  capabilities: { duplicable: true, removable: true, publishable: true },
  getSummary: (data) => {
    const d = normalizeOffers(data);
    return `${d.offers.length} aanbieding${d.offers.length === 1 ? "" : "en"}`;
  },
};
