import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDefaultBlock, createItemId, localImage, toPersistedBlockData } from "@mccoy/cms-schema";
import { RegisteredBlockView } from "./RegisteredBlockView";

/**
 * Lightweight visual regression without Playwright screenshot tooling:
 * stable HTML snapshots for high-value public blocks.
 * Run: `npm test -- src/blocks/visual-regression.test.tsx` in cms-renderer.
 */
function renderBlock(type: Parameters<typeof createDefaultBlock>[0], data?: Record<string, unknown>) {
  const block = createDefaultBlock(type);
  if (data) {
    const persisted = toPersistedBlockData(type, { ...block.data, ...data });
    block.data = persisted.data;
    block.dataVersion = persisted.dataVersion;
  }
  return renderToStaticMarkup(
    React.createElement(RegisteredBlockView, { block, adminMode: false }),
  );
}

describe("CMS visual regression (HTML snapshots)", () => {
  it("Hero default", () => {
    expect(renderBlock("hero")).toMatchSnapshot();
  });

  it("Text + image with and without image", () => {
    expect(renderBlock("textImage")).toMatchSnapshot("empty-image");
    expect(
      renderBlock("textImage", {
        image: localImage("/images/cms/hero-cleaning.jpg", "Team"),
        reverse: true,
      }),
    ).toMatchSnapshot("with-image-reverse");
  });

  it("Roadmap empty / one / many milestones", () => {
    expect(renderBlock("roadmap", { title: "Leeg", milestones: [] })).toMatchSnapshot("empty");
    expect(
      renderBlock("roadmap", {
        title: "Eén",
        milestones: [
          {
            id: createItemId("ms"),
            year: "2026",
            title: "Start",
            body: "Kort",
            bullets: [{ id: createItemId("b"), text: "Punt" }],
          },
        ],
      }),
    ).toMatchSnapshot("one");
    expect(renderBlock("roadmap")).toMatchSnapshot("default-many");
  });

  it("Plans matrix (highlighted + mobile scroll wrapper)", () => {
    expect(renderBlock("plans")).toMatchSnapshot();
  });
});
