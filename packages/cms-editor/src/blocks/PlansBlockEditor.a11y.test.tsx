import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createDefaultPlans, planFeatureInclusionLabel } from "@mccoy/cms-schema";
import { PlansBlockEditor } from "./PlansBlockEditor";

let mounted: { container: HTMLDivElement; root: Root } | null = null;

function mount(children: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(children);
  });
  mounted = { container, root };
  return container;
}

afterEach(() => {
  if (mounted) {
    act(() => mounted!.root.unmount());
    mounted.container.remove();
    mounted = null;
  }
});

describe("PlansBlockEditor a11y", () => {
  it("matrix checkboxes expose Dutch inclusion accessible names", () => {
    const value = createDefaultPlans();
    const container = mount(<PlansBlockEditor value={value} onChange={vi.fn()} />);

    const premium = value.plans.find((p) => p.name === "Premium")!;
    const feature = value.features.find((f) => f.label === "Periodieke controle")!;
    const name = planFeatureInclusionLabel(premium.name, feature.label, true);

    const checkbox = container.querySelector(`input[type="checkbox"][aria-label="${name}"]`);
    expect(checkbox).toBeTruthy();

    const basis = value.plans.find((p) => p.name === "Basis")!;
    const excluded = value.features.find((f) => f.label === "Priority support")!;
    const excludedName = planFeatureInclusionLabel(basis.name, excluded.label, false);
    expect(
      container.querySelector(`input[type="checkbox"][aria-label="${excludedName}"]`),
    ).toBeTruthy();
  });

  it("renders table semantics for the per-plan matrix", () => {
    const value = createDefaultPlans();
    const container = mount(<PlansBlockEditor value={value} onChange={vi.fn()} />);
    expect(container.querySelectorAll("table").length).toBeGreaterThan(0);
    expect(container.querySelectorAll('[scope="row"]').length).toBeGreaterThan(0);
  });
});
