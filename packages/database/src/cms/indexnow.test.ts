import { describe, expect, it, vi } from "vitest";
import {
  notifyIndexNowForPublishEvent,
  submitIndexNowUrls,
  validateIndexNowUrl,
  urlsFromPublishEvent,
} from "./indexnow";
import type { CmsPagePublishedEvent } from "@mccoy/cms-schema";

function event(paths: string[]): CmsPagePublishedEvent {
  return {
    eventId: "evt_1",
    pageId: "page_contact",
    revisionId: "rev_1",
    siteId: "site_default",
    publishedLocales: ["nl"],
    changedPaths: paths,
    publishedAt: "2026-08-08T00:00:00Z",
  } as unknown as CmsPagePublishedEvent;
}

describe("validateIndexNowUrl", () => {
  it("accepts only https www.mccoy.nl public paths", () => {
    expect(validateIndexNowUrl("https://www.mccoy.nl/contact")).toBe(
      "https://www.mccoy.nl/contact",
    );
    expect(validateIndexNowUrl("http://www.mccoy.nl/contact")).toBeNull();
    expect(validateIndexNowUrl("https://mccoy.nl/contact")).toBeNull();
    expect(validateIndexNowUrl("https://localhost/contact")).toBeNull();
    expect(validateIndexNowUrl("https://foo.vercel.app/contact")).toBeNull();
    expect(validateIndexNowUrl("https://www.mccoy.nl/admin")).toBeNull();
    expect(validateIndexNowUrl("https://www.mccoy.nl/cms-preview")).toBeNull();
  });
});

describe("submitIndexNowUrls", () => {
  it("dedupes and batches validated urls", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    const result = await submitIndexNowUrls(
      [
        "https://www.mccoy.nl/contact",
        "https://www.mccoy.nl/contact",
        "https://localhost/x",
        "/about",
      ],
      { fetchImpl, key: "testkey123" },
    );
    expect(result.ok).toBe(true);
    expect(result.submitted).toEqual(["https://www.mccoy.nl/contact"]);
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("publish notify stays ok when IndexNow throws (fail-open)", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("network down");
    });
    const result = await notifyIndexNowForPublishEvent(event(["/contact"]), {
      fetchImpl,
      key: "testkey123",
      force: true,
    });
    expect(result.ok).toBe(false);
    // Caller (outbox) must not treat this as publish rollback — function did not throw.
  });
});

describe("urlsFromPublishEvent", () => {
  it("builds absolute www urls from changed paths", () => {
    expect(urlsFromPublishEvent(event(["/services", "https://www.mccoy.nl/about"]))).toEqual([
      "https://www.mccoy.nl/services",
      "https://www.mccoy.nl/about",
    ]);
  });
});
