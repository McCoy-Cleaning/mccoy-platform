import { describe, expect, it } from "vitest";
import {
  ALL_BLOCK_TYPES,
  blockDataRegistry,
  createDefaultBlock,
  PUBLISHABLE_BLOCK_TYPES,
  UNPUBLISHABLE_BLOCK_TYPES,
} from "./registry";
import { PUBLISH_VALIDATION_CODES } from "./validation-codes";
import { validatePageBlocksForPublish } from "./validate";

describe("validatePageBlocksForPublish", () => {
  it.each(ALL_BLOCK_TYPES)("default of %s has intended publish result", (type) => {
    const result = validatePageBlocksForPublish([createDefaultBlock(type)]);
    const publishable = blockDataRegistry[type].capabilities.publishable;
    expect(publishable).toBe(!UNPUBLISHABLE_BLOCK_TYPES.includes(type));
    // Media defaults may still fail content rules (e.g. beforeAfter missing images, empty gallery).
    if (!publishable) {
      expect(result.ok, type).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === PUBLISH_VALIDATION_CODES.BLOCK_UNPUBLISHABLE)).toBe(
          true,
        );
        expect(result.errors.some((e) => e.blockType === type)).toBe(true);
      }
      return;
    }
    if (type === "beforeAfter") {
      expect(result.ok, type).toBe(false);
      if (!result.ok) {
        expect(
          result.errors.some((e) => e.code === PUBLISH_VALIDATION_CODES.BEFORE_AFTER_IMAGE_MISSING),
        ).toBe(true);
      }
      return;
    }
    if (type === "gallery") {
      expect(result.ok, type).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === PUBLISH_VALIDATION_CODES.GALLERY_EMPTY)).toBe(
          true,
        );
      }
      return;
    }
    expect(result.ok, type).toBe(true);
  });

  it("rejects unpublishable blocks with codes when any remain", () => {
    for (const type of UNPUBLISHABLE_BLOCK_TYPES) {
      const result = validatePageBlocksForPublish([createDefaultBlock(type)]);
      expect(result.ok, type).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.code === PUBLISH_VALIDATION_CODES.BLOCK_UNPUBLISHABLE)).toBe(
          true,
        );
        expect(result.errors.some((e) => e.blockType === type)).toBe(true);
      }
    }
  });

  it("allows publishing newsletter, contactForm, and popup defaults", () => {
    for (const type of ["newsletter", "contactForm", "popup"] as const) {
      const result = validatePageBlocksForPublish([createDefaultBlock(type)]);
      expect(result.ok, type).toBe(true);
    }
  });

  it("rejects hero with empty title on publish", () => {
    const block = createDefaultBlock("hero");
    const result = validatePageBlocksForPublish([
      { ...block, data: { ...block.data, title: "   " } },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === PUBLISH_VALIDATION_CODES.HERO_TITLE_REQUIRED)).toBe(
        true,
      );
      expect(result.errors.some((e) => e.blockLabel === "Hero" && e.path.includes("title"))).toBe(
        true,
      );
    }
  });

  it("rejects newsletter without title or button label", () => {
    const block = createDefaultBlock("newsletter");
    const result = validatePageBlocksForPublish([
      { ...block, data: { ...block.data, title: "  ", buttonLabel: "" } },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === PUBLISH_VALIDATION_CODES.NEWSLETTER_TITLE_REQUIRED)).toBe(
        true,
      );
      expect(
        result.errors.some((e) => e.code === PUBLISH_VALIDATION_CODES.NEWSLETTER_BUTTON_REQUIRED),
      ).toBe(true);
    }
  });

  it("allows contactForm without custom labeled fields", () => {
    const block = createDefaultBlock("contactForm");
    const result = validatePageBlocksForPublish([
      {
        ...block,
        data: {
          ...block.data,
          fields: [
            { id: "f1", label: "   ", type: "text" },
            { id: "f2", label: "  ", type: "textarea" },
          ],
        },
      },
    ]);
    expect(result.ok).toBe(true);
  });

  it("allows contactForm without name/email field types in CMS fields", () => {
    const block = createDefaultBlock("contactForm");
    const result = validatePageBlocksForPublish([
      {
        ...block,
        data: {
          ...block.data,
          fields: [
            { id: "f1", label: "Label 1", type: "text" },
            { id: "f2", label: "Label 2", type: "textarea" },
            { id: "f3", label: "Label 3", type: "phone" },
          ],
        },
      },
    ]);
    expect(result.ok).toBe(true);
  });

  it("rejects a page that mixes publishable and invalid newsletter", () => {
    const newsletter = createDefaultBlock("newsletter");
    const result = validatePageBlocksForPublish([
      createDefaultBlock("hero"),
      { ...newsletter, data: { ...newsletter.data, title: "" } },
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.blockType === "newsletter")).toBe(true);
    }
  });

  it("allows publishable defaults (hero, roadmap, plans, latestPosts)", () => {
    for (const type of ["hero", "roadmap", "plans", "latestPosts"] as const) {
      const result = validatePageBlocksForPublish([createDefaultBlock(type)]);
      expect(result.ok, type).toBe(true);
    }
  });

  it("rejects roadmap with empty milestone title on publish", () => {
    const block = createDefaultBlock("roadmap");
    const data = structuredClone(block.data) as {
      title: string;
      milestones: Array<{ id: string; title: string; year?: string; bullets: unknown[] }>;
    };
    data.milestones[0]!.title = "   ";
    data.milestones[0]!.year = undefined;
    const result = validatePageBlocksForPublish([{ ...block, data }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.code === PUBLISH_VALIDATION_CODES.ROADMAP_MILESTONE_TITLE_REQUIRED),
      ).toBe(true);
    }
  });

  it("allows roadmap with optional empty year when title is set", () => {
    const block = createDefaultBlock("roadmap");
    const data = structuredClone(block.data) as {
      title: string;
      milestones: Array<{ id: string; title: string; year?: string; bullets: unknown[] }>;
    };
    data.milestones[0]!.year = "";
    data.milestones[0]!.title = "Zonder jaar";
    const result = validatePageBlocksForPublish([{ ...block, data }]);
    expect(result.ok).toBe(true);
  });

  it("rejects plans with invalid CTA on publish", () => {
    const block = createDefaultBlock("plans");
    const data = structuredClone(block.data) as {
      title: string;
      features: Array<{ id: string; label: string }>;
      plans: Array<Record<string, unknown>>;
    };
    data.plans[0]!.cta = { label: "" };
    const result = validatePageBlocksForPublish([{ ...block, data }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === PUBLISH_VALIDATION_CODES.PLANS_CTA_INVALID)).toBe(
        true,
      );
    }
  });

  it("rejects video without title or with unsafe URL", () => {
    const block = createDefaultBlock("video");
    const data = { ...(block.data as object), title: "", videoUrl: "javascript:alert(1)" };
    const result = validatePageBlocksForPublish([{ ...block, data }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.code === PUBLISH_VALIDATION_CODES.VIDEO_TITLE_REQUIRED)).toBe(
        true,
      );
      expect(result.errors.some((e) => e.code === PUBLISH_VALIDATION_CODES.VIDEO_URL_INVALID)).toBe(
        true,
      );
    }
  });

  it("PUBLISHABLE_BLOCK_TYPES includes newsletter, contactForm, and popup", () => {
    expect(PUBLISHABLE_BLOCK_TYPES).toContain("newsletter");
    expect(PUBLISHABLE_BLOCK_TYPES).toContain("contactForm");
    expect(PUBLISHABLE_BLOCK_TYPES).toContain("popup");
    expect(UNPUBLISHABLE_BLOCK_TYPES).toEqual([]);
  });
});
