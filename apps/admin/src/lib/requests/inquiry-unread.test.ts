import { describe, expect, it } from "vitest";
import type { FormInboxMessageSummary } from "@mccoy/email/contracts";
import {
  applyRequestNotificationUnreadState,
  websiteRequestIdsFromInboxItems,
} from "./inquiry-unread";

function summary(id: string, unread = true): FormInboxMessageSummary {
  return {
    id,
    uid: 1,
    kind: "inquiry",
    subject: "Aanvraag",
    from: "customer@example.com",
    to: "info@mccoy.nl",
    date: "2026-09-21T10:00:00.000Z",
    snippet: "",
    unread,
    submitterName: "Customer",
    submitterEmail: "customer@example.com",
    requestNumber: "WR-2026-00001",
    scopeKey: null,
    scopeLabel: null,
  };
}

describe("inquiry notification unread state", () => {
  it("uses per-user notification state for request rows and preserves provider rows", () => {
    const requestA = "11111111-1111-4111-8111-111111111111";
    const requestB = "22222222-2222-4222-8222-222222222222";
    const items = [
      summary(`req:website-requests:${requestA}`),
      summary(`req:website-requests:${requestB}`),
      summary("graph:info%40mccoy.nl:graph-message", true),
    ];

    const result = applyRequestNotificationUnreadState(items, new Set([requestB]));

    expect(result.map((item) => item.unread)).toEqual([false, true, true]);
  });

  it("collects unique durable request ids only", () => {
    const requestId = "11111111-1111-4111-8111-111111111111";
    expect(
      websiteRequestIdsFromInboxItems([
        summary(`req:website-requests:${requestId}`),
        summary(`req:website-requests:${requestId}`),
        summary("graph:info%40mccoy.nl:graph-message"),
      ]),
    ).toEqual([requestId]);
  });
});
