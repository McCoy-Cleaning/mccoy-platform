import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  createDefaultBlock,
  createDefaultPlans,
  createItemId,
  planFeatureInclusionLabel,
  toPersistedBlockData,
  type PlansBlockData,
} from "@mccoy/cms-schema";
import { blockViewRegistry } from "./blockViewRegistry";
import { PlansSectionView } from "./PlansSectionView";
import { RegisteredBlockView } from "./RegisteredBlockView";

function plansBlock(data: PlansBlockData = createDefaultPlans()) {
  const persisted = toPersistedBlockData("plans", data);
  return {
    ...createDefaultBlock("plans"),
    data: persisted.data,
    dataVersion: persisted.dataVersion,
  };
}

describe("PlansSectionView registry parity", () => {
  it("registers plans in blockViewRegistry", () => {
    expect(blockViewRegistry.plans).toBe(PlansSectionView);
  });

  it("RegisteredBlockView and PlansSectionView produce identical markup for default plans", () => {
    const data = createDefaultPlans();
    const block = plansBlock(data);
    const viaRegistry = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, { block, adminMode: false }),
    );
    const viaDirect = renderToStaticMarkup(
      React.createElement(PlansSectionView, { data }),
    );
    expect(viaRegistry).toBe(viaDirect);
    expect(viaRegistry).toContain("<table");
    expect(viaRegistry).toContain('data-cms-block-type="plans"');
  });

  it("preserves empty-plans markup", () => {
    const data: PlansBlockData = { title: "Leeg", plans: [], features: [] };
    const block = plansBlock(data);
    const viaRegistry = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, { block, adminMode: false }),
    );
    const viaDirect = renderToStaticMarkup(
      React.createElement(PlansSectionView, { data }),
    );
    expect(viaRegistry).toBe(viaDirect);
    expect(viaRegistry).toContain("Nog geen plannen toegevoegd.");
  });

  it("preserves empty-features row and accessible inclusion labels", () => {
    const featureId = createItemId("feat");
    const data: PlansBlockData = {
      title: "Pakketten",
      features: [],
      plans: [
        {
          id: createItemId("plan"),
          name: "Basis",
          price: "€10",
          description: "Start",
          highlighted: true,
          includedFeatureIds: [featureId],
        },
      ],
    };
    const html = renderToStaticMarkup(
      React.createElement(RegisteredBlockView, { block: plansBlock(data), adminMode: false }),
    );
    expect(html).toContain("Nog geen kenmerken.");
    expect(html).toContain("Basis");
    expect(html).toContain("€10");
  });

  it("matches inclusion label helper for highlighted plan cells", () => {
    const data = createDefaultPlans();
    const premium = data.plans.find((p) => p.name === "Premium")!;
    const feature = data.features.find((f) => f.label === "Periodieke controle")!;
    const expected = planFeatureInclusionLabel(premium.name, feature.label, true);
    const html = renderToStaticMarkup(
      React.createElement(PlansSectionView, { data }),
    );
    expect(html).toContain(expected);
    expect(html).toContain("✓");
    expect(html).toContain("✗");
  });
});
