import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDefaultBlock, createOfferItem, localImage } from "@mccoy/cms-schema";
import { CmsUiLocaleProvider } from "../uiLocale";
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
    expect(html).toContain('data-cms-media-fit="balanced-contain"');
    expect(html).toContain("aspect-[4/5]");
    expect(html).toContain("object-contain");
    expect(html).toContain("font-display");
    expect(html).toContain("Nu met korting");
    expect(html).not.toContain("object-cover");
    expect(html).not.toContain("md:h-full");
    expect(html).not.toContain("aspect-[16/10]");
    expect(html).not.toContain('data-offer-card="vertical"');
  });

  it("localizes price chrome for EN locale", () => {
    const html = renderToStaticMarkup(
      React.createElement(CmsUiLocaleProvider, {
        locale: "en",
        children: React.createElement(OffersSectionView, {
          data: {
            title: "Offers",
            offers: [
              createOfferItem({
                title: "Promo",
                originalPrice: 100,
                discountPrice: 75,
              }),
            ],
          },
        }),
      }),
    );
    expect(html).toContain("Now discounted");
    expect(html).not.toContain("Nu met korting");
    expect(html).toContain("Was");
    expect(html).toContain("percent off");
  });

  it("renders compact grid cards when layout is cards", () => {
    const html = renderToStaticMarkup(
      React.createElement(OffersSectionView, {
        data: {
          title: "Acties",
          layout: "cards",
          offers: [
            createOfferItem({
              title: "Kaart actie",
              badge: "Hot",
              originalPrice: 120,
              discountPrice: 90,
              image: localImage("/images/offer.jpg", "Actiefoto"),
            }),
            createOfferItem({ title: "Tweede kaart", originalPrice: 0, discountPrice: 49 }),
          ],
        },
      }),
    );
    expect(html).toContain('data-offers-layout="cards"');
    expect(html).toContain('data-offer-card="card"');
    expect(html).toContain("lg:grid-cols-3");
    expect(html).toContain("Kaart actie");
    expect(html).toContain("Tweede kaart");
    expect(html).toContain("offer-price-glow");
    expect(html).toContain("offer-pct-badge");
    expect(html).toContain("object-contain");
    expect(html).toContain('data-cms-media-fit="balanced-contain"');
    expect(html).toContain("aspect-[4/5]");
    expect(html).not.toContain("object-cover");
    expect(html).not.toContain('data-offer-card="side"');
  });

  it("uses portrait framing when image metadata is taller than wide", () => {
    const html = renderToStaticMarkup(
      React.createElement(OffersSectionView, {
        data: {
          title: "Acties",
          offers: [
            createOfferItem({
              title: "Portret actie",
              image: {
                ...localImage("/images/offer-portrait.jpg", "Teamfoto"),
                width: 900,
                height: 1200,
              },
            }),
          ],
        },
      }),
    );
    expect(html).toContain('data-cms-media-fit="portrait-contain"');
    expect(html).toContain("aspect-[3/4]");
    expect(html).toContain("object-contain");
    expect(html).not.toContain("object-cover");
  });

  it("uses open lead + media bridge and meaningful image alt", () => {
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
    expect(html).toContain('data-cms-offers-unit="open"');
    expect(html).toContain('data-cms-gallery-intro="centered"');
    expect(html).toContain("text-center");
    expect(html).not.toContain("data-cms-media-bridge");
    expect(html).toContain('alt="Schoonmaakteam bij glasbewassing"');
    expect(html).not.toContain("offer-pct-badge");
    expect(html).toContain('data-offer-card="side"');

    const empty = renderToStaticMarkup(
      React.createElement(OffersSectionView, {
        data: { title: "Leeg", offers: [] },
      }),
    );
    expect(empty).toContain("Nog geen aanbiedingen");
    expect(empty).not.toContain("data-cms-media-bridge");
  });
});
