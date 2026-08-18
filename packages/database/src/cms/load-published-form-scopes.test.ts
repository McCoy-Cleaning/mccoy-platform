import { describe, expect, it, vi } from "vitest";

import { builtinCmsSeedPages } from "./seeds";
import { publishedPagesFromStore } from "./load-published-form-scopes";

describe("published form scope page loading", () => {
  it("loads revisions concurrently in bounded batches", async () => {
    const payload = builtinCmsSeedPages()[0]!;
    let active = 0;
    let maxActive = 0;
    const getActivePublishedRevision = vi.fn(async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { payload };
    });

    const pages = await publishedPagesFromStore({
      seedBuiltinsIfEmpty: vi.fn(async () => undefined),
      listPages: vi.fn(async () =>
        Array.from({ length: 17 }, (_, index) => ({ id: `page-${index}` })),
      ),
      getActivePublishedRevision,
    });

    expect(pages).toHaveLength(17);
    expect(getActivePublishedRevision).toHaveBeenCalledTimes(17);
    expect(maxActive).toBe(8);
  });

  it("skips an unreadable revision without failing the complete facet list", async () => {
    const payload = builtinCmsSeedPages()[0]!;
    const pages = await publishedPagesFromStore({
      seedBuiltinsIfEmpty: vi.fn(async () => undefined),
      listPages: vi.fn(async () => [{ id: "good" }, { id: "broken" }]),
      getActivePublishedRevision: vi.fn(async (pageId) => {
        if (pageId === "broken") throw new Error("unreadable");
        return { payload };
      }),
    });

    expect(pages).toHaveLength(1);
  });
});
