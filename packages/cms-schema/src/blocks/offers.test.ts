import { describe, expect, it } from "vitest";
import {
  createDefaultBlock,
  parseBlockData,
  validatePageBlocksForPublish,
} from "../blocks";
import {
  createDefaultOffers,
  createOfferItem,
  DEFAULT_OFFER_DISCOUNT_BADGE,
  DEFAULT_OFFER_DISCOUNT_PRICE,
  DEFAULT_OFFER_ORIGINAL_PRICE,
  formatOfferPrice,
  formatOfferPriceNl,
  normalizeOfferPriceDisplay,
  normalizeOffers,
  offerDiscountPercent,
  offersBlockSchema,
} from "./offers";

describe("offers block", () => {
  it("default parses and is publishable", () => {
    const data = createDefaultOffers();
    expect(offersBlockSchema.safeParse(data).success).toBe(true);
    const parsed = parseBlockData("offers", data);
    expect(parsed.ok).toBe(true);
    const block = createDefaultBlock("offers");
    expect(validatePageBlocksForPublish([block]).ok).toBe(true);
    expect(block.dataVersion).toBe(1);
    const offer = data.offers[0]!;
    expect(offer.originalPrice).toBe(DEFAULT_OFFER_ORIGINAL_PRICE);
    expect(offer.discountPrice).toBe(DEFAULT_OFFER_DISCOUNT_PRICE);
    expect(offer.discountBadge).toBe(DEFAULT_OFFER_DISCOUNT_BADGE);
  });

  it("seeds new offer items with previous-looking price defaults", () => {
    const item = createOfferItem();
    expect(item.originalPrice).toBe(DEFAULT_OFFER_ORIGINAL_PRICE);
    expect(item.discountPrice).toBe(DEFAULT_OFFER_DISCOUNT_PRICE);
    expect(item.discountBadge).toBe(DEFAULT_OFFER_DISCOUNT_BADGE);
    expect(item.originalPrice).toMatch(/€/);
    expect(item.discountPrice).toMatch(/79/);
    expect(item.description).toMatch(/Vervang deze tekst/);
  });

  it("allows intentionally clearing price fields on create", () => {
    const item = createOfferItem({
      title: "Leeg gemaakt",
      originalPrice: "",
      discountPrice: "",
      discountBadge: "",
      description: "",
    });
    expect(item.originalPrice).toBe("");
    expect(item.discountPrice).toBe("");
    expect(item.discountBadge).toBe("");
    expect(item.description).toBe("");
  });

  it("heals blank price triples on fresh default-titled offers during normalize", () => {
    const normalized = normalizeOffers({
      title: "Acties",
      offers: [
        {
          id: "offer_blank",
          title: "Nieuwe aanbieding",
          badge: "Aanbieding",
          originalPrice: "",
          discountPrice: "",
          discountBadge: "",
        },
      ],
    });
    expect(normalized.offers[0]!.originalPrice).toBe(DEFAULT_OFFER_ORIGINAL_PRICE);
    expect(normalized.offers[0]!.discountPrice).toBe(DEFAULT_OFFER_DISCOUNT_PRICE);
    expect(normalized.offers[0]!.discountBadge).toBe(DEFAULT_OFFER_DISCOUNT_BADGE);
  });

  it("does not resurrect intentional clears on renamed offers", () => {
    const normalized = normalizeOffers({
      title: "Acties",
      offers: [
        {
          id: "offer_cleared",
          title: "Zonder prijs",
          originalPrice: "",
          discountPrice: "",
          discountBadge: "",
        },
      ],
    });
    expect(normalized.offers[0]!.originalPrice).toBe("");
    expect(normalized.offers[0]!.discountPrice).toBe("");
    expect(normalized.offers[0]!.discountBadge).toBeUndefined();
  });

  it("normalizes legacy numeric prices into display strings and seeds badge", () => {
    const normalized = normalizeOffers({
      title: "Acties",
      offers: [
        {
          title: "Pakket",
          originalPrice: 120.5,
          discountPrice: 99,
          badge: "Hot",
        },
      ],
    });
    expect(normalized.title).toBe("Acties");
    expect(normalized.offers).toHaveLength(1);
    expect(normalized.offers[0]!.originalPrice).toBe(formatOfferPriceNl(120.5));
    expect(normalized.offers[0]!.discountPrice).toBe(formatOfferPriceNl(99));
    expect(normalized.offers[0]!.discountBadge).toBe("−18%");
    expect(normalized.offers[0]!.badge).toBe("Hot");
    expect(normalized.offers[0]!.id).toBeTruthy();
  });

  it("normalizes legacy number-like price strings into EUR display", () => {
    const normalized = normalizeOffers({
      title: "Acties",
      offers: [
        {
          title: "Pakket",
          originalPrice: "120,50",
          discountPrice: "99.00",
        },
      ],
    });
    expect(normalized.offers[0]!.originalPrice).toBe(formatOfferPriceNl(120.5));
    expect(normalized.offers[0]!.discountPrice).toBe(formatOfferPriceNl(99));
    expect(normalized.offers[0]!.discountBadge).toBe("−18%");
  });

  it("keeps free-form marketing price copy and independent badge", () => {
    const normalized = normalizeOffers({
      title: "Acties",
      offers: [
        {
          title: "Pakket",
          originalPrice: "vanaf € 99",
          discountPrice: "€ 79,-",
          discountBadge: "Actie −20%",
        },
      ],
    });
    expect(normalized.offers[0]!.originalPrice).toBe("vanaf € 99");
    expect(normalized.offers[0]!.discountPrice).toBe("€ 79,-");
    expect(normalized.offers[0]!.discountBadge).toBe("Actie −20%");
  });

  it("accepts discount display above original (marketing copy, not money rules)", () => {
    const item = createOfferItem({
      title: "Marketing",
      originalPrice: "€ 50,00",
      discountPrice: "€ 80,00",
      discountBadge: "−10%",
    });
    expect(offersBlockSchema.safeParse({ title: "X", offers: [item] }).success).toBe(true);
  });

  it("computes discount percent helper and formats EUR", () => {
    expect(offerDiscountPercent(100, 75)).toBe(25);
    expect(offerDiscountPercent(0, 10)).toBe(0);
    expect(offerDiscountPercent(50, 50)).toBe(0);
    expect(formatOfferPriceNl(79)).toMatch(/€/);
    expect(formatOfferPriceNl(79)).toMatch(/79/);
    expect(formatOfferPrice(79, "en")).toMatch(/€/);
    expect(formatOfferPrice(79, "en")).toMatch(/79/);
    expect(normalizeOfferPriceDisplay(79)).toBe(formatOfferPriceNl(79));
    expect(normalizeOfferPriceDisplay("€ 12")).toBe("€ 12");
    expect(normalizeOfferPriceDisplay("")).toBe("");
    expect(normalizeOfferPriceDisplay(0)).toBe("");
  });

  it("normalizes empty/invalid payloads without crashing", () => {
    const empty = normalizeOffers({ title: 1, offers: "nope" });
    expect(empty.title).toBe("Aanbiedingen");
    expect(empty.offers).toEqual([]);
    expect(offersBlockSchema.safeParse(empty).success).toBe(true);
  });

  it("normalizes the layout control with a safe rows fallback", () => {
    expect(normalizeOffers({ title: "X", layout: "cards", offers: [] }).layout).toBe("cards");
    expect(normalizeOffers({ title: "X", layout: "rows", offers: [] }).layout).toBe("rows");
    expect(normalizeOffers({ title: "X", layout: "bogus", offers: [] }).layout).toBe("rows");
    expect(normalizeOffers({ title: "X", offers: [] }).layout).toBe("rows");
    expect(createDefaultOffers().layout).toBe("rows");
  });
});
