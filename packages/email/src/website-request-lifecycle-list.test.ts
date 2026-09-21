import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RequestStatus, WebsiteRequestSummary } from "@mccoy/domain";

const listWebsiteRequests = vi.fn();

vi.mock("@mccoy/database/server", () => ({
  getWebsiteRequest: vi.fn(),
  listWebsiteRequests: (...args: unknown[]) => listWebsiteRequests(...args),
  setWebsiteRequestStatus: vi.fn(),
}));

import { listWebsiteRequestInboxSummaries } from "./website-request-inbox";

function row(status: RequestStatus, index: number): WebsiteRequestSummary {
  return {
    id: `11111111-1111-1111-1111-${String(index).padStart(12, "0")}`,
    number: `WR-2026-${String(index).padStart(5, "0")}`,
    kind: "inquiry",
    status,
    inquiryStatus: "new",
    submitterName: `Applicant ${index}`,
    submitterEmail: `applicant-${index}@example.com`,
    subject: "Contact",
    attachmentCount: 0,
    replyCount: 0,
    formId: null,
    sourcePageId: null,
    scopeKey: null,
    scopeLabel: null,
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: `2026-09-${String(index).padStart(2, "0")}T12:00:00.000Z`,
    lastRepliedAt: null,
  };
}

describe("website request lifecycle list views", () => {
  beforeEach(() => {
    listWebsiteRequests.mockResolvedValue([
      row("new", 1),
      row("open", 2),
      row("replied", 3),
      row("closed", 4),
      row("deleted", 5),
      row("spam", 6),
    ]);
  });

  it("keeps only actionable requests in Openstaand", async () => {
    const items = await listWebsiteRequestInboxSummaries({ lifecycle: "active" });
    expect(listWebsiteRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: ["new", "open", "replied"],
        orderBy: "updated_at",
      }),
    );
    expect(items.map((item) => item.lifecycleStatus)).toEqual(["open", "new", "replied"]);
  });

  it("keeps only closed requests in Afgerond", async () => {
    const items = await listWebsiteRequestInboxSummaries({ lifecycle: "resolved" });
    expect(listWebsiteRequests).toHaveBeenCalledWith(
      expect.objectContaining({
        statuses: ["closed"],
        orderBy: "updated_at",
      }),
    );
    expect(items.map((item) => item.lifecycleStatus)).toEqual(["closed"]);
  });
});
