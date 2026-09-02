import { describe, expect, it, vi, beforeEach } from "vitest";

import { builtinCmsSeedPages } from "./seeds";
import { publishedPagesFromStore } from "./load-published-form-scopes";
import {
  __resetPublishedCmsReadCacheForTests,
  getCachedPublishedCmsBundle,
} from "./published-read-cache";
import type { CmsStore } from "./types";

describe("published form scope page loading", () => {
  it("prefers listActivePublishedRevisions when available", async () => {
    const payload = builtinCmsSeedPages()[0]!;
    const listActivePublishedRevisions = vi.fn(async () => [{ payload }, { payload }]);
    const getActivePublishedRevision = vi.fn();

    const pages = await publishedPagesFromStore({
      seedBuiltinsIfEmpty: vi.fn(async () => undefined),
      listPages: vi.fn(async () => [{ id: "a" }, { id: "b" }]),
      getActivePublishedRevision,
      listActivePublishedRevisions,
    });

    expect(pages).toHaveLength(2);
    expect(listActivePublishedRevisions).toHaveBeenCalledTimes(1);
    expect(getActivePublishedRevision).not.toHaveBeenCalled();
  });

  it("falls back to per-page revision reads", async () => {
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

describe("published read cache", () => {
  beforeEach(() => {
    __resetPublishedCmsReadCacheForTests();
  });

  it("single-flights and caches bundle loads", async () => {
    let loads = 0;
    const store = {
      getSite: vi.fn(async () => {
        loads += 1;
        return {
          id: "site",
          slug: "main",
          origin: "https://www.mccoy.nl",
          configVersion: 1,
          createdAt: "",
          updatedAt: "",
        };
      }),
      listActivePublishedRevisions: vi.fn(async () => [
        {
          id: "r1",
          siteId: "site",
          pageId: "page_home",
          revisionNumber: 1,
          status: "published" as const,
          payload: builtinCmsSeedPages()[0]!,
          createdAt: "",
          createdBy: null,
          publishedAt: "",
        },
      ]),
      listPublishedLocaleStates: vi.fn(async () => []),
    } as unknown as CmsStore;

    const [a, b] = await Promise.all([
      getCachedPublishedCmsBundle(store),
      getCachedPublishedCmsBundle(store),
    ]);
    const c = await getCachedPublishedCmsBundle(store);

    expect(a.pages).toHaveLength(1);
    expect(b.pages).toHaveLength(1);
    expect(c.pages).toHaveLength(1);
    expect(loads).toBe(1);
    expect(store.listActivePublishedRevisions).toHaveBeenCalledTimes(1);
  });
});
