import { describe, expect, it } from "vitest";
import {
  createDefaultRoadmap,
  createRoadmapMilestone,
  createTextListItem,
  normalizeRoadmap,
  parseBlockData,
  validatePageBlocksForPublish,
} from "../blocks";

describe("roadmap", () => {
  it("keeps distinct ids when bullet text matches", () => {
    const a = createTextListItem("zelfde");
    const b = createTextListItem("zelfde");
    expect(a.id).not.toBe(b.id);
    const data = createDefaultRoadmap();
    data.milestones[0]!.bullets = [a, b];
    const parsed = parseBlockData("roadmap", data);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const bullets = (parsed.data as ReturnType<typeof createDefaultRoadmap>).milestones[0]!.bullets;
    expect(bullets[0]!.id).toBe(a.id);
    expect(bullets[1]!.id).toBe(b.id);
  });

  it("removing one of two duplicate-text bullets keeps the other", () => {
    const a = createTextListItem("zelfde");
    const b = createTextListItem("zelfde");
    const data = createDefaultRoadmap();
    data.milestones[0]!.bullets = [a, b];
    data.milestones[0]!.bullets = data.milestones[0]!.bullets.filter((item) => item.id !== a.id);
    expect(data.milestones[0]!.bullets).toHaveLength(1);
    expect(data.milestones[0]!.bullets[0]!.id).toBe(b.id);
    expect(data.milestones[0]!.bullets[0]!.text).toBe("zelfde");
    const parsed = parseBlockData("roadmap", data);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const bullets = (parsed.data as ReturnType<typeof createDefaultRoadmap>).milestones[0]!.bullets;
    expect(bullets).toHaveLength(1);
    expect(bullets[0]!.id).toBe(b.id);
  });

  it("normalizes legacy string bullets", () => {
    const normalized = normalizeRoadmap({
      title: "R",
      milestones: [{ title: "M", bullets: ["een", "twee"] }],
    });
    expect(normalized.milestones[0]!.bullets).toHaveLength(2);
    expect(normalized.milestones[0]!.bullets[0]!.text).toBe("een");
    expect(normalized.milestones[0]!.bullets[0]!.id).toBeTruthy();
  });

  it("reorder milestones preserves content", () => {
    const m1 = createRoadmapMilestone({ title: "A", bullets: [createTextListItem("x")] });
    const m2 = createRoadmapMilestone({ title: "B", bullets: [createTextListItem("y")] });
    const data = { title: "R", milestones: [m1, m2] };
    const reordered = { ...data, milestones: [m2, m1] };
    expect(reordered.milestones[0]!.title).toBe("B");
    expect(reordered.milestones[0]!.bullets[0]!.text).toBe("y");
  });

  it("optional year is allowed; empty milestone title fails publish", () => {
    const withYearOmitted = createDefaultRoadmap();
    withYearOmitted.milestones[0]!.year = undefined;
    withYearOmitted.milestones[0]!.title = "Met titel";
    expect(parseBlockData("roadmap", withYearOmitted).ok).toBe(true);
    expect(
      validatePageBlocksForPublish([
        { id: "r1", type: "roadmap", data: withYearOmitted as unknown as Record<string, unknown> },
      ]).ok,
    ).toBe(true);

    const emptyTitle = createDefaultRoadmap();
    emptyTitle.milestones[0]!.title = "";
    emptyTitle.milestones[0]!.year = "2026";
    expect(parseBlockData("roadmap", emptyTitle).ok).toBe(true);
    const publish = validatePageBlocksForPublish([
      { id: "r2", type: "roadmap", data: emptyTitle as unknown as Record<string, unknown> },
    ]);
    expect(publish.ok).toBe(false);
  });
});
