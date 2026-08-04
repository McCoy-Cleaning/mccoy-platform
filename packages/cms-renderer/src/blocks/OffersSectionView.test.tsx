import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDefaultBlock, createOfferItem, localImage } from "@mccoy/cms-schema";
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
    expect(html).toMatch(/−\d+%/);
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
              originalPrice: 100,
              discountPrice: 80,
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
    expect(html).not.toContain("aspect-[16/10]");
    expect(html).not.toContain('data-offer-card="vertical"');
  });

  it("uses SectionHeader chrome and meaningful image alt", () => {
    const html = renderToStaticMarkup(
      React.createElement(OffersSectionView, {
        data: {
          title: "Acties",
          subtitle: "Scherpe prijzen deze maand",
          offers: [
            createOfferItem({
              title: "Glasactie",
              originalPrice: 0,
              discountPrice: 0,
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
    expect(html).toContain('data-offer-card="side"');

    const empty = renderToStaticMarkup(
      React.createElement(OffersSectionView, {
        data: { title: "Leeg", offers: [] },
      }),
    );
    expect(empty).toContain("Nog geen aanbiedingen");
  });
});
