import { beforeEach, describe, expect, it, vi } from "vitest";

const listGraphFormInboxAttachments = vi.fn();

vi.mock("./graph-mail", () => ({
  listGraphFormInboxAttachments: (...args: unknown[]) => listGraphFormInboxAttachments(...args),
}));

import { hydrateWebsiteRequestThreadAttachments } from "./website-request-inbox";
import { encodeGraphMessageId, encodeRequestMessageId } from "./inbox-message-id";

describe("hydrateWebsiteRequestThreadAttachments", () => {
  beforeEach(() => {
    listGraphFormInboxAttachments.mockReset();
  });

  it("maps a klant reply with two photos and a PDF onto the Gesprek bubble", async () => {
    const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const rootId = encodeRequestMessageId(requestId, "website-requests");
    const attachments = [
      { filename: "keuken.jpg", contentType: "image/jpeg", size: 80_000, omitted: false, part: "a1" },
      { filename: "badkamer.jpg", contentType: "image/jpeg", size: 90_000, omitted: false, part: "a2" },
      { filename: "offerte.pdf", contentType: "application/pdf", size: 40_000, omitted: false, part: "a3" },
    ];
    listGraphFormInboxAttachments.mockResolvedValue(attachments);

    const thread = [
      {
        id: rootId,
        uid: 1,
        direction: "form" as const,
        from: "form",
        to: "info@mccoy.nl",
        date: "2026-08-19T10:00:00.000Z",
        subject: "Aanvraag",
        textBody: "formulier",
        messageId: "<form@mccoy>",
        attachments: [],
      },
      {
        id: `${rootId}:mail:mail-in`,
        uid: 2,
        direction: "customer" as const,
        from: "klant@example.com",
        to: "info@mccoy.nl",
        date: "2026-08-19T11:00:00.000Z",
        subject: "Re: Aanvraag",
        textBody: "Hier de foto's en de PDF.",
        messageId: "<in@yahoo.com>",
        attachments: [],
      },
    ];

    const result = await hydrateWebsiteRequestThreadAttachments(
      thread,
      [
        {
          id: "mail-form",
          direction: "inbound",
          provider: "website_form",
          mailbox: "info@mccoy.nl",
          sender_address: "noreply@mccoy.nl",
          recipient_addresses: ["info@mccoy.nl"],
          subject: "Aanvraag",
          body_text: "formulier",
          occurred_at: "2026-08-19T10:00:00.000Z",
          internet_message_id: "<form@mccoy>",
          graph_message_id: "g-form",
        },
        {
          id: "mail-in",
          direction: "inbound",
          provider: "microsoft_graph",
          mailbox: "info@mccoy.nl",
          sender_address: "klant@example.com",
          recipient_addresses: ["info@mccoy.nl"],
          subject: "Re: Aanvraag",
          body_text: "Hier de foto's en de PDF.",
          occurred_at: "2026-08-19T11:00:00.000Z",
          internet_message_id: "<in@yahoo.com>",
          graph_message_id: "g-in",
        },
      ],
      "info@mccoy.nl",
    );

    const customer = result.find((item) => item.direction === "customer");
    expect(customer?.textBody).toBe("Hier de foto's en de PDF.");
    expect(customer?.attachments.map((item) => item.filename)).toEqual([
      "keuken.jpg",
      "badkamer.jpg",
      "offerte.pdf",
    ]);
    expect(customer?.id).toBe(encodeGraphMessageId("g-in", "info@mccoy.nl"));
    expect(listGraphFormInboxAttachments).toHaveBeenCalledWith("g-in", "info@mccoy.nl");
    expect(listGraphFormInboxAttachments).not.toHaveBeenCalledWith("g-form", expect.anything());
    expect(result.find((item) => item.direction === "form")?.attachments).toEqual([]);
  });

  it("copies outbound Graph attachments onto a matching staff reply bubble", async () => {
    listGraphFormInboxAttachments.mockResolvedValue([
      { filename: "plan.pdf", contentType: "application/pdf", size: 12_000, omitted: false, part: "p1" },
    ]);

    const thread = [
      {
        id: "persisted-reply:req-1:r1",
        uid: 3,
        direction: "admin" as const,
        from: "oana",
        to: "klant@example.com",
        date: "2026-08-19T12:00:00.000Z",
        subject: "Re: Aanvraag",
        textBody: "Zie bijlage",
        messageId: "<out@mccoy.nl>",
        attachments: [],
      },
    ];

    const result = await hydrateWebsiteRequestThreadAttachments(
      thread,
      [
        {
          id: "mail-out",
          direction: "outbound",
          provider: "microsoft_graph",
          mailbox: "info@mccoy.nl",
          sender_address: "info@mccoy.nl",
          recipient_addresses: ["klant@example.com"],
          subject: "Re: Aanvraag",
          body_text: "Zie bijlage",
          occurred_at: "2026-08-19T12:00:00.000Z",
          internet_message_id: "<out@mccoy.nl>",
          graph_message_id: "g-out",
        },
      ],
      "info@mccoy.nl",
    );

    expect(result[0]?.attachments.map((item) => item.filename)).toEqual(["plan.pdf"]);
    expect(result[0]?.id).toBe(encodeGraphMessageId("g-out", "info@mccoy.nl"));
  });
});
