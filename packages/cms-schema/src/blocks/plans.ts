import { z } from "zod";
import { cmsButtonSchema, type CmsButton } from "../button";
import { createItemId } from "../ids";
import { linkFromLegacyHref } from "../links";
import type { CmsBlockDataDefinition } from "./definition";
import { reorderByIds } from "./text-list";

export type PlanFeature = { id: string; label: string };
export type PlanItem = {
  id: string;
  name: string;
  price?: string;
  description?: string;
  cta?: CmsButton;
  includedFeatureIds: string[];
  highlighted?: boolean;
};

export type PlansBlockData = {
  title: string;
  features: PlanFeature[];
  plans: PlanItem[];
};

const planFeatureSchema: z.ZodType<PlanFeature> = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
});

const planItemSchema: z.ZodType<PlanItem> = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  price: z.string().optional(),
  description: z.string().optional(),
  cta: cmsButtonSchema.optional(),
  includedFeatureIds: z.array(z.string().min(1)),
  highlighted: z.boolean().optional(),
});

export const plansBlockSchema: z.ZodType<PlansBlockData> = z
  .object({
    title: z.string(),
    features: z.array(planFeatureSchema),
    plans: z.array(planItemSchema),
  })
  .superRefine((data, ctx) => {
    const featureIds = new Set<string>();
    for (const f of data.features) {
      if (featureIds.has(f.id)) {
        ctx.addIssue({ code: "custom", message: `Duplicate feature id ${f.id}`, path: ["features"] });
      }
      featureIds.add(f.id);
    }
    const planIds = new Set<string>();
    for (const p of data.plans) {
      if (planIds.has(p.id)) {
        ctx.addIssue({ code: "custom", message: `Duplicate plan id ${p.id}`, path: ["plans"] });
      }
      planIds.add(p.id);
      const seen = new Set<string>();
      for (const fid of p.includedFeatureIds) {
        if (seen.has(fid)) {
          ctx.addIssue({
            code: "custom",
            message: `Duplicate feature ${fid} in plan ${p.id}`,
            path: ["plans"],
          });
        }
        seen.add(fid);
        if (!featureIds.has(fid)) {
          ctx.addIssue({
            code: "custom",
            message: `Unknown feature id ${fid} in plan ${p.id}`,
            path: ["plans"],
          });
        }
      }
    }
  });

export function createPlanFeature(label = "Nieuwe functie"): PlanFeature {
  return { id: createItemId("feat"), label };
}

export function createPlanItem(partial?: Partial<Omit<PlanItem, "id">>): PlanItem {
  return {
    id: createItemId("plan"),
    name: partial?.name ?? "Nieuw plan",
    price: partial?.price ?? "",
    description: partial?.description ?? "",
    cta: partial?.cta,
    includedFeatureIds: partial?.includedFeatureIds ?? [],
    highlighted: partial?.highlighted ?? false,
  };
}

export function createDefaultPlans(): PlansBlockData {
  const f1 = createPlanFeature("Basis reiniging");
  const f2 = createPlanFeature("Periodieke controle");
  const f3 = createPlanFeature("Priority support");
  return {
    title: "Onze pakketten",
    features: [f1, f2, f3],
    plans: [
      createPlanItem({
        name: "Basis",
        price: "Op aanvraag",
        includedFeatureIds: [f1.id, f2.id],
      }),
      createPlanItem({
        name: "Premium",
        price: "Op aanvraag",
        highlighted: true,
        includedFeatureIds: [f1.id, f2.id, f3.id],
        cta: {
          label: "Neem contact op",
          link: { type: "internal_route", route: "contact" },
        },
      }),
    ],
  };
}

export function normalizePlans(value: unknown): PlansBlockData {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const featuresRaw = Array.isArray(rec.features) ? rec.features : [];
  const features: PlanFeature[] = featuresRaw.map((f) => {
    if (!f || typeof f !== "object") return createPlanFeature();
    const row = f as Record<string, unknown>;
    return {
      id: typeof row.id === "string" && row.id ? row.id : createItemId("feat"),
      label: typeof row.label === "string" && row.label ? row.label : "Functie",
    };
  });
  const featureIdSet = new Set(features.map((f) => f.id));
  const plansRaw = Array.isArray(rec.plans) ? rec.plans : [];
  const plans: PlanItem[] = plansRaw.map((p) => {
    if (!p || typeof p !== "object") return createPlanItem();
    const row = p as Record<string, unknown>;
    const included = Array.isArray(row.includedFeatureIds)
      ? row.includedFeatureIds.filter((id): id is string => typeof id === "string" && featureIdSet.has(id))
      : [];
    let cta: CmsButton | undefined;
    if (row.cta && typeof row.cta === "object") {
      const parsed = cmsButtonSchema.safeParse(row.cta);
      if (parsed.success) cta = parsed.data;
    } else {
      const label = typeof row.ctaLabel === "string" ? row.ctaLabel.trim() : "";
      const href = typeof row.ctaHref === "string" ? row.ctaHref : "";
      if (label) {
        const link = linkFromLegacyHref(href);
        if (link) cta = { label, link };
      }
    }
    return {
      id: typeof row.id === "string" && row.id ? row.id : createItemId("plan"),
      name: typeof row.name === "string" && row.name ? row.name : "Plan",
      price: typeof row.price === "string" ? row.price : undefined,
      description: typeof row.description === "string" ? row.description : undefined,
      cta,
      includedFeatureIds: [...new Set(included)],
      highlighted: row.highlighted === true,
    };
  });
  const parsed = plansBlockSchema.safeParse({
    title: typeof rec.title === "string" ? rec.title : "Pakketten",
    features,
    plans,
  });
  return parsed.success ? parsed.data : createDefaultPlans();
}

export function addPlanFeature(data: PlansBlockData, feature: PlanFeature): PlansBlockData {
  if (data.features.some((f) => f.id === feature.id)) return data;
  return { ...data, features: [...data.features, feature] };
}

export function renamePlanFeature(
  data: PlansBlockData,
  featureId: string,
  label: string,
): PlansBlockData {
  return {
    ...data,
    features: data.features.map((f) => (f.id === featureId ? { ...f, label } : f)),
  };
}

export function removePlanFeature(data: PlansBlockData, featureId: string): PlansBlockData {
  return {
    ...data,
    features: data.features.filter((f) => f.id !== featureId),
    plans: data.plans.map((p) => ({
      ...p,
      includedFeatureIds: p.includedFeatureIds.filter((id) => id !== featureId),
    })),
  };
}

export function addPlan(data: PlansBlockData, plan: PlanItem): PlansBlockData {
  if (data.plans.some((p) => p.id === plan.id)) return data;
  const featureIds = new Set(data.features.map((f) => f.id));
  const cleaned = {
    ...plan,
    includedFeatureIds: plan.includedFeatureIds.filter((id) => featureIds.has(id)),
  };
  return { ...data, plans: [...data.plans, cleaned] };
}

export function removePlan(data: PlansBlockData, planId: string): PlansBlockData {
  return { ...data, plans: data.plans.filter((p) => p.id !== planId) };
}

export function togglePlanFeature(
  data: PlansBlockData,
  planId: string,
  featureId: string,
): PlansBlockData {
  if (!data.features.some((f) => f.id === featureId)) return data;
  return {
    ...data,
    plans: data.plans.map((p) => {
      if (p.id !== planId) return p;
      const has = p.includedFeatureIds.includes(featureId);
      return {
        ...p,
        includedFeatureIds: has
          ? p.includedFeatureIds.filter((id) => id !== featureId)
          : [...p.includedFeatureIds, featureId],
      };
    }),
  };
}

export function reorderPlanFeatures(data: PlansBlockData, orderedIds: string[]): PlansBlockData {
  return { ...data, features: reorderByIds(data.features, orderedIds) };
}

export function reorderPlans(data: PlansBlockData, orderedIds: string[]): PlansBlockData {
  return { ...data, plans: reorderByIds(data.plans, orderedIds) };
}

/** Accessible inclusion label — never rely on ✓/✗ alone. */
export function planFeatureInclusionLabel(
  planName: string,
  featureLabel: string,
  included: boolean,
): string {
  const status = included ? "Inbegrepen" : "Niet inbegrepen";
  return `${planName} — ${featureLabel} — ${status}`;
}

export const plansDefinition: CmsBlockDataDefinition<"plans", PlansBlockData> = {
  type: "plans",
  label: "Pakketten",
  category: "Structure",
  description: "Prijsplannen met gedeelde kenmerkenmatrix.",
  dataVersion: 1,
  schema: plansBlockSchema,
  createDefault: createDefaultPlans,
  normalize: normalizePlans,
  capabilities: { duplicable: true, removable: true, publishable: true },
};
