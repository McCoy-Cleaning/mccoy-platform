import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDefaultBlock, createFormFieldItem, getBlockDataDefinition } from "@mccoy/cms-schema";
import { ContactFormSectionView } from "./ConversionSectionViews";

describe("ContactFormSectionView formColumnsDesktop", () => {
  it("defaults to a 2-column desktop field grid", () => {
    const block = createDefaultBlock("contactForm");
    const html = renderToStaticMarkup(
      React.createElement(ContactFormSectionView, {
        data: block.data,
        blockId: block.id,
        mode: "preview",
      }),
    );
    expect(html).toContain('data-form-columns="2"');
    expect(html).toContain("sm:grid-cols-2");
  });

  it("renders a single-column field grid when formColumnsDesktop is 1", () => {
    const def = getBlockDataDefinition("contactForm");
    const data = def.normalize({
      title: "Contact",
      formColumnsDesktop: 1,
      fields: [],
    });
    const html = renderToStaticMarkup(
      React.createElement(ContactFormSectionView, {
        data,
        blockId: "cf-test",
        mode: "preview",
      }),
    );
    expect(html).toContain('data-form-columns="1"');
    expect(html).not.toContain("sm:grid-cols-2");
  });

  it("renders the preview-capable file input when a file field is configured", () => {
    const def = getBlockDataDefinition("contactForm");
    const data = def.normalize({
      title: "Contact",
      fields: [createFormFieldItem("Foto's", "file")],
    });
    const html = renderToStaticMarkup(
      React.createElement(ContactFormSectionView, {
        data,
        blockId: "cf-files",
        mode: "preview",
      }),
    );
    expect(html).toContain('type="file"');
    expect(html).toContain("form-file-upload");
    expect(html).toContain("multiple");
  });
});
