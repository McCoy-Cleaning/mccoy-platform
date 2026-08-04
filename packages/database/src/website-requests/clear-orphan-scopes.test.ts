import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("clearOrphanWebsiteRequestScopes (json store)", () => {
  let tmpDir: string;
  let previousDataDir: string | undefined;

  beforeEach(async () => {
    tmpDir = await mkdtemp(path.join(os.tmpdir(), "mccoy-wr-orphan-"));
    previousDataDir = process.env.MCCOY_DATA_DIR;
    process.env.MCCOY_DATA_DIR = tmpDir;
    vi.resetModules();
  });

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.MCCOY_DATA_DIR;
    } else {
      process.env.MCCOY_DATA_DIR = previousDataDir;
    }
    await rm(tmpDir, { recursive: true, force: true });
    vi.resetModules();
  });

  it("clears scope_key/scope_label for keys not in the active set and preserves kind", async () => {
    const {
      createWebsiteRequest,
      clearOrphanWebsiteRequestScopes,
      listWebsiteRequests,
    } = await import("../json-store");

    const keep = await createWebsiteRequest({
      kind: "inquiry",
      fields: { name: "A", email: "a@example.com", message: "keep" },
      attachments: [],
      scopeKey: "questions",
      scopeLabel: "questions",
    });
    const drop = await createWebsiteRequest({
      kind: "inquiry",
      fields: { name: "B", email: "b@example.com", message: "drop" },
      attachments: [],
      scopeKey: "test",
      scopeLabel: "test",
    });

    const { cleared } = await clearOrphanWebsiteRequestScopes(["questions"]);
    expect(cleared).toBe(1);

    const rows = await listWebsiteRequests();
    const kept = rows.find((r) => r.id === keep.id);
    const dropped = rows.find((r) => r.id === drop.id);
    expect(kept?.scopeKey).toBe("questions");
    expect(kept?.scopeLabel).toBe("questions");
    expect(kept?.kind).toBe("inquiry");
    expect(dropped?.scopeKey).toBeNull();
    expect(dropped?.scopeLabel).toBeNull();
    expect(dropped?.kind).toBe("inquiry");
    expect(dropped?.number).toBe(drop.number);
  });

  it("clears every scoped row when the active set is empty", async () => {
    const { createWebsiteRequest, clearOrphanWebsiteRequestScopes, getWebsiteRequest } =
      await import("../json-store");

    const row = await createWebsiteRequest({
      kind: "inquiry",
      fields: { name: "C", email: "c@example.com", message: "x" },
      attachments: [],
      scopeKey: "gone",
      scopeLabel: "gone",
    });

    const { cleared } = await clearOrphanWebsiteRequestScopes([]);
    expect(cleared).toBe(1);
    const after = await getWebsiteRequest(row.id);
    expect(after?.scopeKey).toBeNull();
    expect(after?.scopeLabel).toBeNull();
    expect(after?.kind).toBe("inquiry");
    expect(after?.number).toBe(row.number);
  });
});
