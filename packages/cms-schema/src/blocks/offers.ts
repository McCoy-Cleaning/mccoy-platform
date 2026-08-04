import { z } from "zod";
import { createItemId, type CmsImage } from "../content";
import type { CmsBlockDataDefinition } from "./definition";
import { normalizeCmsImage } from "./image-normalize";

/**
 * Promotional CMS display prices (euros, major units).
 * Not checkout/order money — content only; no VAT or payment rules.
 */
const MAX_DISPLAY_PRICE_EUR = 1_000_000;

export type OfferItem = {
  id: string;
  image?: CmsImage;
  badge?: string;
  title: string;
  description?: string;
  /** Display original price in EUR (major units). */
  originalPrice: number;
  /** Display discounted price in EUR (major units). */
  discountPrice: number;
};

export type OffersBlockData = {
  title: string;
  subtitle?: string;
  offers: OfferItem[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function str(rec: Record<string, unknown>, key: string, fallback = ""): string {
  return typeof rec[key] === "string" ? (rec[key] as string) : fallback;
}

function displayPrice(raw: unknown, fallback = 0): number {
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
    return Math.min(raw, MAX_DISPLAY_PRICE_EUR);
  }
  if (typeof raw === "string" && raw.trim()) {
    const normalized = raw.trim().replace(",", ".");
    const n = Number(normalized);
    if (Number.isFinite(n) && n >= 0) return Math.min(n, MAX_DISPLAY_PRICE_EUR);
  }
  return fallback;
}

const offerItemSchema: z.ZodType<OfferItem> = z
  .object({
    id: z.string().min(1),
    image: z
      .custom<CmsImage | undefined>((v) => v === undefined || normalizeCmsImage(v) != null)
      .optional(),
    badge: z.string().optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    originalPrice: z.number().min(0).max(MAX_DISPLAY_PRICE_EUR),
    discountPrice: z.number().min(0).max(MAX_DISPLAY_PRICE_EUR),
  })
  .superRefine((item, ctx) => {
    if (item.originalPrice > 0 && item.discountPrice > item.originalPrice) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Aanbiedingsprijs mag niet hoger zijn dan de oorspronkelijke prijs",
        path: ["discountPrice"],
      });
    }
  });

export const offersBlockSchema: z.ZodType<OffersBlockData> = z.object({
  title: z.string(),
  subtitle: z.string().optional(),
  offers: z.array(offerItemSchema),
});

export function createOfferItem(partial?: Partial<Omit<OfferItem, "id">>): OfferItem {
  return {
    id: createItemId("offer"),
    image: partial?.image,
    badge: partial?.badge ?? "Aanbieding",
    title: partial?.title ?? "Nieuwe aanbieding",
    description: partial?.description ?? "",
    originalPrice: partial?.originalPrice ?? 0,
    discountPrice: partial?.discountPrice ?? 0,
  };
}

export function createDefaultOffers(): OffersBlockData {
  return {
    title: "Aanbiedingen",
    subtitle: "Tijdelijke acties en scherpe prijzen — volledig aanpasbaar in de CMS.",
    offers: [
      createOfferItem({
        badge: "Actie",
        title: "Voorbeeld aanbieding",
        description: "Vervang deze tekst, afbeelding en prijzen in de CMS-editor.",
        originalPrice: 99,
        discountPrice: 79,
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
    offers.push({
      id: str(entry, "id") || createItemId("offer"),
      image: normalizeCmsImage(entry.image, title),
      badge: str(entry, "badge") || undefined,
      title,
      description: str(entry, "description") || undefined,
      originalPrice: displayPrice(entry.originalPrice, 0),
      discountPrice: displayPrice(entry.discountPrice, 0),
    });
  }
  const data: OffersBlockData = {
    title: str(rec, "title") || "Aanbiedingen",
    subtitle: str(rec, "subtitle") || undefined,
    offers,
  };
  const parsed = offersBlockSchema.safeParse(data);
  return parsed.success ? parsed.data : createDefaultOffers();
}

/** Percentage off for storefront badge — content math only, not checkout. */
export function offerDiscountPercent(originalPrice: number, discountPrice: number): number {
  if (!(originalPrice > 0) || !(discountPrice >= 0)) return 0;
  if (discountPrice >= originalPrice) return 0;
  return Math.round((1 - discountPrice / originalPrice) * 100);
}

/** Dutch EUR formatting for promotional CMS display prices. */
export function formatOfferPriceNl(amount: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(amount);
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
