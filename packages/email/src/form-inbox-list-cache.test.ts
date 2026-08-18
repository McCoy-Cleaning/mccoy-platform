import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearInboxListSnapshotCache,
  getOrLoadInboxListSnapshot,
  graphListBudgetMs,
  peekInboxListSnapshotCache,
} from "./form-inbox-list-cache";

afterEach(() => {
  clearInboxListSnapshotCache();
  vi.useRealTimers();
});

describe("inbox list snapshot cache", () => {
  it("keeps initial paint DB-first while preserving a longer explicit mailbox refresh", () => {
    expect(graphListBudgetMs(false)).toBeLessThan(500);
    expect(graphListBudgetMs(true)).toBeGreaterThanOrEqual(4_000);
  });

  it("reuses an in-flight load instead of starting a second Graph fetch", async () => {
    let resolveLoad: ((value: string) => void) | undefined;
    const load = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    const first = getOrLoadInboxListSnapshot(load);
    const second = getOrLoadInboxListSnapshot(load);
    expect(load).toHaveBeenCalledTimes(1);

    resolveLoad?.("snapshot");
    await expect(first).resolves.toBe("snapshot");
    await expect(second).resolves.toBe("snapshot");
  });

  it("returns the cached snapshot within TTL so category filters skip Graph", async () => {
    const load = vi.fn(async () => ({ items: [1, 2] }));
    const first = await getOrLoadInboxListSnapshot(load, { ttlMs: 20_000 });
    const second = await getOrLoadInboxListSnapshot(load, { ttlMs: 20_000 });
    expect(load).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(peekInboxListSnapshotCache("default")).toEqual({ items: [1, 2] });
  });

  it("bypasses cache when fresh is requested (Vernieuwen)", async () => {
    const load = vi.fn(async () => Math.random());
    await getOrLoadInboxListSnapshot(load, { ttlMs: 20_000 });
    await getOrLoadInboxListSnapshot(load, { ttlMs: 20_000, fresh: true });
    expect(load).toHaveBeenCalledTimes(2);
  });
});
