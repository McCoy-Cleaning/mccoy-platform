import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ALL_BLOCK_TYPES, createDefaultBlock } from "@mccoy/cms-schema";
import { RegisteredBlockView } from "./RegisteredBlockView";

describe("RegisteredBlockView smoke", () => {
  it.each(ALL_BLOCK_TYPES)("createDefault(%s) + adminMode render does not throw", (type) => {
    const block = createDefaultBlock(type);
    expect(() => {
      renderToStaticMarkup(
        React.createElement(RegisteredBlockView, { block, adminMode: true }),
      );
    }).not.toThrow();
  });

  it.each(ALL_BLOCK_TYPES)("createDefault(%s) + public render does not throw", (type) => {
    const block = createDefaultBlock(type);
    expect(() => {
      renderToStaticMarkup(
        React.createElement(RegisteredBlockView, { block, adminMode: false }),
      );
    }).not.toThrow();
  });

  it("public mode skips popup until client mount (no inline section markup)", () => {
    const block = createDefaultBlock("popup");
    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, { block, adminMode: false }),
    );
    expect(html).toBe("");
  });

  it("adminMode shows popup preview chrome", () => {
    const block = createDefaultBlock("popup");
    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, { block, adminMode: true }),
    );
    expect(html).toContain("Popup-preview");
    expect(html).toContain("Welkom bij McCoy");
  });

  it("public mode renders newsletter and contactForm markup", () => {
    for (const type of ["newsletter", "contactForm"] as const) {
      const block = createDefaultBlock(type);
      const html = renderToStaticMarkup(
        React.createElement(RegisteredBlockView, { block, adminMode: false }),
      );
      expect(html.length, type).toBeGreaterThan(0);
      expect(html).toContain(`data-cms-block-type="${type}"`);
    }
  });
});
