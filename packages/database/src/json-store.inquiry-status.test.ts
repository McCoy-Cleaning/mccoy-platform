import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("setWebsiteRequestInquiryStatus (json store)", () => {
  let dataDir: string;
  let previousDataDir: string | undefined;

  beforeEach(async () => {
    vi.resetModules();
    dataDir = await mkdtemp(path.join(os.tmpdir(), "mccoy-wr-status-"));
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

  it("creates a request with inquiryStatus 'new' and persists a status change", async () => {
    const { createWebsiteRequest, getWebsiteRequest, setWebsiteRequestInquiryStatus, listWebsiteRequests } =
      await import("./json-store");

    const created = await createWebsiteRequest({
      kind: "inquiry",
      fields: { name: "Ada", email: "a@example.com", message: "hi" },
      attachments: [],
    });

    expect(created.inquiryStatus).toBe("new");

    const updated = await setWebsiteRequestInquiryStatus(created.id, "in_progress");
    expect(updated?.inquiryStatus).toBe("in_progress");

    const reloaded = await getWebsiteRequest(created.id);
    expect(reloaded?.inquiryStatus).toBe("in_progress");

    const [summary] = await listWebsiteRequests();
    expect(summary.inquiryStatus).toBe("in_progress");
  });

  it("returns null for an unknown id and does not throw", async () => {
    const { setWebsiteRequestInquiryStatus } = await import("./json-store");
    const result = await setWebsiteRequestInquiryStatus(
      "00000000-0000-4000-8000-000000000000",
      "invoiced",
    );
    expect(result).toBeNull();
  });

  it("can move through new -> in_progress -> invoiced -> new", async () => {
    const { createWebsiteRequest, getWebsiteRequest, setWebsiteRequestInquiryStatus } =
      await import("./json-store");

    const created = await createWebsiteRequest({
      kind: "furniture_cleaning",
      fields: { name: "Bo", email: "b@example.com" },
      attachments: [],
    });

    await setWebsiteRequestInquiryStatus(created.id, "in_progress");
    expect((await getWebsiteRequest(created.id))?.inquiryStatus).toBe("in_progress");

    await setWebsiteRequestInquiryStatus(created.id, "invoiced");
    expect((await getWebsiteRequest(created.id))?.inquiryStatus).toBe("invoiced");

    await setWebsiteRequestInquiryStatus(created.id, "new");
    expect((await getWebsiteRequest(created.id))?.inquiryStatus).toBe("new");
  });
});
