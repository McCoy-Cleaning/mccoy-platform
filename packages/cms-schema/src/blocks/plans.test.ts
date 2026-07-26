import { describe, expect, it } from "vitest";
import { validatePageBlocksForPublish } from "./validate";
import {
  addPlanFeature,
  createDefaultPlans,
  createPlanFeature,
  createPlanItem,
  plansBlockSchema,
  removePlanFeature,
  reorderPlanFeatures,
  reorderPlans,
  togglePlanFeature,
  planFeatureInclusionLabel,
} from "./plans";

describe("plans matrix ops", () => {
  it("removePlanFeature cleans inclusions atomically", () => {
    const data = createDefaultPlans();
    const featureId = data.features[0]!.id;
    const next = removePlanFeature(data, featureId);
    expect(next.features.some((f) => f.id === featureId)).toBe(false);
    for (const plan of next.plans) {
      expect(plan.includedFeatureIds.includes(featureId)).toBe(false);
    }
  });

  it("togglePlanFeature adds and removes", () => {
    let data = createDefaultPlans();
    const planId = data.plans[0]!.id;
    const featureId = data.features[2]!.id;
    data = togglePlanFeature(data, planId, featureId);
    expect(data.plans[0]!.includedFeatureIds.includes(featureId)).toBe(true);
    data = togglePlanFeature(data, planId, featureId);
    expect(data.plans[0]!.includedFeatureIds.includes(featureId)).toBe(false);
  });

  it("reorder features does not change plan inclusions", () => {
    const data = createDefaultPlans();
    const before = data.plans.map((p) => ({
      id: p.id,
      included: [...p.includedFeatureIds].sort(),
    }));
    const reversedIds = [...data.features].reverse().map((f) => f.id);
    const next = reorderPlanFeatures(data, reversedIds);
    expect(next.features.map((f) => f.id)).toEqual(reversedIds);
    expect(
      next.plans.map((p) => ({ id: p.id, included: [...p.includedFeatureIds].sort() })),
    ).toEqual(before);
  });

  it("reorder plans does not change feature mapping", () => {
    const data = createDefaultPlans();
    const featureOrder = data.features.map((f) => f.id);
    const inclusionByPlan = Object.fromEntries(
      data.plans.map((p) => [p.id, [...p.includedFeatureIds].sort()]),
    );
    const reversedPlanIds = [...data.plans].reverse().map((p) => p.id);
    const next = reorderPlans(data, reversedPlanIds);
    expect(next.plans.map((p) => p.id)).toEqual(reversedPlanIds);
    expect(next.features.map((f) => f.id)).toEqual(featureOrder);
    for (const plan of next.plans) {
      expect([...plan.includedFeatureIds].sort()).toEqual(inclusionByPlan[plan.id]);
    }
  });

  it("every plan × feature cell is decidable from includedFeatureIds", () => {
    const data = createDefaultPlans();
    for (const plan of data.plans) {
      for (const feature of data.features) {
        const included = plan.includedFeatureIds.includes(feature.id);
        expect(typeof included).toBe("boolean");
      }
    }
    expect(plansBlockSchema.safeParse(data).success).toBe(true);
  });

  it("invalid CTA blocks publication", () => {
    const data = createDefaultPlans();
    const bad = {
      ...data,
      plans: data.plans.map((p, i) =>
        i === 0 ? { ...p, cta: { label: "Broken", link: { type: "external" } } } : p,
      ),
    };
    const result = validatePageBlocksForPublish([
      { id: "p1", type: "plans", data: bad as unknown as Record<string, unknown> },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === "PLANS_CTA_INVALID")).toBe(true);
    }
  });

  it("rejects duplicate feature ids", () => {
    const data = createDefaultPlans();
    const dup = { ...data, features: [...data.features, { ...data.features[0]! }] };
    expect(plansBlockSchema.safeParse(dup).success).toBe(false);
  });

  it("rejects unknown includedFeatureIds", () => {
    const data = createDefaultPlans();
    const bad = {
      ...data,
      plans: [createPlanItem({ name: "X", includedFeatureIds: ["missing"] })],
    };
    expect(plansBlockSchema.safeParse(bad).success).toBe(false);
  });

  it("addPlanFeature is idempotent on id", () => {
    const data = createDefaultPlans();
    const f = createPlanFeature("Extra");
    const once = addPlanFeature(data, f);
    const twice = addPlanFeature(once, f);
    expect(twice.features.filter((x) => x.id === f.id)).toHaveLength(1);
  });

  it("planFeatureInclusionLabel communicates inclusion without relying on glyphs alone", () => {
    expect(planFeatureInclusionLabel("Premium", "Periodieke levering", true)).toBe(
      "Premium — Periodieke levering — Inbegrepen",
    );
    expect(planFeatureInclusionLabel("Basis", "Periodieke levering", false)).toBe(
      "Basis — Periodieke levering — Niet inbegrepen",
    );
  });
});
