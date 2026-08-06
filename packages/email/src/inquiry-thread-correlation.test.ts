import { describe, expect, it } from "vitest";

import {
  correlateInboundGraphMessage,
  type KnownInquiryMailIdentity,
} from "./inquiry-thread-correlation";

const known: KnownInquiryMailIdentity = {
  inquiryId: "req-1",
  requestNumber: "WR-2026-00001",
  mailbox: "info@mccoy.nl",
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
