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
    expect(html).toContain("object-cover");
    // Side-by-side: asymmetric row with image-dominant column (~58/42).
    expect(html).toContain("md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]");
    // Editorial accent rail on the text column.
    expect(html).toContain("border-l-2 border-primary/55");
  });

  it("renders multi-column grid for below placement with integrated caption strip", () => {
    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, {
        block: galleryBlock({
          title: "Raster galerij",
          contentMode: "textAndImage",
          textPlacement: "below",
          columns: 3,
          images: [
            {
              id: "img_1",
              image: localImage("/images/a.jpg", "A"),
              title: "Eén",
            },
            {
              id: "img_2",
              image: localImage("/images/b.jpg", "B"),
              title: "Twee",
            },
          ],
        }),
      }),
    );
    expect(html).toContain("Eén");
    expect(html).toContain("Twee");
    expect(html).toContain("lg:grid-cols-3");
    expect(html).toContain("object-cover");
    // Unified framed cell — not orphan text under a floating image.
    expect(html).toContain("gallery-text-image-cell");
    expect(html).toContain("rounded-3xl border border-white/12");
    // Below: caption panel overlaps the image bottom.
    expect(html).toContain("-mt-11");
    expect(html).toContain("bg-[#0b1220]/92");
    expect(html).toContain("bg-primary/70");
  });

  it("places caption as frame header for above placement", () => {
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
    expect(html).toContain("gallery-text-image-cell");
    expect(html).toContain("border-b border-white/12");
    expect(html).not.toContain("-mt-11");
    // Above strip: display title with editorial weight (left-aligned, not centered).
    expect(html).toContain("font-display max-w-[22ch] text-[1.35rem] font-semibold");
    expect(html).toContain("text-left");
  });

  it("styles body-only copy as primary caption in the integrated strip", () => {
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
    expect(html).toContain("gallery-text-image-cell");
    // Body-only uses display type as the primary caption (not muted orphan body).
    expect(html).toContain("font-display text-xl font-semibold");
    expect(html).toContain("bg-primary/70");
    // Short below body-only captions center under the image.
    expect(html).toContain("text-center");
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
    // Mosaic uses auto-rows rhythm, not text+image SectionShell grid columns.
    expect(html).toContain("auto-rows-[220px]");
    expect(html).not.toContain("gallery-text-image-cell");
  });

  it("fills grid cells edge-to-edge with object-cover (no letterboxing)", () => {
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
    expect(html).toContain("object-cover");
    expect(html).not.toContain("object-contain");
    expect(html).toContain("aspect-square");
  });
});
