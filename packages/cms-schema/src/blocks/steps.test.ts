import { describe, expect, it } from "vitest";
import { localImage } from "../content";
import {
  createDefaultBlock,
  getBlockDataDefinition,
  parseBlockData,
  type StepsBlockData,
} from "./index";

describe("steps block normalize", () => {
  const def = getBlockDataDefinition("steps");

  it("createDefault has title and steps without images", () => {
    const block = createDefaultBlock("steps");
    const data = block.data as StepsBlockData;
    expect(data.title).toBeTruthy();
    expect(data.steps.length).toBeGreaterThanOrEqual(2);
    for (const step of data.steps) {
      expect(step.id).toBeTruthy();
      expect(step.image).toBeUndefined();
    }
  });

  it("migrates legacy steps without image fields", () => {
    const normalized = def.normalize({
      title: "Hoe het werkt",
      steps: [
        { id: "step_1", title: "Aanvraag", body: "Offerte aanvragen" },
        { title: "Uitvoering", body: "Wij gaan aan de slag" },
      ],
    }) as StepsBlockData;

    expect(normalized.title).toBe("Hoe het werkt");
    expect(normalized.steps).toHaveLength(2);
    expect(normalized.steps[0]).toMatchObject({
      id: "step_1",
      title: "Aanvraag",
      body: "Offerte aanvragen",
    });
    expect(normalized.steps[0]?.image).toBeUndefined();
    expect(normalized.steps[1]?.id).toBeTruthy();
    expect(normalized.steps[1]?.image).toBeUndefined();

    const parsed = parseBlockData("steps", normalized);
    expect(parsed.ok).toBe(true);
  });

  it("preserves optional per-step images and alt", () => {
    const image = localImage("/images/cms/work-regular.jpg", "Team aan het werk");
    const normalized = def.normalize({
      title: "Proces",
      steps: [
        {
          id: "step_a",
          title: "Stap A",
          body: "Tekst",
          image,
        },
        {
          id: "step_b",
          title: "Stap B",
          body: "Zonder foto",
        },
      ],
    }) as StepsBlockData;

    expect(normalized.steps[0]?.image).toMatchObject({
      src: "/images/cms/work-regular.jpg",
      alt: "Team aan het werk",
    });
    expect(normalized.steps[1]?.image).toBeUndefined();

    const parsed = parseBlockData("steps", normalized);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const data = parsed.data as StepsBlockData;
      expect(data.steps[0]?.image?.alt).toBe("Team aan het werk");
    }
  });

  it("accepts legacy string image urls on steps", () => {
    const normalized = def.normalize({
      title: "Proces",
      steps: [{ id: "s1", title: "One", body: "Body", image: "/images/legacy.jpg" }],
    }) as StepsBlockData;

    expect(normalized.steps[0]?.image?.src).toBe("/images/legacy.jpg");
    expect(parseBlockData("steps", normalized).ok).toBe(true);
  });
});
