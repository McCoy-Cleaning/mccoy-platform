import { describe, expect, it } from "vitest";
import {
  buildConversationReceivedFilter,
  buildConversationSentFilter,
  buildReceivedDateWindowFilter,
  escapeODataString,
  messageBelongsToWebsiteRequest,
} from "./graph-odata-filters";

describe("graph OData conversation filters", () => {
  it("puts receivedDateTime before conversationId for $orderby compatibility", () => {
    const filter = buildConversationReceivedFilter("AAQkADkwNWI=");
    expect(filter.startsWith("receivedDateTime ge ")).toBe(true);
    expect(filter).toContain(" and conversationId eq 'AAQkADkwNWI='");
    // conversationId must not lead — that triggers InefficientFilter with orderby.
    expect(filter.startsWith("conversationId")).toBe(false);
  });

  it("puts sentDateTime before conversationId for Sent Items lookups", () => {
    const filter = buildConversationSentFilter(
      "conv-1",
      "2026-08-06T12:00:00.000Z",
    );
    expect(filter).toBe(
      "sentDateTime ge 2026-08-06T12:00:00.000Z and conversationId eq 'conv-1'",
    );
  });

  it("builds a receivedDateTime window without contains() or $search", () => {
    expect(
      buildReceivedDateWindowFilter(
        "2026-01-01T10:00:00.000Z",
        "2026-01-05T10:00:00.000Z",
      ),
    ).toBe(
      "receivedDateTime ge 2026-01-01T10:00:00.000Z and receivedDateTime le 2026-01-05T10:00:00.000Z",
    );
    expect(buildReceivedDateWindowFilter("2026-01-01T10:00:00.000Z")).toBe(
      "receivedDateTime ge 2026-01-01T10:00:00.000Z",
    );
  });

  it("escapes single quotes in conversation ids", () => {
    expect(escapeODataString("a'b")).toBe("a''b");
    expect(buildConversationReceivedFilter("id'x")).toContain(
      "conversationId eq 'id''x'",
    );
  });
});

describe("messageBelongsToWebsiteRequest", () => {
  it("matches submitter reply-shaped mail that cites the WR number", () => {
    expect(
      messageBelongsToWebsiteRequest({
        conversationId: null,
        knownConversationIds: new Set(),
        subject: "AW: Algemene aanvraag (WR-2026-00019)",
        bodyPreview: "hi",
        fromAddress: "oana@example.com",
        submitterEmail: "oana@example.com",
        mailbox: "info@mccoy.nl",
        requestNumber: "WR-2026-00019",
        isReplyOrForward: true,
        isMcCoySender: false,
      }),
    ).toBe(true);
  });

  it("does not match WR number alone from an unrelated sender", () => {
    expect(
      messageBelongsToWebsiteRequest({
        conversationId: null,
        knownConversationIds: new Set(),
        subject: "AW: something (WR-2026-00019)",
        bodyPreview: "hi",
        fromAddress: "stranger@example.com",
        submitterEmail: "oana@example.com",
        mailbox: "info@mccoy.nl",
        requestNumber: "WR-2026-00019",
        isReplyOrForward: true,
        isMcCoySender: false,
      }),
    ).toBe(false);
  });
});
