import { describe, expect, it } from "vitest";

import {
  correlateInboundGraphMessage,
  type KnownInquiryMailIdentity,
  verifiedReplyParentBelongsToWebsiteRequest,
} from "./inquiry-thread-correlation";

const known: KnownInquiryMailIdentity = {
  inquiryId: "req-1",
  requestNumber: "WR-2026-00001",
  mailbox: "info@mccoy.nl",
  submitterEmail: "anna@example.com",
  internetMessageIds: ["<form-root@mccoy.nl>", "<admin-reply@mccoy.nl>"],
  graphMessageIds: ["graph-root-1", "graph-admin-1"],
  conversationIds: ["conv-shared"],
};

describe("correlateInboundGraphMessage", () => {
  it("dedupes exact Graph message id", () => {
    const result = correlateInboundGraphMessage(
      {
        mailbox: "info@mccoy.nl",
        graphMessageId: "graph-admin-1",
        internetMessageId: "<new@x>",
        conversationId: "other",
        inReplyTo: null,
        references: [],
        subject: "AW: Algemene aanvraag",
        fromAddress: "anna@example.com",
      },
      [known],
    );
    expect(result).toEqual({
      status: "already_processed",
      inquiryId: "req-1",
      match: "graph_message_id",
    });
  });

  it("appends when In-Reply-To matches a known outbound internetMessageId", () => {
    const result = correlateInboundGraphMessage(
      {
        mailbox: "info@mccoy.nl",
        graphMessageId: "graph-applicant-1",
        internetMessageId: "<applicant-1@example.com>",
        conversationId: "conv-new",
        inReplyTo: "<admin-reply@mccoy.nl>",
        references: ["<form-root@mccoy.nl>", "<admin-reply@mccoy.nl>"],
        subject: "AW: Algemene aanvraag — Anna (WR-2026-00001)",
        fromAddress: "anna@example.com",
      },
      [known],
    );
    expect(result.status).toBe("appended");
    if (result.status === "appended") {
      expect(result.inquiryId).toBe("req-1");
      expect(result.match).toBe("in_reply_to");
    }
  });

  it("appends when References match without In-Reply-To", () => {
    const result = correlateInboundGraphMessage(
      {
        mailbox: "info@mccoy.nl",
        graphMessageId: "graph-applicant-2",
        internetMessageId: "<applicant-2@example.com>",
        conversationId: "other",
        inReplyTo: null,
        references: ["<form-root@mccoy.nl>"],
        subject: "Re: Algemene aanvraag",
        fromAddress: "anna@example.com",
      },
      [known],
    );
    expect(result.status).toBe("appended");
    if (result.status === "appended") {
      expect(result.match).toBe("references");
    }
  });

  it("appends on unique conversationId match", () => {
    const result = correlateInboundGraphMessage(
      {
        mailbox: "info@mccoy.nl",
        graphMessageId: "graph-applicant-3",
        internetMessageId: "<applicant-3@example.com>",
        conversationId: "conv-shared",
        inReplyTo: null,
        references: [],
        subject: "Re: something else entirely",
        fromAddress: "anna@example.com",
      },
      [known],
    );
    expect(result.status).toBe("appended");
    if (result.status === "appended") {
      expect(result.match).toBe("conversation_id");
    }
  });

  it("does not merge on sender + subject alone", () => {
    const result = correlateInboundGraphMessage(
      {
        mailbox: "info@mccoy.nl",
        graphMessageId: "graph-unrelated",
        internetMessageId: "<unrelated@example.com>",
        conversationId: "conv-other",
        inReplyTo: null,
        references: [],
        subject: "Algemene aanvraag — Anna (WR-2026-00001)",
        fromAddress: "anna@example.com",
      },
      [known],
    );
    expect(result.status).toBe("unmatched");
  });

  it("keeps two applicants with the same subject separate", () => {
    const other: KnownInquiryMailIdentity = {
      inquiryId: "req-2",
      requestNumber: "WR-2026-00002",
      mailbox: "info@mccoy.nl",
      submitterEmail: "bob@example.com",
      internetMessageIds: ["<form-root-2@mccoy.nl>"],
      graphMessageIds: ["graph-root-2"],
      conversationIds: ["conv-2"],
    };
    const result = correlateInboundGraphMessage(
      {
        mailbox: "info@mccoy.nl",
        graphMessageId: "graph-b",
        internetMessageId: "<b@example.com>",
        conversationId: "conv-b",
        inReplyTo: null,
        references: [],
        subject: "Algemene aanvraag — Same Subject",
        fromAddress: "bob@example.com",
      },
      [known, other],
    );
    expect(result.status).toBe("unmatched");
  });

  it("does not attach mail whose reply token belongs to a different request", () => {
    const other: KnownInquiryMailIdentity = {
      inquiryId: "req-2",
      requestNumber: "WR-2026-00002",
      mailbox: "info@mccoy.nl",
      submitterEmail: "carla@example.com",
      internetMessageIds: ["<form-root-2@mccoy.nl>", "<admin-reply-2@mccoy.nl>"],
      graphMessageIds: ["graph-root-2"],
      conversationIds: ["conv-2"],
    };
    // Reply to req-2's staff mail while quoting req-1's WR number in the subject.
    const result = correlateInboundGraphMessage(
      {
        mailbox: "info@mccoy.nl",
        graphMessageId: "graph-c",
        internetMessageId: "<c@example.com>",
        conversationId: "conv-2",
        inReplyTo: "<admin-reply-2@mccoy.nl>",
        references: [],
        subject: "Re: Algemene aanvraag (WR-2026-00001)",
        fromAddress: "carla@example.com",
      },
      [known, other],
    );
    expect(result).toEqual({
      status: "appended",
      inquiryId: "req-2",
      match: "in_reply_to",
    });
  });

  it("reports ambiguous instead of attaching when a conversation maps to two inquiries", () => {
    const duplicate: KnownInquiryMailIdentity = {
      inquiryId: "req-2",
      requestNumber: "WR-2026-00002",
      mailbox: "info@mccoy.nl",
      submitterEmail: "dirk@example.com",
      internetMessageIds: ["<form-root-2@mccoy.nl>"],
      graphMessageIds: ["graph-root-2"],
      conversationIds: ["conv-shared"],
    };
    const result = correlateInboundGraphMessage(
      {
        mailbox: "info@mccoy.nl",
        graphMessageId: "graph-d",
        internetMessageId: "<d@example.com>",
        conversationId: "conv-shared",
        inReplyTo: null,
        references: [],
        subject: "Re: iets",
        fromAddress: "dirk@example.com",
      },
      [known, duplicate],
    );
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.inquiryIds).toEqual(["req-1", "req-2"]);
    }
  });

  it("does not cross mailbox boundaries", () => {
    const result = correlateInboundGraphMessage(
      {
        mailbox: "other@mccoy.nl",
        graphMessageId: "graph-applicant-1",
        internetMessageId: "<x@example.com>",
        conversationId: "conv-shared",
        inReplyTo: "<admin-reply@mccoy.nl>",
        references: [],
        subject: "Re: test",
        fromAddress: "anna@example.com",
      },
      [known],
    );
    expect(result.status).toBe("unmatched");
  });
});

describe("verifiedReplyParentBelongsToWebsiteRequest", () => {
  const proof = {
    mailbox: "info@mccoy.nl",
    submitterEmail: "form-address@example.com",
    requestNumber: "WR-2026-00082",
    inReplyTo: "<outbound@mccoy.nl>",
    reply: {
      subject: "Re: Aanvraag (WR-2026-00082)",
      bodyPreview: "Reactie via mijn andere adres",
      conversationId: "conversation-82",
      fromAddress: "alias@example.net",
      toAddresses: ["info@mccoy.nl"],
    },
    parent: {
      subject: "Aanvraag (WR-2026-00082)",
      bodyPreview: "Ons antwoord voor WR-2026-00082",
      internetMessageId: "<outbound@mccoy.nl>",
      conversationId: "conversation-82",
      fromAddress: "info@mccoy.nl",
      toAddresses: ["form-address@example.com"],
    },
  };

  it("accepts an alternate sender only through the exact outbound parent", () => {
    expect(verifiedReplyParentBelongsToWebsiteRequest(proof)).toBe(true);
  });

  it.each([
    ["another request number", { requestNumber: "WR-2026-00081" }],
    ["another conversation", { reply: { ...proof.reply, conversationId: "foreign" } }],
    [
      "another parent recipient",
      { parent: { ...proof.parent, toAddresses: ["other@example.com"] } },
    ],
    ["another RFC parent", { inReplyTo: "<foreign@mccoy.nl>" }],
    ["mail not sent by McCoy", { parent: { ...proof.parent, fromAddress: "other@example.com" } }],
  ])("rejects %s", (_label, override) => {
    expect(verifiedReplyParentBelongsToWebsiteRequest({ ...proof, ...override })).toBe(false);
  });
});
