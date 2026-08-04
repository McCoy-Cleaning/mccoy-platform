import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("clearOrphanWebsiteRequestScopes (json store)", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;

  beforeEach(async () => {
    vi.resetModules();
    dataDir = await mkdtemp(path.join(os.tmpdir(), "mccoy-wr-orphan-"));
    previousDataDir = process.env.MCCOY_DATA_DIR;
    process.env.MCCOY_DATA_DIR = dataDir;
    // Avoid picking up a configured Supabase service client in local envs.
    process.env.SUPABASE_SECRET_KEY = "";
    await mkdir(dataDir, { recursive: true });
  });

  afterEach(async () => {
    if (previousDataDir === undefined) {
      delete process.env.MCCOY_DATA_DIR;
    } else {
      process.env.MCCOY_DATA_DIR = previousDataDir;
    }
    await rm(dataDir, { recursive: true, force: true });
  });

  it("clears scope on requests whose key is no longer active", async () => {
    const { createWebsiteRequest, clearOrphanWebsiteRequestScopes, getWebsiteRequest } =
      await import("./json-store");

    const kept = await createWebsiteRequest({
      kind: "inquiry",
      fields: { name: "A", email: "a@example.com", message: "hi" },
      attachments: [],
      scopeKey: "amsterdam",
      scopeLabel: "Amsterdam",
    });
    const orphan = await createWebsiteRequest({
      kind: "inquiry",
      fields: { name: "B", email: "b@example.com", message: "hi" },
      attachments: [],
      scopeKey: "questions",
      scopeLabel: "questions",
    });

    const result = await clearOrphanWebsiteRequestScopes(["amsterdam"]);
    expect(result.cleared).toBe(1);

    const keptRow = await getWebsiteRequest(kept.id);
    const orphanRow = await getWebsiteRequest(orphan.id);
    expect(keptRow?.scopeKey).toBe("amsterdam");
    expect(keptRow?.scopeLabel).toBe("Amsterdam");
    expect(orphanRow?.scopeKey).toBeNull();
    expect(orphanRow?.scopeLabel).toBeNull();
    expect(orphanRow?.kind).toBe("inquiry");
  });

  it("clears every scoped row when no published scopes remain", async () => {
    const { createWebsiteRequest, clearOrphanWebsiteRequestScopes, getWebsiteRequest } =
      await import("./json-store");

    const row = await createWebsiteRequest({
      kind: "inquiry",
      fields: { name: "C", email: "c@example.com", message: "hi" },
      attachments: [],
      scopeKey: "test",
      scopeLabel: "test",
    });

    const result = await clearOrphanWebsiteRequestScopes([]);
    expect(result.cleared).toBe(1);
    const updated = await getWebsiteRequest(row.id);
    expect(updated?.scopeKey).toBeNull();
    expect(updated?.kind).toBe("inquiry");
  });
});
