import { z } from "zod";
import { createItemId } from "../ids";
import type { CmsBlockDataDefinition } from "./definition";
import {
  createTextListItem,
  normalizeTextList,
  textListItemSchema,
  type TextListItem,
} from "./text-list";

export type RoadmapMilestone = {
  id: string;
  year?: string;
  title: string;
  body?: string;
  bullets: TextListItem[];
};

export type RoadmapBlockData = {
  title: string;
  milestones: RoadmapMilestone[];
};

export const roadmapMilestoneSchema: z.ZodType<RoadmapMilestone> = z.object({
  id: z.string().min(1),
  year: z.string().optional(),
  title: z.string(),
  body: z.string().optional(),
  bullets: z.array(textListItemSchema),
});

export const roadmapBlockSchema: z.ZodType<RoadmapBlockData> = z.object({
  title: z.string(),
  milestones: z.array(roadmapMilestoneSchema),
});

export function createRoadmapMilestone(
  partial?: Partial<Omit<RoadmapMilestone, "id" | "bullets">> & { bullets?: TextListItem[] },
): RoadmapMilestone {
  return {
    id: createItemId("ms"),
    year: partial?.year ?? "",
    title: partial?.title ?? "Nieuwe mijlpaal",
    body: partial?.body ?? "",
    bullets: partial?.bullets ?? [createTextListItem("Eerste punt")],
  };
}

export function createDefaultRoadmap(): RoadmapBlockData {
  return {
    title: "Onze roadmap",
    milestones: [
      createRoadmapMilestone({
        year: "2024",
        title: "Start",
        body: "Korte toelichting",
        bullets: [createTextListItem("Doelstelling vastgelegd"), createTextListItem("Team samengesteld")],
      }),
      createRoadmapMilestone({
        year: "2025",
        title: "Groei",
        body: "",
        bullets: [createTextListItem("Uitbreiding dienstverlening")],
      }),
    ],
  };
}

export function normalizeRoadmap(value: unknown): RoadmapBlockData {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawMilestones = Array.isArray(rec.milestones) ? rec.milestones : [];
  const milestones: RoadmapMilestone[] = rawMilestones.map((m) => {
    if (!m || typeof m !== "object") return createRoadmapMilestone();
    const row = m as Record<string, unknown>;
    return {
      id: typeof row.id === "string" && row.id ? row.id : createItemId("ms"),
      year: typeof row.year === "string" ? row.year : undefined,
      title: typeof row.title === "string" ? row.title : "",
      body: typeof row.body === "string" ? row.body : undefined,
      bullets: normalizeTextList(row.bullets),
    };
  });
  const parsed = roadmapBlockSchema.safeParse({
    title: typeof rec.title === "string" ? rec.title : "Roadmap",
    milestones,
  });
  return parsed.success ? parsed.data : createDefaultRoadmap();
}

export const roadmapDefinition: CmsBlockDataDefinition<"roadmap", RoadmapBlockData> = {
  type: "roadmap",
  label: "Roadmap",
  category: "Structure",
  description: "Mijlpalen met bewerkbare bullet points.",
  dataVersion: 1,
  schema: roadmapBlockSchema,
  createDefault: createDefaultRoadmap,
  normalize: normalizeRoadmap,
  capabilities: { duplicable: true, removable: true, publishable: true },
};
