import { beforeEach, describe, expect, it, vi } from "vitest";

const listGraphFormInboxAttachments = vi.fn();
const getWebsiteRequest = vi.fn();
const listWebsiteRequestMailMessages = vi.fn();
const loadActivePublishedFormScopeKeys = vi.fn();
const updateWebsiteRequestMailMessageAttachments = vi.fn();
const getGraphMailConfig = vi.fn(() => ({ mailbox: "info@mccoy.nl" }));

vi.mock("./graph-mail", () => ({
  listGraphFormInboxAttachments: (...args: unknown[]) => listGraphFormInboxAttachments(...args),
}));

vi.mock("./graph-config", () => ({
  getGraphMailConfig: () => getGraphMailConfig(),
}));

vi.mock("@mccoy/database/server", () => ({
  getWebsiteRequest: (...args: unknown[]) => getWebsiteRequest(...args),
  listWebsiteRequests: vi.fn(),
  setWebsiteRequestStatus: vi.fn(),
  listWebsiteRequestMailMessages: (...args: unknown[]) =>
    listWebsiteRequestMailMessages(...args),
  loadActivePublishedFormScopeKeys: (...args: unknown[]) =>
    loadActivePublishedFormScopeKeys(...args),
  updateWebsiteRequestMailMessageAttachments: (...args: unknown[]) =>
    updateWebsiteRequestMailMessageAttachments(...args),
}));

import {
  getWebsiteRequestFormInboxMessage,
  hydrateWebsiteRequestThreadAttachments,
} from "./website-request-inbox";
import { encodeGraphMessageId, encodeRequestMessageId } from "./inbox-message-id";

describe("hydrateWebsiteRequestThreadAttachments", () => {
  beforeEach(() => {
    listGraphFormInboxAttachments.mockReset();
    updateWebsiteRequestMailMessageAttachments.mockReset();
    updateWebsiteRequestMailMessageAttachments.mockResolvedValue(true);
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

  it("collapses a leftover empty req: mail bubble after rewriting the Graph id", async () => {
    const requestId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const rootId = encodeRequestMessageId(requestId, "website-requests");
    listGraphFormInboxAttachments.mockResolvedValue([
      { filename: "keuken.jpg", contentType: "image/jpeg", size: 80_000, omitted: false, part: "a1" },
    ]);

    const shared = {
      uid: 2,
      direction: "customer" as const,
      from: "klant@example.com",
      to: "info@mccoy.nl",
      date: "2026-08-19T11:00:00.000Z",
      subject: "Re: Aanvraag",
      textBody: "Hier de foto's",
      messageId: "<in@yahoo.com>",
      attachments: [] as { filename: string; contentType: string; size: number; omitted: boolean }[],
    };

    const result = await hydrateWebsiteRequestThreadAttachments(
      [
        { ...shared, id: `${rootId}:mail:mail-in` },
        { ...shared, id: `${rootId}:mail:mail-in-dup`, uid: 3 },
      ],
      [
        {
          id: "mail-in",
          direction: "inbound",
          provider: "microsoft_graph",
          mailbox: "info@mccoy.nl",
          sender_address: "klant@example.com",
          recipient_addresses: ["info@mccoy.nl"],
          subject: "Re: Aanvraag",
          body_text: "Hier de foto's",
          occurred_at: "2026-08-19T11:00:00.000Z",
          internet_message_id: "<in@yahoo.com>",
          graph_message_id: "g-in",
        },
      ],
      "info@mccoy.nl",
    );

    const customers = result.filter((item) => item.direction === "customer");
    expect(customers).toHaveLength(1);
    expect(customers[0]?.id).toBe(encodeGraphMessageId("g-in", "info@mccoy.nl"));
    expect(customers[0]?.attachments.map((item) => item.filename)).toEqual(["keuken.jpg"]);
  });
});


const REQUEST_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function websiteRequestFixture() {
  return {
    id: REQUEST_ID,
    number: "WR-2026-00021",
    kind: "inquiry" as const,
    status: "open" as const,
    submitterName: "Klant",
    submitterEmail: "klant@example.com",
    submitterPhone: null,
    submitterCompany: null,
    subject: "Algemene aanvraag",
    fields: { message: "Hallo" },
    attachments: [],
    replies: [],
    notificationState: "sent" as const,
    notificationError: null,
    companyId: null,
    formId: null,
    sourcePageId: null,
    scopeKey: null,
    scopeLabel: null,
    createdAt: "2026-08-19T10:00:00.000Z",
    updatedAt: "2026-08-19T11:00:00.000Z",
    lastRepliedAt: null,
  };
}

function inboundMailRow(extra: Record<string, unknown> = {}) {
  return {
    id: "mail-in",
    request_id: REQUEST_ID,
    direction: "inbound" as const,
    provider: "microsoft_graph",
    mailbox: "info@mccoy.nl",
    sender_address: "klant@example.com",
    recipient_addresses: ["info@mccoy.nl"],
    subject: "Re: Algemene aanvraag",
    body_text: "Hier de foto van de keuken.",
    occurred_at: "2026-08-19T11:00:00.000Z",
    internet_message_id: "<in@iphone.icloud.com>",
    graph_message_id: "g-in",
    is_read: true,
    created_at: "2026-08-19T11:00:00.000Z",
    attachments: [],
    ...extra,
  };
}

describe("getWebsiteRequestFormInboxMessage first paint", () => {
  beforeEach(() => {
    listGraphFormInboxAttachments.mockReset();
    getWebsiteRequest.mockReset();
    listWebsiteRequestMailMessages.mockReset();
    loadActivePublishedFormScopeKeys.mockResolvedValue(null);
    updateWebsiteRequestMailMessageAttachments.mockReset();
    updateWebsiteRequestMailMessageAttachments.mockResolvedValue(true);
    getGraphMailConfig.mockReturnValue({ mailbox: "info@mccoy.nl" });
    getWebsiteRequest.mockResolvedValue(websiteRequestFixture());
  });

  it("includes stored iPhone photo on the klant bubble without a thread RPC", async () => {
    const photo = {
      filename: "IMG_1234.JPG",
      contentType: "image/jpeg",
      size: 240_000,
      graphAttachmentId: "AAMk-photo",
    };
    listWebsiteRequestMailMessages.mockResolvedValue([inboundMailRow({ attachments: [photo] })]);
    listGraphFormInboxAttachments.mockResolvedValue([]);

    const inboxId = encodeRequestMessageId(REQUEST_ID, "website-requests");
    const message = await getWebsiteRequestFormInboxMessage(inboxId);
    const customer = message?.thread.find((item) => item.direction === "customer");

    expect(customer?.textBody).toBe("Hier de foto van de keuken.");
    expect(customer?.attachments.map((item) => item.filename)).toEqual(["IMG_1234.JPG"]);
    expect(customer?.attachments[0]?.part).toBe("AAMk-photo");
    expect(customer?.id).toBe(encodeGraphMessageId("g-in", "info@mccoy.nl"));
    expect(listGraphFormInboxAttachments).not.toHaveBeenCalled();
  });

  it("lists Graph attachments on first open so a second thread call is not required", async () => {
    listWebsiteRequestMailMessages.mockResolvedValue([inboundMailRow()]);
    listGraphFormInboxAttachments.mockResolvedValue([
      {
        filename: "IMG_1234.JPG",
        contentType: "image/jpeg",
        size: 240_000,
        omitted: false,
        part: "AAMk-photo",
      },
    ]);

    const inboxId = encodeRequestMessageId(REQUEST_ID, "website-requests");
    const message = await getWebsiteRequestFormInboxMessage(inboxId);
    const customer = message?.thread.find((item) => item.direction === "customer");

    expect(customer?.attachments.map((item) => item.filename)).toEqual(["IMG_1234.JPG"]);
    expect(customer?.id).toBe(encodeGraphMessageId("g-in", "info@mccoy.nl"));
    expect(listGraphFormInboxAttachments).toHaveBeenCalledTimes(1);
    expect(listGraphFormInboxAttachments).toHaveBeenCalledWith("g-in", "info@mccoy.nl");
    expect(message?.thread.filter((item) => item.direction === "customer")).toHaveLength(1);
    expect(updateWebsiteRequestMailMessageAttachments).toHaveBeenCalledWith("mail-in", [
      {
        filename: "IMG_1234.JPG",
        contentType: "image/jpeg",
        size: 240_000,
        graphAttachmentId: "AAMk-photo",
      },
    ]);
  });
});
