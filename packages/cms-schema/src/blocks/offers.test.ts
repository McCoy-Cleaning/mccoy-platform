import { describe, expect, it } from "vitest";
import {
  createDefaultBlock,
  parseBlockData,
  validatePageBlocksForPublish,
} from "../blocks";
import {
  createDefaultOffers,
  createOfferItem,
  formatOfferPriceNl,
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
  });

  it("normalizes legacy number-like price strings", () => {
    const normalized = normalizeOffers({
      title: "Acties",
      offers: [
        {
          title: "Pakket",
          originalPrice: "120,50",
          discountPrice: "99.00",
          badge: "Hot",
        },
      ],
    });
    expect(normalized.title).toBe("Acties");
    expect(normalized.offers).toHaveLength(1);
    expect(normalized.offers[0]!.originalPrice).toBe(120.5);
    expect(normalized.offers[0]!.discountPrice).toBe(99);
    expect(normalized.offers[0]!.badge).toBe("Hot");
    expect(normalized.offers[0]!.id).toBeTruthy();
  });

  it("rejects discount above original via schema", () => {
    const bad = {
      title: "X",
      offers: [
        createOfferItem({
          title: "Te duur korting",
          originalPrice: 50,
          discountPrice: 80,
        }),
      ],
    };
    expect(offersBlockSchema.safeParse(bad).success).toBe(false);
  });

  it("computes discount percent and formats EUR (nl-NL)", () => {
    expect(offerDiscountPercent(100, 75)).toBe(25);
    expect(offerDiscountPercent(0, 10)).toBe(0);
    expect(offerDiscountPercent(50, 50)).toBe(0);
    expect(formatOfferPriceNl(79)).toMatch(/€/);
    expect(formatOfferPriceNl(79)).toMatch(/79/);
  });

  it("normalizes empty/invalid payloads without crashing", () => {
    const empty = normalizeOffers({ title: 1, offers: "nope" });
    expect(empty.title).toBe("Aanbiedingen");
    expect(empty.offers).toEqual([]);
    expect(offersBlockSchema.safeParse(empty).success).toBe(true);
  });
});
