import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { localImage, type Block } from "@mccoy/cms-schema";
import { RegisteredBlockView } from "./RegisteredBlockView";

function galleryBlock(data: Record<string, unknown>): Block {
  return {
    id: "blk_gallery_test",
    type: "gallery",
    data,
  };
}

describe("gallery text+image render", () => {
  it("renders side-by-side rows for left placement", () => {
    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, {
        block: galleryBlock({
          title: "Galerij met tekst",
          contentMode: "textAndImage",
          textPlacement: "left",
          columns: 2,
          images: [
            {
              id: "img_1",
              image: localImage("/images/a.jpg", "A"),
              title: "Project A",
              body: "Beschrijving A",
            },
          ],
        }),
      }),
    );
    expect(html).toContain("Project A");
    expect(html).toContain("Beschrijving A");
    expect(html).toContain('data-cms-media-fit="portrait-cover"');
    expect(html).toContain("aspect-[3/4]");
    expect(html).toContain("object-cover");
    expect(html).toContain("md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]");
  });

  it("renders equal portrait service columns on the page background", () => {
    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, {
        block: galleryBlock({
          title: "Alles voor een professioneel schone werkomgeving",
          eyebrow: "Ons werk",
          body: "Van sanitaire voorzieningen en hygiënepapier tot professionele reinigingsmiddelen.",
          contentMode: "textAndImage",
          textPlacement: "below",
          columns: 3,
          images: [
            {
              id: "img_1",
              image: localImage("/images/a.jpg", "A"),
              title: "Sanitaire dispensers",
              body: "Functionele dispensers voor een verzorgde, hygiënische en professioneel ingerichte sanitaire ruimte.",
            },
            {
              id: "img_2",
              image: localImage("/images/b.jpg", "B"),
              title: "Hygiënepapier",
              body: "Een compleet assortiment toiletpapier, handdoekrollen en vouwhanddoekjes voor iedere werkomgeving.",
            },
            {
              id: "img_3",
              image: localImage("/images/c.jpg", "C"),
              title: "Professionele reinigingsmiddelen",
              body: "Doeltreffende producten voor de dagelijkse reiniging van interieurs, vloeren en sanitaire ruimtes.",
            },
          ],
        }),
      }),
    );
    expect(html).toContain("Alles voor een professioneel schone werkomgeving");
    expect(html).toContain("Sanitaire dispensers");
    expect(html).toContain("Hygiënepapier");
    expect(html).toContain("Professionele reinigingsmiddelen");
    expect(html).not.toContain("bg-[#F3F1EB]");
    expect(html).not.toContain('data-cms-gallery-surface="light"');
    expect(html).toContain('data-cms-gallery-intro="centered"');
    expect(html).toContain("text-center");
    expect(html).toContain('data-cms-gallery-media="services"');
    expect(html).toContain('data-cms-gallery-item="service"');
    expect(html).toContain('data-cms-media-fit="portrait-cover"');
    expect(html).toContain("aspect-[3/4]");
    expect(html).toContain("object-cover");
    expect(html).toContain("lg:grid-cols-3");
    expect(html).toContain("text-left");
    expect(html).not.toContain("bg-[#152033]");
    expect(html).not.toContain("lg:border-l");
    expect(html).not.toContain('data-cms-gallery-item="featured"');
    expect(html).not.toContain("lg:col-span-7");
    expect(html).not.toContain('data-cms-media-fit="portrait-contain"');
  });

  it("places copy above media when textPlacement is above", () => {
    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, {
        block: galleryBlock({
          title: "Boven",
          contentMode: "textAndImage",
          textPlacement: "above",
          columns: 2,
          images: [
            {
              id: "img_1",
              image: localImage("/images/a.jpg", "A"),
              title: "Header titel",
              body: "Ondersteuning",
            },
          ],
        }),
      }),
    );
    expect(html).toContain("Header titel");
    expect(html).toContain("Ondersteuning");
    expect(html).toContain('data-cms-gallery-item="service"');
    expect(html).toContain("mb-4");
    expect(html).toContain("object-cover");
    expect(html).toContain('data-cms-media-fit="portrait-cover"');
  });

  it("styles body-only copy as primary text under the portrait photo", () => {
    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, {
        block: galleryBlock({
          title: "Body only",
          contentMode: "textAndImage",
          textPlacement: "below",
          columns: 2,
          images: [
            {
              id: "img_1",
              image: localImage("/images/a.jpg", "A"),
              body: "This is text for image 1",
            },
          ],
        }),
      }),
    );
    expect(html).toContain("This is text for image 1");
    expect(html).toContain('data-cms-gallery-item="service"');
    expect(html).toContain("font-display text-lg font-semibold");
    expect(html).toContain("object-cover");
  });

  it("keeps featured mosaic for imagesOnly without contentMode", () => {
    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, {
        block: galleryBlock({
          title: "Klassiek",
          layout: "featured",
          images: [
            {
              id: "img_1",
              image: localImage("/images/a.jpg", "A"),
              title: "Mozaïek titel",
            },
          ],
        }),
      }),
    );
    expect(html).toContain("Klassiek");
    expect(html).toContain("Mozaïek titel");
    expect(html).toContain("auto-rows-[220px]");
    expect(html).not.toContain('data-cms-gallery-item="service"');
    expect(html).toContain('data-cms-gallery-intro="centered"');
    expect(html).toContain("text-center");
  });

  it("matches photo orientation in the media frame (fill without crop-zoom)", () => {
    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, {
        block: galleryBlock({
          title: "Raster",
          layout: "grid",
          contentMode: "imagesOnly",
          images: [
            {
              id: "img_1",
              image: localImage("/images/portrait.jpg", "Portret"),
            },
          ],
        }),
      }),
    );
    expect(html).toContain("object-contain");
    expect(html).not.toContain("object-cover");
    expect(html).toContain("aspect-square");
  });
});
