import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createDefaultBlock,
  createDefaultPlans,
  planFeatureInclusionLabel,
  toPersistedBlockData,
} from "@mccoy/cms-schema";
import { RegisteredBlockView } from "./RegisteredBlockView";

describe("Plans accessibility", () => {
  it("renders a real table with plan column headers and feature row headers", () => {
    const data = createDefaultPlans();
    const persisted = toPersistedBlockData("plans", data);
    const block = { ...createDefaultBlock("plans"), data: persisted.data, dataVersion: persisted.dataVersion };
    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, { block, adminMode: false }),
    );

    expect(html).toContain("<table");
    expect(html).toContain('scope="col"');
    expect(html).toContain('scope="row"');
    expect(html).toContain("<caption");
    expect(html).toContain("overflow-x-auto");

    for (const plan of data.plans) {
      expect(html).toContain(plan.name);
    }
    for (const feature of data.features) {
      expect(html).toContain(feature.label);
    }
  });

  it("exposes accessible inclusion names and keeps glyphs decorative", () => {
    const data = createDefaultPlans();
    const premium = data.plans.find((p) => p.name === "Premium")!;
    const feature = data.features.find((f) => f.label === "Periodieke controle")!;
    const expected = planFeatureInclusionLabel(premium.name, feature.label, true);

    const persisted = toPersistedBlockData("plans", data);
    const block = { ...createDefaultBlock("plans"), data: persisted.data, dataVersion: persisted.dataVersion };
    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, { block, adminMode: false }),
    );

    expect(html).toContain(expected);
    expect(html).toContain('aria-hidden="true"');
    expect(html).toMatch(/sr-only/);
    // Visible glyphs remain but must not be the only signal
    expect(html).toContain("✓");
    expect(html).toContain("✗");
  });
});
