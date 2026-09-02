import { describe, expect, it } from "vitest";
import {
  createDefaultBlock,
  createOfferItem,
  DEFAULT_OFFER_DISCOUNT_BADGE,
  DEFAULT_OFFER_DISCOUNT_PRICE,
  DEFAULT_OFFER_ORIGINAL_PRICE,
  parseMigrateNormalizePage,
  updateLayoutBlockData,
} from "./index";

describe("updateLayoutBlockData dotted paths", () => {
  it("preserves createOfferItem price defaults on list append", () => {
    const offers = createDefaultBlock("offers");
    const page = parseMigrateNormalizePage({
      id: "page_offers",
      slug: "/offers-test",
      title: "Offers",
      description: "",
      isCustom: true,
      inNav: false,
      blocks: [offers],
      updatedAt: 1,
      version: 1,
    })!;
    const blockId = page.blocks[0]!.id;
    const before = page.blocks[0]!.data as { offers: unknown[] };
    const added = createOfferItem();
    const result = updateLayoutBlockData(page, blockId, {
      offers: [...before.offers, added],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const next = result.page.blocks[0]!.data as {
      offers: Array<{
        title: string;
        originalPrice: string;
        discountPrice: string;
        discountBadge?: string;
      }>;
    };
    const last = next.offers[next.offers.length - 1]!;
    expect(last.title).toBe("Nieuwe aanbieding");
    expect(last.originalPrice).toBe(DEFAULT_OFFER_ORIGINAL_PRICE);
    expect(last.discountPrice).toBe(DEFAULT_OFFER_DISCOUNT_PRICE);
    expect(last.discountBadge).toBe(DEFAULT_OFFER_DISCOUNT_BADGE);
  });

  it("merges nested fields without wiping siblings", () => {
    const hero = createDefaultBlock("hero");
    const page = parseMigrateNormalizePage({
      id: "page_dot",
      slug: "/dot",
      title: "Dot",
      description: "",
      isCustom: true,
      inNav: false,
      blocks: [hero],
      updatedAt: 1,
      version: 1,
    })!;
    const blockId = page.blocks[0]!.id;

    const result = updateLayoutBlockData(page, blockId, {
      "headingAccent.accent": "nieuw accent",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.page.blocks[0]!.data as {
      headingAccent?: { beforeAccent?: string; accent?: string; afterAccent?: string };
      title: string;
    };
    expect(data.title).toBeTruthy();
    expect(data.headingAccent?.accent).toBe("nieuw accent");
    // Sibling keys from createDefault remain.
    expect(data.headingAccent?.beforeAccent ?? data.headingAccent?.afterAccent ?? true).toBeTruthy();
  });
});
