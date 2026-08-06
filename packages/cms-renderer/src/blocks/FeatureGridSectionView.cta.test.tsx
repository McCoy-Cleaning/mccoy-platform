import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeatureGridSectionView } from "./BasicContentSectionViews";
import "./RegisteredBlockView";

describe("FeatureGridSectionView CTA", () => {
  it("renders interactive card CTAs and omits Geen link chrome", () => {
    const html = renderToStaticMarkup(
      React.createElement(FeatureGridSectionView, {
        data: {
          title: "Assortiment",
          features: [
            {
              id: "a",
              title: "Met link",
              body: "Tekst",
              cta: {
                label: "Offerte",
                action: "link",
                link: { type: "internal_route", route: "contact" },
              },
            },
            {
              id: "b",
              title: "Geen link",
              body: "Tekst",
              cta: {
                label: "Verborgen",
                action: "link",
                link: { type: "none" },
              },
            },
          ],
        },
      }),
    );
    expect(html).toContain("Offerte");
    expect(html).not.toContain("Verborgen");
  });

  it("renders a popup trigger for Open popup action", () => {
    const html = renderToStaticMarkup(
      React.createElement(FeatureGridSectionView, {
        data: {
          title: "Assortiment",
          features: [
            {
              id: "p",
              title: "Popup kaart",
              body: "Tekst",
              cta: {
                label: "Meer info",
                action: "popup",
                link: { type: "none" },
                popup: {
                  type: "richText",
                  data: { title: "In popup", body: "Body" },
                },
              },
            },
          ],
        },
      }),
    );
    expect(html).toContain("Meer info");
    expect(html).toContain('aria-haspopup="dialog"');
    expect(html).not.toContain("In popup");
  });
});
