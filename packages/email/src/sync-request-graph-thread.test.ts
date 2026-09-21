import { beforeEach, describe, expect, it, vi } from "vitest";

const getWebsiteRequest = vi.fn();
const listWebsiteRequestMailMessages = vi.fn();
const upsertWebsiteRequestMailMessage = vi.fn();
const shouldAttemptGraphMail = vi.fn();
const getGraphMailConfig = vi.fn();
const listGraphConversationSyncMessages = vi.fn();
const listGraphSenderSyncMessages = vi.fn();
const listRecentGraphSyncMessages = vi.fn();
const getGraphMessageSyncMeta = vi.fn();
const findGraphMessageByInternetMessageId = vi.fn();
const getGraphMessagePlainBody = vi.fn();
const getGraphReplyParentContext = vi.fn();
const recordUnmatchedInboundMail = vi.fn();
const resolveUnmatchedInboundMail = vi.fn();

vi.mock("@mccoy/database/server", () => ({
  getWebsiteRequest: (...args: unknown[]) => getWebsiteRequest(...args),
  listWebsiteRequestMailMessages: (...args: unknown[]) => listWebsiteRequestMailMessages(...args),
  upsertWebsiteRequestMailMessage: (...args: unknown[]) => upsertWebsiteRequestMailMessage(...args),
  recordUnmatchedInboundMail: (...args: unknown[]) => recordUnmatchedInboundMail(...args),
  resolveUnmatchedInboundMail: (...args: unknown[]) => resolveUnmatchedInboundMail(...args),
}));

vi.mock("./form-inbox-provider", () => ({
  shouldAttemptGraphMail: () => shouldAttemptGraphMail(),
}));

vi.mock("./graph-config", () => ({
  getGraphMailConfig: () => getGraphMailConfig(),
}));

vi.mock("./graph-mail", () => ({
  classifyGraphThreadDirection: (input: {
    fromAddress: string | null;
    inboxUser: string;
    submitter: string | null;
    subject: string;
  }) => {
    const from = (input.fromAddress || "").toLowerCase();
    if (from && from === input.inboxUser.trim().toLowerCase()) return "admin";
    if (input.submitter && from === input.submitter.toLowerCase()) return "customer";
    return "customer";
  },
  isMcCoyWebsiteFormNotificationBySender: () => false,
  listGraphConversationSyncMessages: (...args: unknown[]) =>
    listGraphConversationSyncMessages(...args),
  listGraphSenderSyncMessages: (...args: unknown[]) => listGraphSenderSyncMessages(...args),
  listRecentGraphSyncMessages: (...args: unknown[]) => listRecentGraphSyncMessages(...args),
  getGraphMessageSyncMeta: (...args: unknown[]) => getGraphMessageSyncMeta(...args),
  findGraphMessageByInternetMessageId: (...args: unknown[]) =>
    findGraphMessageByInternetMessageId(...args),
  getGraphMessagePlainBody: (...args: unknown[]) => getGraphMessagePlainBody(...args),
  getGraphReplyParentContext: (...args: unknown[]) => getGraphReplyParentContext(...args),
}));

import { syncWebsiteRequestGraphThread } from "./sync-request-graph-thread";

beforeEach(() => {
  vi.clearAllMocks();
  shouldAttemptGraphMail.mockReturnValue(true);
  getGraphMailConfig.mockReturnValue({ mailbox: "info@mccoy.nl" });
  getWebsiteRequest.mockResolvedValue({
    id: "req-1",
    number: "WR-2026-00019",
    subject: "Algemene aanvraag — Oana Dinescu",
    submitterEmail: "oana@example.com",
    createdAt: "2026-08-06T12:00:00.000Z",
    replies: [],
  });
  listWebsiteRequestMailMessages.mockResolvedValue([
    {
      id: "mail-out",
      direction: "outbound",
      provider: "microsoft_graph",
      mailbox: "info@mccoy.nl",
      graph_message_id: "g-out",
      internet_message_id: "<out@mccoy.nl>",
      conversation_id: "conv-1",
      sender_address: "info@mccoy.nl",
      recipient_addresses: ["oana@example.com"],
      subject: "Re: test",
      body_text: "testing from user's side",
      occurred_at: "2026-08-06T13:41:00.000Z",
    },
  ]);
  listGraphConversationSyncMessages.mockResolvedValue([
    {
      id: "g-out",
      subject: "Re: test",
      bodyPreview: "testing from user's side",
      receivedDateTime: "2026-08-06T13:41:00.000Z",
      isRead: true,
      internetMessageId: "<out@mccoy.nl>",
      conversationId: "conv-1",
      fromAddress: "info@mccoy.nl",
      fromName: "McCoy",
      toAddresses: ["oana@example.com"],
      textBody: "testing from user's side",
    },
    {
      id: "g-in",
      subject: "AW: test",
      bodyPreview: "thanks, here is my reply",
      receivedDateTime: "2026-08-06T13:50:00.000Z",
      isRead: false,
      internetMessageId: "<in@yahoo.com>",
      conversationId: "conv-1",
      fromAddress: "oana@example.com",
      fromName: "Oana",
      toAddresses: ["info@mccoy.nl"],
      textBody: "thanks, here is my reply",
    },
  ]);
  listRecentGraphSyncMessages.mockResolvedValue([]);
  listGraphSenderSyncMessages.mockResolvedValue([]);
  getGraphMessagePlainBody.mockResolvedValue(null);
  getGraphReplyParentContext.mockResolvedValue(null);
  recordUnmatchedInboundMail.mockResolvedValue({ status: "recorded", id: "unmatched-1" });
  resolveUnmatchedInboundMail.mockResolvedValue(0);
  upsertWebsiteRequestMailMessage.mockImplementation(async (input: { graphMessageId?: string }) => {
    if (input.graphMessageId === "g-out") {
      return { status: "already_processed", id: "mail-out" };
    }
    return { status: "appended", id: "mail-in" };
  });
});

describe("syncWebsiteRequestGraphThread", () => {
  it("appends inbound applicant Graph replies into the website request thread", async () => {
    const result = await syncWebsiteRequestGraphThread("req-1");

    expect(result.conversationsChecked).toBe(1);
    expect(result.appended).toBe(1);
    expect(result.alreadyProcessed).toBe(1);
    expect(upsertWebsiteRequestMailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req-1",
        direction: "inbound",
        graphMessageId: "g-in",
        senderAddress: "oana@example.com",
        bodyText: "thanks, here is my reply",
      }),
    );
  });

  it("recovers the staff-reply conversation even when a form-root conversation already exists", async () => {
    listWebsiteRequestMailMessages.mockResolvedValue([
      {
        id: "mail-root",
        direction: "inbound",
        provider: "website_form",
        mailbox: "info@mccoy.nl",
        graph_message_id: "g-root",
        internet_message_id: "<root@mccoy.nl>",
        conversation_id: "conv-form-root",
        sender_address: "info@mccoy.nl",
        recipient_addresses: ["info@mccoy.nl"],
        subject: "Algemene aanvraag (WR-2026-00019)",
        body_text: "form notification",
        occurred_at: "2026-08-06T12:00:00.000Z",
      },
    ]);
    getWebsiteRequest.mockResolvedValue({
      id: "req-1",
      number: "WR-2026-00019",
      submitterEmail: "oana@example.com",
      replies: [{ id: "r1", resendId: "<out@mccoy.nl>", body: "hi" }],
    });
    findGraphMessageByInternetMessageId.mockResolvedValue({
      id: "g-out",
      conversationId: "conv-recovered",
      internetMessageId: "<out@mccoy.nl>",
    });
    listGraphConversationSyncMessages.mockImplementation(
      async ({ conversationId }: { conversationId: string }) =>
        conversationId === "conv-recovered"
          ? [
              {
                id: "g-in",
                subject: "Re: test",
                bodyPreview: "applicant answer",
                receivedDateTime: "2026-08-06T14:00:00.000Z",
                isRead: false,
                internetMessageId: "<in@yahoo.com>",
                conversationId: "conv-recovered",
                fromAddress: "oana@example.com",
                fromName: "Oana",
                toAddresses: ["info@mccoy.nl"],
                textBody: "applicant answer",
                hasAttachments: false,
              },
            ]
          : [],
    );
    upsertWebsiteRequestMailMessage.mockResolvedValue({
      status: "appended",
      id: "mail-in",
    });

    const result = await syncWebsiteRequestGraphThread("req-1");

    expect(findGraphMessageByInternetMessageId).toHaveBeenCalledWith(
      "<out@mccoy.nl>",
      "info@mccoy.nl",
    );
    expect(listGraphConversationSyncMessages).toHaveBeenCalledWith({
      conversationId: "conv-recovered",
      mailbox: "info@mccoy.nl",
    });
    expect(result.appended).toBe(1);
  });

  it("finds applicant reply via recent scan when conversation filter yields nothing", async () => {
    listWebsiteRequestMailMessages.mockResolvedValue([]);
    findGraphMessageByInternetMessageId.mockResolvedValue(null);
    listGraphConversationSyncMessages.mockResolvedValue([]);
    listRecentGraphSyncMessages.mockResolvedValue([
      {
        id: "g-in",
        subject: "AW: Algemene aanvraag — Oana (WR-2026-00019)",
        bodyPreview: "thanks from yahoo",
        receivedDateTime: "2026-08-06T14:10:00.000Z",
        isRead: false,
        internetMessageId: "<in@yahoo.com>",
        conversationId: "conv-unknown",
        fromAddress: "oana@example.com",
        fromName: "Oana",
        toAddresses: ["info@mccoy.nl"],
        textBody: "thanks from yahoo",
      },
    ]);
    upsertWebsiteRequestMailMessage.mockResolvedValue({
      status: "appended",
      id: "mail-in",
    });

    const result = await syncWebsiteRequestGraphThread("req-1");

    expect(result.conversationsChecked).toBe(0);
    expect(result.recentScanMatched).toBe(1);
    expect(result.appended).toBe(1);
    expect(upsertWebsiteRequestMailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: "inbound",
        graphMessageId: "g-in",
        bodyText: "thanks from yahoo",
      }),
    );
  });

  it("recovers an older applicant reply through the targeted sender scan", async () => {
    listWebsiteRequestMailMessages.mockResolvedValue([]);
    findGraphMessageByInternetMessageId.mockResolvedValue(null);
    listGraphConversationSyncMessages.mockResolvedValue([]);
    listGraphSenderSyncMessages.mockResolvedValue([
      {
        id: "g-in-older",
        subject: "AW: Algemene aanvraag (WR-2026-00019)",
        bodyPreview: "antwoord buiten het algemene mailboxvenster",
        receivedDateTime: "2026-08-07T09:10:00.000Z",
        isRead: false,
        internetMessageId: "<older@yahoo.com>",
        conversationId: "conv-older",
        fromAddress: "oana@example.com",
        fromName: "Oana",
        toAddresses: ["info@mccoy.nl"],
        textBody: "antwoord buiten het algemene mailboxvenster",
      },
    ]);
    upsertWebsiteRequestMailMessage.mockResolvedValue({
      status: "appended",
      id: "mail-in-older",
    });

    const result = await syncWebsiteRequestGraphThread("req-1");

    expect(listGraphSenderSyncMessages).toHaveBeenCalledWith({
      senderAddress: "oana@example.com",
      receivedSince: "2026-08-06T12:00:00.000Z",
      mailbox: "info@mccoy.nl",
      top: 40,
    });
    expect(result.targetedScanMatched).toBe(1);
    expect(result.appended).toBe(1);
    expect(listRecentGraphSyncMessages).not.toHaveBeenCalled();
    expect(upsertWebsiteRequestMailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: "inbound",
        graphMessageId: "g-in-older",
        senderAddress: "oana@example.com",
      }),
    );
  });

  it("accepts a client alias only when Graph proves the exact outbound parent", async () => {
    listWebsiteRequestMailMessages.mockResolvedValue([]);
    findGraphMessageByInternetMessageId.mockResolvedValue(null);
    listGraphConversationSyncMessages.mockResolvedValue([]);
    listRecentGraphSyncMessages.mockResolvedValue([
      {
        id: "g-alias-in",
        subject: "Re: Algemene aanvraag (WR-2026-00019)",
        bodyPreview: "reply sent through an alias",
        receivedDateTime: "2026-08-06T14:10:00.000Z",
        isRead: false,
        internetMessageId: "<alias-in@example.net>",
        conversationId: "conv-verified",
        fromAddress: "alias@example.net",
        fromName: "Oana alias",
        toAddresses: ["info@mccoy.nl"],
        textBody: "reply sent through an alias",
        hasAttachments: false,
      },
    ]);
    getGraphReplyParentContext.mockResolvedValue({
      inReplyTo: "<verified-parent@mccoy.nl>",
      references: ["<verified-parent@mccoy.nl>"],
      parent: {
        id: "g-verified-parent",
        subject: "Algemene aanvraag (WR-2026-00019)",
        bodyPreview: "McCoy reply for WR-2026-00019",
        receivedDateTime: "2026-08-06T14:00:00.000Z",
        isRead: true,
        internetMessageId: "<verified-parent@mccoy.nl>",
        conversationId: "conv-verified",
        fromAddress: "info@mccoy.nl",
        fromName: "McCoy",
        toAddresses: ["oana@example.com"],
        textBody: "McCoy reply for WR-2026-00019",
        hasAttachments: false,
      },
    });
    upsertWebsiteRequestMailMessage.mockImplementation(
      async (input: { graphMessageId?: string }) => ({
        status: "appended",
        id: input.graphMessageId === "g-verified-parent" ? "mail-parent" : "mail-alias",
      }),
    );

    const result = await syncWebsiteRequestGraphThread("req-1");

    expect(result.recentScanMatched).toBe(1);
    expect(result.appended).toBe(2);
    expect(recordUnmatchedInboundMail).not.toHaveBeenCalled();
    expect(resolveUnmatchedInboundMail).toHaveBeenCalledWith({
      mailbox: "info@mccoy.nl",
      graphMessageId: "g-alias-in",
      internetMessageId: "<alias-in@example.net>",
    });
    expect(upsertWebsiteRequestMailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: "outbound",
        graphMessageId: "g-verified-parent",
        recipientAddresses: ["oana@example.com"],
      }),
    );
    expect(upsertWebsiteRequestMailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: "inbound",
        graphMessageId: "g-alias-in",
        senderAddress: "alias@example.net",
        inReplyTo: "<verified-parent@mccoy.nl>",
        referencesHeader: "<verified-parent@mccoy.nl>",
      }),
    );
  });

  it("never appends another customer's thread that only shares the form subject", async () => {
    // `website_requests.subject` is the shared form-kind subject, so the mailbox is
    // full of staff replies whose subject repeats it for other customers.
    getWebsiteRequest.mockResolvedValue({
      id: "req-1",
      number: "WR-2026-00072",
      subject: "Offerte meubelreiniging",
      submitterEmail: "mike@example.com",
      replies: [],
    });
    listWebsiteRequestMailMessages.mockResolvedValue([]);
    findGraphMessageByInternetMessageId.mockResolvedValue(null);
    listGraphConversationSyncMessages.mockResolvedValue([]);
    listRecentGraphSyncMessages.mockResolvedValue([
      {
        id: "g-staff-other",
        subject: "RE: Offerte meubelreiniging (WR-2026-00055)",
        bodyPreview: "Beste Yvonne, hierbij de offerte meubelreiniging",
        receivedDateTime: "2026-09-18T15:00:00.000Z",
        isRead: true,
        internetMessageId: "<staff-other@mccoy.nl>",
        conversationId: "conv-other",
        fromAddress: "info@mccoy.nl",
        fromName: "McCoy",
        toAddresses: ["yvonne@benerink.nl"],
        textBody: "Beste Yvonne, hierbij de offerte meubelreiniging",
      },
      {
        id: "g-other-customer",
        subject: "RE: Offerte meubelreiniging (WR-2026-00055)",
        bodyPreview: "Hallo Sander, ik had de asbak laten zien",
        receivedDateTime: "2026-09-18T15:11:00.000Z",
        isRead: false,
        internetMessageId: "<other-customer@benerink.nl>",
        conversationId: "conv-other",
        fromAddress: "yvonne@benerink.nl",
        fromName: "Yvonne",
        toAddresses: ["info@mccoy.nl"],
        textBody: "Hallo Sander, ik had de asbak laten zien",
      },
    ]);

    const result = await syncWebsiteRequestGraphThread("req-1");

    expect(result.recentScanMatched).toBe(0);
    expect(result.recentScanRejected).toBe(2);
    expect(result.appended).toBe(0);
    expect(upsertWebsiteRequestMailMessage).not.toHaveBeenCalled();
  });

  it("repeated sync is idempotent — already_processed messages are not double-appended", async () => {
    upsertWebsiteRequestMailMessage.mockImplementation(async () => ({
      status: "already_processed",
      id: "mail-existing",
    }));

    const first = await syncWebsiteRequestGraphThread("req-1");
    const second = await syncWebsiteRequestGraphThread("req-1");

    expect(first.appended).toBe(0);
    expect(first.alreadyProcessed).toBeGreaterThan(0);
    expect(second.appended).toBe(0);
    expect(second.alreadyProcessed).toBe(first.alreadyProcessed);
    expect(upsertWebsiteRequestMailMessage.mock.calls.length).toBeGreaterThan(0);
    // Every upsert reports already_processed — no duplicate timeline rows.
    for (const call of upsertWebsiteRequestMailMessage.mock.results) {
      await expect(call.value).resolves.toMatchObject({ status: "already_processed" });
    }
  });
});
