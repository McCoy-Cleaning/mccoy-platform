import { describe, expect, it } from "vitest";
import type { WebsiteRequestSummary } from "@mccoy/domain";

import { mapOverviewRecentRequests } from "./admin-overview.recent";

function row(
  partial: Partial<WebsiteRequestSummary> & Pick<WebsiteRequestSummary, "id" | "createdAt">,
): WebsiteRequestSummary {
  return {
    number: "A-1",
    kind: "inquiry",
    status: "new",
    submitterName: "Alex",
    submitterEmail: "alex@example.com",
    subject: "Vraag",
    attachmentCount: 0,
    replyCount: 0,
    formId: null,
    sourcePageId: null,
    scopeKey: null,
    scopeLabel: null,
    updatedAt: partial.createdAt,
    lastRepliedAt: null,
    ...partial,
  };
}

describe("mapOverviewRecentRequests", () => {
  it("keeps the four most recent rows and encodes inbox ids", () => {
    const mapped = mapOverviewRecentRequests([
      row({ id: "11111111-1111-4111-8111-111111111111", createdAt: "2026-08-01T10:00:00.000Z" }),
      row({
        id: "22222222-2222-4222-8222-222222222222",
        createdAt: "2026-08-08T10:00:00.000Z",
        kind: "glass_washing",
        submitterName: "Sam",
        scopeLabel: "Glasbewassing",
      }),
      row({ id: "33333333-3333-4333-8333-333333333333", createdAt: "2026-08-05T10:00:00.000Z" }),
      row({ id: "44444444-4444-4444-8444-444444444444", createdAt: "2026-08-03T10:00:00.000Z" }),
      row({ id: "55555555-5555-4555-8555-555555555555", createdAt: "2026-08-07T10:00:00.000Z" }),
    ]);

    expect(mapped).toHaveLength(4);
    expect(mapped.map((item) => item.id)).toEqual([
      "req:website-requests:22222222-2222-4222-8222-222222222222",
      "req:website-requests:55555555-5555-4555-8555-555555555555",
      "req:website-requests:33333333-3333-4333-8333-333333333333",
      "req:website-requests:44444444-4444-4444-8444-444444444444",
    ]);
    expect(mapped[0]).toMatchObject({
      text: "Sam — Glasbewassing",
      tag: "Glasbewassing",
    });
  });

  it("falls back to kind label when name and scope are empty", () => {
    const mapped = mapOverviewRecentRequests([
      row({
        id: "11111111-1111-4111-8111-111111111111",
        createdAt: "2026-08-08T10:00:00.000Z",
        kind: "job_application",
        submitterName: "  ",
        scopeLabel: null,
      }),
    ]);
    expect(mapped[0]?.text).toBe("Nieuwe aanvraag — Sollicitatie");
    expect(mapped[0]?.tag).toBe("Sollicitatie");
  });
});
