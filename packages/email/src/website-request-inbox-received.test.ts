import { describe, expect, it } from "vitest";

import { websiteRequestSummaryToInboxSummary } from "./website-request-inbox";
import type { WebsiteRequestSummary } from "@mccoy/domain";

function baseSummary(overrides: Partial<WebsiteRequestSummary>): WebsiteRequestSummary {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    number: "WR-2026-00001",
    kind: "inquiry",
    status: "new",
    inquiryStatus: "new",
    submitterName: "Ada",
    submitterEmail: "a@example.com",
    subject: "Hallo",
    attachmentCount: 0,
    replyCount: 0,
    formId: null,
    sourcePageId: null,
    scopeKey: null,
    scopeLabel: null,
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-08-01T10:00:00.000Z",
    lastRepliedAt: null,
    ...overrides,
  };
}

describe("websiteRequestSummaryToInboxSummary — received time", () => {
  it("uses createdAt as the received date, not updatedAt", () => {
    const summary = websiteRequestSummaryToInboxSummary(
      baseSummary({
        createdAt: "2026-08-01T10:00:00.000Z",
        // Simulate the DB trigger bumping updated_at when staff opened the
        // inquiry and the Graph sync flipped status to "open".
        updatedAt: "2026-08-19T09:30:00.000Z",
        status: "open",
      }),
    );

    expect(summary.date).toBe("2026-08-01T10:00:00.000Z");
  });

  it("stays stable across repeated updated_at bumps", () => {
    const first = websiteRequestSummaryToInboxSummary(
      baseSummary({ updatedAt: "2026-08-02T00:00:00.000Z" }),
    );
    const second = websiteRequestSummaryToInboxSummary(
      baseSummary({ updatedAt: "2026-09-15T18:00:00.000Z", status: "replied" }),
    );

    expect(first.date).toBe("2026-08-01T10:00:00.000Z");
    expect(second.date).toBe("2026-08-01T10:00:00.000Z");
  });

  it("carries the inquiry workflow status through to the inbox summary", () => {
    const nieuw = websiteRequestSummaryToInboxSummary(baseSummary({ inquiryStatus: "new" }));
    const inBehandeling = websiteRequestSummaryToInboxSummary(
      baseSummary({ inquiryStatus: "in_progress" }),
    );
    const gefactureerd = websiteRequestSummaryToInboxSummary(
      baseSummary({ inquiryStatus: "invoiced" }),
    );

    expect(nieuw.inquiryStatus).toBe("new");
    expect(inBehandeling.inquiryStatus).toBe("in_progress");
    expect(gefactureerd.inquiryStatus).toBe("invoiced");
  });

  it("preserves lifecycle status and uses updatedAt only as the activity sort key", () => {
    const reopened = websiteRequestSummaryToInboxSummary(
      baseSummary({
        status: "open",
        updatedAt: "2026-09-21T11:30:00.000Z",
      }),
    );
    const resolved = websiteRequestSummaryToInboxSummary(
      baseSummary({
        status: "closed",
        updatedAt: "2026-09-20T08:15:00.000Z",
      }),
    );

    expect(reopened.lifecycleStatus).toBe("open");
    expect(reopened.activityAt).toBe("2026-09-21T11:30:00.000Z");
    expect(reopened.date).toBe("2026-08-01T10:00:00.000Z");
    expect(resolved.lifecycleStatus).toBe("closed");
    expect(resolved.activityAt).toBe("2026-09-20T08:15:00.000Z");
  });
});
