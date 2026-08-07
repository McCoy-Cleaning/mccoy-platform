import { z } from "zod";
import { createItemId } from "../ids";
import type { CmsBlockDataDefinition } from "./definition";

export type TimelineMilestone = {
  id: string;
  year?: string;
  title: string;
  body?: string;
};

export type TimelineBlockData = {
  title: string;
  milestones: TimelineMilestone[];
};

export const timelineMilestoneSchema: z.ZodType<TimelineMilestone> = z.object({
  id: z.string().min(1),
  year: z.string().optional(),
  title: z.string(),
  body: z.string().optional(),
});

export const timelineBlockSchema: z.ZodType<TimelineBlockData> = z.object({
  title: z.string(),
  milestones: z.array(timelineMilestoneSchema),
});

export function createTimelineMilestone(
  partial?: Partial<Omit<TimelineMilestone, "id">>,
): TimelineMilestone {
  return {
    id: createItemId("tl"),
    year: partial?.year ?? "",
    title: partial?.title ?? "Mijlpaal",
    body: partial?.body ?? "",
  };
}

export function createDefaultTimeline(): TimelineBlockData {
  return {
    title: "Geschiedenis",
    milestones: [
      createTimelineMilestone({ year: "2018", title: "Opgericht", body: "Korte toelichting" }),
      createTimelineMilestone({ year: "2022", title: "Uitbreiding", body: "" }),
    ],
  };
}

export function normalizeTimeline(value: unknown): TimelineBlockData {
  const rec = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const raw = Array.isArray(rec.milestones) ? rec.milestones : [];
  const milestones = raw.map((m) => {
    if (!m || typeof m !== "object") return createTimelineMilestone();
    const row = m as Record<string, unknown>;
    return {
      id: typeof row.id === "string" && row.id ? row.id : createItemId("tl"),
      year: typeof row.year === "string" ? row.year : undefined,
      title: typeof row.title === "string" ? row.title : "",
      body: typeof row.body === "string" ? row.body : undefined,
    };
  });
  const parsed = timelineBlockSchema.safeParse({
    title: typeof rec.title === "string" ? rec.title : "Tijdlijn",
    milestones,
  });
  return parsed.success ? parsed.data : createDefaultTimeline();
}

export const timelineDefinition: CmsBlockDataDefinition<"timeline", TimelineBlockData> = {
  type: "timeline",
  label: "Tijdlijn",
  category: "Structure",
  description: "Eenvoudige mijlpalen met jaar, titel en tekst.",
  dataVersion: 1,
  schema: timelineBlockSchema,
  createDefault: createDefaultTimeline,
  normalize: normalizeTimeline,
  capabilities: { duplicable: true, removable: true, publishable: true },
};
