import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createDefaultBlock,
  createOfferItem,
  DEFAULT_OFFER_DISCOUNT_BADGE,
  DEFAULT_OFFER_DISCOUNT_PRICE,
  DEFAULT_OFFER_ORIGINAL_PRICE,
  formatOfferPriceNl,
  localImage,
} from "@mccoy/cms-schema";
import { OffersSectionView } from "./OffersSectionView";
import { RegisteredBlockView } from "./RegisteredBlockView";

describe("OffersSectionView", () => {
  it("renders title, offer heading, prices, and percent badge", () => {
    const block = createDefaultBlock("offers");
    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, { block, adminMode: false }),
    );
    expect(html).toContain("Aanbiedingen");
    expect(html).toContain("Voorbeeld aanbieding");
    expect(html).toContain("offer-price-glow");
    expect(html).toContain("offer-pct-badge");
    expect(html).toContain(DEFAULT_OFFER_DISCOUNT_BADGE);
    expect(html).toContain(DEFAULT_OFFER_ORIGINAL_PRICE);
    expect(html).toContain(DEFAULT_OFFER_DISCOUNT_PRICE);
  });

  it("uses a side-by-side image-beside-content card layout", () => {
    const html = renderToStaticMarkup(
      React.createElement(OffersSectionView, {
        data: {
          title: "Acties",
          offers: [
            createOfferItem({
              title: "Grote actie",
              badge: "Actie",
              originalPrice: formatOfferPriceNl(100),
              discountPrice: formatOfferPriceNl(80),
              discountBadge: "−20%",
              image: localImage("/images/offer.jpg", "Aanbiedingsfoto"),
            }),
          ],
        },
      }),
    );
    expect(html).toContain('data-offer-card="side"');
    expect(html).toContain('data-offers-layout="side"');
    expect(html).toContain("md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]");
    expect(html).toContain("min-h-[280px]");
    expect(html).toContain("md:min-h-[360px]");
    expect(html).toContain("object-cover");
    expect(html).toContain("font-display");
    expect(html).toContain("line-through");
    expect(html).not.toContain("aspect-[16/10]");
    expect(html).not.toContain('data-offer-card="vertical"');
  });

  it("uses SectionHeader chrome and hides blank price parts when cleared", () => {
    const html = renderToStaticMarkup(
      React.createElement(OffersSectionView, {
        data: {
          title: "Acties",
          subtitle: "Scherpe prijzen deze maand",
          offers: [
            createOfferItem({
              title: "Glasactie",
              originalPrice: "",
              discountPrice: "",
              discountBadge: "",
              image: localImage("/images/x.jpg", "Schoonmaakteam bij glasbewassing"),
            }),
          ],
        },
      }),
    );
    expect(html).toContain("Acties");
    expect(html).toContain("Scherpe prijzen deze maand");
    expect(html).toContain('alt="Schoonmaakteam bij glasbewassing"');
    expect(html).not.toContain("offer-pct-badge");
    expect(html).not.toContain("offer-price-glow");
    expect(html).not.toContain("line-through");
    expect(html).toContain('data-offer-card="side"');

    const empty = renderToStaticMarkup(
      React.createElement(OffersSectionView, {
        data: { title: "Leeg", offers: [] },
      }),
    );
    expect(empty).toContain("Nog geen aanbiedingen");
  });

  it("renders default-seeded createOfferItem prices on the card", () => {
    const html = renderToStaticMarkup(
      React.createElement(OffersSectionView, {
        data: {
          title: "Nieuw",
          offers: [createOfferItem({ title: "Nieuwe deal" })],
        },
      }),
    );
    expect(html).toContain(DEFAULT_OFFER_ORIGINAL_PRICE);
    expect(html).toContain(DEFAULT_OFFER_DISCOUNT_PRICE);
    expect(html).toContain(DEFAULT_OFFER_DISCOUNT_BADGE);
    expect(html).toContain("line-through");
    expect(html).toContain("offer-price-glow");
    expect(html).toContain("Vervang deze tekst");
  });

  it("heals blank Nieuwe-aanbieding drafts so prices render", () => {
    const block = createDefaultBlock("offers");
    block.data = {
      title: "Acties",
      offers: [
        {
          id: "offer_empty",
          title: "Nieuwe aanbieding",
          badge: "Aanbieding",
          originalPrice: "",
          discountPrice: "",
          discountBadge: "",
        },
      ],
    };
    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, { block, adminMode: false }),
    );
    expect(html).toContain(DEFAULT_OFFER_ORIGINAL_PRICE);
    expect(html).toContain(DEFAULT_OFFER_DISCOUNT_PRICE);
    expect(html).toContain(DEFAULT_OFFER_DISCOUNT_BADGE);
    expect(html).toContain("offer-price-glow");
    expect(html).toContain("offer-pct-badge");
  });

  it("hides intentional clears on public and skips empty badge pill", () => {
    const html = renderToStaticMarkup(
      React.createElement(OffersSectionView, {
        data: {
          title: "Acties",
          offers: [
            createOfferItem({
              title: "Glasactie",
              originalPrice: "",
              discountPrice: "",
              discountBadge: "",
              description: "",
              image: localImage("/images/x.jpg", "Schoonmaakteam bij glasbewassing"),
            }),
          ],
        },
      }),
    );
    expect(html).not.toContain("offer-pct-badge");
    expect(html).not.toContain("offer-price-glow");
    expect(html).not.toContain("line-through");
  });

  it("renders all three price parts as marketing display copy", () => {
    const html = renderToStaticMarkup(
      React.createElement(OffersSectionView, {
        data: {
          title: "Prijzen",
          offers: [
            createOfferItem({
              title: "Deal",
              originalPrice: "€ 50,00",
              discountPrice: "€ 40,00",
              discountBadge: "−20%",
            }),
          ],
        },
      }),
    );
    expect(html).toContain("€ 50,00");
    expect(html).toContain("€ 40,00");
    expect(html).toContain("−20%");
    expect(html).toContain("line-through");
    expect(html).toContain("offer-price-glow");
  });
});
