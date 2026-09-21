import { describe, expect, it } from "vitest";

import {
  mailRowsForRequest,
  websiteRequestMailRowBelongsToSubmitter,
} from "./website-request-inbox";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "mail-1",
    direction: "inbound" as const,
    provider: "microsoft_graph",
    mailbox: "info@mccoy.nl",
    sender_address: "applicant@example.com",
    recipient_addresses: ["info@mccoy.nl"],
    subject: "Re: aanvraag",
    body_text: "antwoord",
    occurred_at: "2026-09-21T10:00:00.000Z",
    internet_message_id: "<mail-1@example.com>",
    graph_message_id: "graph-1",
    conversation_id: "conversation-1",
    in_reply_to: null,
    references_header: null,
    ...overrides,
  };
}

describe("websiteRequestMailRowBelongsToSubmitter", () => {
  it("accepts an inbound Graph row from the request submitter", () => {
    expect(websiteRequestMailRowBelongsToSubmitter(row(), "applicant@example.com")).toBe(true);
  });

  it("accepts an outbound Graph row addressed to the request submitter", () => {
    expect(
      websiteRequestMailRowBelongsToSubmitter(
        row({
          direction: "outbound",
          sender_address: "info@mccoy.nl",
          recipient_addresses: ["applicant@example.com"],
        }),
        "applicant@example.com",
      ),
    ).toBe(true);
  });

  it("hides a legacy Graph row belonging to another customer", () => {
    expect(
      websiteRequestMailRowBelongsToSubmitter(
        row({ sender_address: "other-customer@example.com" }),
        "applicant@example.com",
      ),
    ).toBe(false);
  });

  it("does not alter non-Graph legacy providers", () => {
    expect(
      websiteRequestMailRowBelongsToSubmitter(
        row({ provider: "imap", sender_address: "other-customer@example.com" }),
        "applicant@example.com",
      ),
    ).toBe(true);
  });
});

describe("mailRowsForRequest", () => {
  it("shows an alternate-sender reply only through its trusted outbound RFC parent", () => {
    const parent = row({
      id: "mail-parent",
      direction: "outbound",
      sender_address: "info@mccoy.nl",
      recipient_addresses: ["applicant@example.com"],
      subject: "Antwoord (WR-2026-00082)",
      body_text: "Antwoord voor WR-2026-00082",
      internet_message_id: "<parent@mccoy.nl>",
      graph_message_id: "graph-parent",
      conversation_id: "conversation-82",
    });
    const aliasReply = row({
      id: "mail-alias",
      sender_address: "alias@example.net",
      subject: "Re: Antwoord (WR-2026-00082)",
      internet_message_id: "<alias@example.net>",
      graph_message_id: "graph-alias",
      conversation_id: "conversation-82",
      in_reply_to: "<parent@mccoy.nl>",
    });

    expect(
      mailRowsForRequest([parent, aliasReply], "applicant@example.com", "WR-2026-00082").map(
        (item) => item.id,
      ),
    ).toEqual(["mail-parent", "mail-alias"]);
  });

  it.each([
    ["different parent", { in_reply_to: "<foreign@mccoy.nl>" }],
    ["different conversation", { conversation_id: "foreign" }],
    ["different request", { subject: "Re: Antwoord (WR-2026-00081)" }],
  ])("keeps an alternate sender hidden for a %s", (_label, aliasOverride) => {
    const parent = row({
      id: "mail-parent",
      direction: "outbound",
      sender_address: "info@mccoy.nl",
      recipient_addresses: ["applicant@example.com"],
      subject: "Antwoord (WR-2026-00082)",
      body_text: "Antwoord voor WR-2026-00082",
      internet_message_id: "<parent@mccoy.nl>",
      graph_message_id: "graph-parent",
      conversation_id: "conversation-82",
    });
    const aliasReply = row({
      id: "mail-alias",
      sender_address: "alias@example.net",
      subject: "Re: Antwoord (WR-2026-00082)",
      conversation_id: "conversation-82",
      in_reply_to: "<parent@mccoy.nl>",
      ...aliasOverride,
    });

    expect(
      mailRowsForRequest([parent, aliasReply], "applicant@example.com", "WR-2026-00082").map(
        (item) => item.id,
      ),
    ).toEqual(["mail-parent"]);
  });
});
