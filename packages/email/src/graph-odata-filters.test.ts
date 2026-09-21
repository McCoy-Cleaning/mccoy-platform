import { describe, expect, it } from "vitest";
import {
  buildConversationReceivedFilter,
  buildConversationSentFilter,
  buildReceivedDateWindowFilter,
  buildSenderReceivedFilter,
  escapeODataString,
  websiteRequestMailEvidence,
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
    const filter = buildConversationSentFilter("conv-1", "2026-08-06T12:00:00.000Z");
    expect(filter).toBe("sentDateTime ge 2026-08-06T12:00:00.000Z and conversationId eq 'conv-1'");
  });

  it("builds a receivedDateTime window without contains() or $search", () => {
    expect(
      buildReceivedDateWindowFilter("2026-01-01T10:00:00.000Z", "2026-01-05T10:00:00.000Z"),
    ).toBe(
      "receivedDateTime ge 2026-01-01T10:00:00.000Z and receivedDateTime le 2026-01-05T10:00:00.000Z",
    );
    expect(buildReceivedDateWindowFilter("2026-01-01T10:00:00.000Z")).toBe(
      "receivedDateTime ge 2026-01-01T10:00:00.000Z",
    );
  });

  it("escapes single quotes in conversation ids", () => {
    expect(escapeODataString("a'b")).toBe("a''b");
    expect(buildConversationReceivedFilter("id'x")).toContain("conversationId eq 'id''x'");
  });

  it("builds a targeted sender lookup with receivedDateTime first", () => {
    expect(buildSenderReceivedFilter("o'hara@example.com", "2026-09-01T10:00:00.000Z")).toBe(
      "receivedDateTime ge 2026-09-01T10:00:00.000Z and from/emailAddress/address eq 'o''hara@example.com'",
    );
  });
});

describe("websiteRequestMailEvidence", () => {
  const base = {
    conversationId: null,
    knownConversationIds: new Set<string>(),
    knownMessageIds: new Set<string>(),
    bodyPreview: "hi",
    submitterEmail: "oana@example.com",
    mailbox: "info@mccoy.nl",
    requestNumber: "WR-2026-00019",
    isReplyOrForward: true,
    isMcCoySender: false,
  };

  it("matches submitter reply-shaped mail that cites the WR number", () => {
    expect(
      websiteRequestMailEvidence({
        ...base,
        subject: "AW: Algemene aanvraag (WR-2026-00019)",
        fromAddress: "oana@example.com",
      }),
    ).toBe("request_number");
  });

  it("does not match WR number alone from an unrelated sender", () => {
    expect(
      websiteRequestMailEvidence({
        ...base,
        subject: "AW: something (WR-2026-00019)",
        fromAddress: "stranger@example.com",
      }),
    ).toBeNull();
  });

  it("does not match another customer's mail that only shares the form subject", () => {
    // website_requests.subject is the shared form-kind subject, so a staff reply
    // to a different customer's furniture request quotes the exact same words.
    expect(
      websiteRequestMailEvidence({
        ...base,
        requestNumber: "WR-2026-00072",
        subject: "RE: Offerte meubelreiniging (WR-2026-00055)",
        bodyPreview: "Offerte meubelreiniging — beste Yvonne, ...",
        fromAddress: "info@mccoy.nl",
      }),
    ).toBeNull();
  });

  it("matches an already-correlated conversation id", () => {
    expect(
      websiteRequestMailEvidence({
        ...base,
        conversationId: "conv-1",
        knownConversationIds: new Set(["conv-1"]),
        subject: "(geen onderwerp)",
        fromAddress: "someone@example.com",
        isReplyOrForward: false,
      }),
    ).toBe("conversation_id");
  });

  it("matches when In-Reply-To or References cite a known message of this thread", () => {
    expect(
      websiteRequestMailEvidence({
        ...base,
        knownMessageIds: new Set(["<admin-reply@mccoy.nl>"]),
        inReplyTo: "admin-reply@mccoy.nl",
        subject: "Re: geen nummer",
        fromAddress: "oana@example.com",
      }),
    ).toBe("known_message_id");

    expect(
      websiteRequestMailEvidence({
        ...base,
        knownMessageIds: new Set(["<admin-reply@mccoy.nl>"]),
        references: ["<other@x>", "<ADMIN-REPLY@mccoy.nl>"],
        subject: "Re: geen nummer",
        fromAddress: "oana@example.com",
      }),
    ).toBe("known_message_id");
  });

  it("does not match a reply token that belongs to a different request", () => {
    expect(
      websiteRequestMailEvidence({
        ...base,
        subject: "AW: Algemene aanvraag (WR-2026-00020)",
        fromAddress: "oana@example.com",
      }),
    ).toBeNull();
  });
});
