import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { createDefaultBlock, createItemId, localImage, type StepsBlockData } from "@mccoy/cms-schema";
import { StepsSectionView } from "./StepsSectionView";
import { RegisteredBlockView } from "./RegisteredBlockView";

describe("StepsSectionView", () => {
  it("renders horizontal slider chrome with title and step cards", () => {
    const block = createDefaultBlock("steps");
    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, { block, adminMode: false }),
    );
    expect(html).toContain('data-cms-block-type="steps"');
    expect(html).toContain('data-steps-slider=""');
    expect(html).toContain('data-steps-track=""');
    expect(html).toContain('data-step-card="active"');
    expect(html).toContain("Vorige stap");
    expect(html).toContain("Volgende stap");
    expect(html).toContain("Stapnavigatie");
  });

  it("shows edge-to-edge cover image on steps that have one", () => {
    const data: StepsBlockData = {
      title: "Aanpak",
      steps: [
        {
          id: createItemId("step"),
          title: "Inspectie",
          body: "We bekijken de locatie.",
          image: localImage("/images/cms/work-regular.jpg", "Inspectie op locatie"),
        },
        {
          id: createItemId("step"),
          title: "Uitvoering",
          body: "Het team gaat aan de slag.",
        },
      ],
    };
    const html = renderToStaticMarkup(React.createElement(StepsSectionView, { data }));
    expect(html).toContain('alt="Inspectie op locatie"');
    expect(html).toContain("object-cover");
    expect(html).toContain("Inspectie");
    expect(html).toContain("Uitvoering");
    expect(html).toContain('data-step-card="active"');
    expect(html).toContain('data-step-card="inactive"');
  });

  it("shows empty state when there are no steps", () => {
    const html = renderToStaticMarkup(
      React.createElement(StepsSectionView, {
        data: { title: "Leeg", steps: [] },
      }),
    );
    expect(html).toContain("Nog geen stappen");
    expect(html).not.toContain("data-steps-slider");
  });
});
