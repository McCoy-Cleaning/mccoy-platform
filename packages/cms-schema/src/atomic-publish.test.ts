import { describe, expect, it } from "vitest";
import {
  createDefaultBlock,
  validatePublishableCmsPage,
  type CmsPage,
} from "@mccoy/cms-schema";

function minimalCustomPage(blocks: CmsPage["blocks"]): CmsPage {
  return {
    id: "page_test",
    kind: "custom",
    title: "Test",
    slug: "test",
    description: "",
    inNav: false,
    isCustom: true,
    isDraftOnly: false,
    version: 1,
    updatedAt: Date.now(),
    layoutVersion: 1,
    layout: blocks.map((b, i) => ({
      id: `layout_${i}`,
      kind: "block" as const,
      blockId: b.id,
    })),
    blocks,
  };
}

describe("atomic publish validation (validate-all-then-write gate)", () => {
  it("rejects invalid newsletter before any write would occur", () => {
    const newsletter = createDefaultBlock("newsletter");
    const page = minimalCustomPage([
      createDefaultBlock("hero"),
      { ...newsletter, data: { ...newsletter.data, title: "" } },
    ]);
    const result = validatePublishableCmsPage(page);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === "NEWSLETTER_TITLE_REQUIRED")).toBe(true);
    }
  });

  it("accepts a page of publishable defaults including conversion blocks", () => {
    const page = minimalCustomPage([
      createDefaultBlock("hero"),
      createDefaultBlock("cta"),
      createDefaultBlock("newsletter"),
      createDefaultBlock("contactForm"),
      createDefaultBlock("popup"),
    ]);
    const result = validatePublishableCmsPage(page);
    expect(result.ok).toBe(true);
  });
});
