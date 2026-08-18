import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createDefaultBlock,
  createFormFieldItem,
  type QuoteRequestFormBlockData,
} from "@mccoy/cms-schema";
import { QuoteRequestFormSectionView } from "./QuoteRequestFormSectionView";

describe("QuoteRequestFormSectionView file previews", () => {
  it("uses the multi-file preview input for both quote form tabs", () => {
    const block = createDefaultBlock("quoteRequestForm");
    const base = block.data as QuoteRequestFormBlockData;
    const tabs = base.tabs.map((tab) => ({
      ...tab,
      fields: [...tab.fields, createFormFieldItem("Foto's", "file")],
    }));

    expect(tabs.length).toBeGreaterThanOrEqual(2);
    for (const tab of tabs.slice(0, 2)) {
      const html = renderToStaticMarkup(
        <QuoteRequestFormSectionView
          data={{ ...base, tabs, defaultTabId: tab.id }}
          blockId={`quote-${tab.id}`}
          mode="preview"
        />,
      );
      expect(html).toContain('type="file"');
      expect(html).toContain("multiple");
      expect(html).toContain('accept="image/*,application/pdf"');
    }
  });
});
