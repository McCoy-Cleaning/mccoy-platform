import { beforeEach, describe, expect, it, vi } from "vitest";

const getWebsiteRequest = vi.fn();
const listWebsiteRequestMailMessages = vi.fn();
const upsertWebsiteRequestMailMessage = vi.fn();
const shouldAttemptGraphMail = vi.fn();
const getGraphMailConfig = vi.fn();
const listGraphConversationSyncMessages = vi.fn();
const listRecentGraphSyncMessages = vi.fn();
const getGraphMessageSyncMeta = vi.fn();
const findGraphMessageByInternetMessageId = vi.fn();
const getGraphMessagePlainBody = vi.fn();

vi.mock("@mccoy/database/server", () => ({
  getWebsiteRequest: (...args: unknown[]) => getWebsiteRequest(...args),
  listWebsiteRequestMailMessages: (...args: unknown[]) =>
    listWebsiteRequestMailMessages(...args),
  upsertWebsiteRequestMailMessage: (...args: unknown[]) =>
    upsertWebsiteRequestMailMessage(...args),
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
  listRecentGraphSyncMessages: (...args: unknown[]) =>
    listRecentGraphSyncMessages(...args),
  getGraphMessageSyncMeta: (...args: unknown[]) => getGraphMessageSyncMeta(...args),
  findGraphMessageByInternetMessageId: (...args: unknown[]) =>
    findGraphMessageByInternetMessageId(...args),
  getGraphMessagePlainBody: (...args: unknown[]) => getGraphMessagePlainBody(...args),
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
  getGraphMessagePlainBody.mockResolvedValue(null);
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

  it("recovers conversation id from reply provider message id when mail rows lack it", async () => {
    listWebsiteRequestMailMessages.mockResolvedValue([]);
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
    listGraphConversationSyncMessages.mockResolvedValue([
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
      },
    ]);
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
