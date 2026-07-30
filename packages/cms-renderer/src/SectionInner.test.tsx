import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ContentAlignProvider } from "./contentAlign";
import { SectionInner } from "./SectionInner";
import { RegisteredBlockView } from "./blocks/RegisteredBlockView";
import type { Block } from "@mccoy/cms-schema";

describe("SectionInner contentAlign structure", () => {
  it("defaults to rail → justify-center → column", () => {
    const html = renderToStaticMarkup(
      React.createElement(SectionInner, null, "x"),
    );
    expect(html).toContain('data-cms-section-rail=""');
    expect(html).toContain('data-cms-content-align="center"');
    expect(html).toContain("mx-auto w-full max-w-[96rem] px-5 sm:px-8 lg:px-10 xl:px-12");
    expect(html).toContain("flex w-full justify-center");
    expect(html).toContain('data-cms-section-inner=""');
    expect(html).not.toContain("justify-start");
    expect(html).not.toContain("justify-end");
    // Gutters must not sit on the alignable column.
    expect(html).toMatch(
      /data-cms-section-rail=""[^>]*>[\s\S]*data-cms-section-align=""[\s\S]*data-cms-section-inner=""/,
    );
  });

  it("applies exact justify class for left and right inside the page rail", () => {
    const left = renderToStaticMarkup(
      React.createElement(ContentAlignProvider, {
        align: "left",
        children: React.createElement(SectionInner, { maxWidth: "3xl", children: "L" }),
      }),
    );
    const right = renderToStaticMarkup(
      React.createElement(ContentAlignProvider, {
        align: "right",
        children: React.createElement(SectionInner, { maxWidth: "3xl", children: "R" }),
      }),
    );
    expect(left).toContain('data-cms-section-rail=""');
    expect(left).toContain('data-cms-content-align="left"');
    expect(left).toContain("flex w-full justify-start");
    expect(left).toContain("min-w-0 w-fit max-w-3xl");
    expect(left).not.toContain("justify-center");
    expect(left).not.toContain("justify-end");

    expect(right).toContain('data-cms-content-align="right"');
    expect(right).toContain("flex w-full justify-end");
    expect(right).not.toContain("justify-center");
    expect(right).not.toContain("justify-start");
  });
});

describe("RegisteredBlockView richText contentAlign structure", () => {
  const richTextBlock = {
    id: "b1",
    type: "richText",
    data: { title: "Tekst", body: "Body" },
  } as Block;

  function renderAlign(align: "left" | "center" | "right") {
    return renderToStaticMarkup(
      React.createElement(ContentAlignProvider, {
        align,
        children: React.createElement(RegisteredBlockView, {
          block: richTextBlock,
          pages: [],
        }),
      }),
    );
  }

  it("nests rail → align row → max-w-3xl column for each align", () => {
    for (const align of ["left", "center", "right"] as const) {
      const html = renderAlign(align);
      expect(html).toContain('data-cms-block-type="richText"');
      expect(html).toContain(`data-cms-content-align="${align}"`);
      expect(html).toContain('data-cms-section-rail=""');
      expect(html).toContain("mx-auto w-full max-w-[96rem] px-5");
      expect(html).toContain('data-cms-section-align=""');
      expect(html).toContain("min-w-0 w-fit max-w-3xl");
      // Padding only on rail — column must not re-pad (that offset the visual center).
      expect(html).toContain('data-cms-section-inner=""');
      expect(html).not.toMatch(
        /data-cms-section-inner=""[^>]*px-4/,
      );
      expect(html).not.toMatch(
        /class="[^"]*px-4[^"]*"[^>]*data-cms-section-inner/,
      );
    }
    expect(renderAlign("left")).toContain("justify-start");
    expect(renderAlign("center")).toContain("justify-center");
    expect(renderAlign("right")).toContain("justify-end");
  });
});
