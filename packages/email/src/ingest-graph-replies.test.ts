import { beforeEach, describe, expect, it, vi } from "vitest";

const listKnownMailIdentitiesForMailbox = vi.fn();
const upsertWebsiteRequestMailMessage = vi.fn();
const recordUnmatchedInboundMail = vi.fn();
const resolveUnmatchedInboundMail = vi.fn();
const findWebsiteRequestIdByNumber = vi.fn();
const getWebsiteRequest = vi.fn();
const getGraphReplyParentContext = vi.fn();

vi.mock("@mccoy/database/server", () => ({
  findWebsiteRequestIdByNumber: (...args: unknown[]) => findWebsiteRequestIdByNumber(...args),
  getWebsiteRequest: (...args: unknown[]) => getWebsiteRequest(...args),
  listKnownMailIdentitiesForMailbox: (...args: unknown[]) =>
    listKnownMailIdentitiesForMailbox(...args),
  upsertWebsiteRequestMailMessage: (...args: unknown[]) => upsertWebsiteRequestMailMessage(...args),
  recordUnmatchedInboundMail: (...args: unknown[]) => recordUnmatchedInboundMail(...args),
  resolveUnmatchedInboundMail: (...args: unknown[]) => resolveUnmatchedInboundMail(...args),
}));

vi.mock("./graph-config", () => ({
  getGraphMailConfig: () => ({ mailbox: "info@mccoy.nl" }),
}));

vi.mock("./notify-applicant-reply", () => ({
  notifyApplicantReplyAppended: vi.fn(),
}));

vi.mock("./persist-mail-graph-attachments", () => ({
  persistMailMessageGraphAttachments: vi.fn(async () => []),
}));

vi.mock("./graph-mail", () => ({
  getGraphReplyParentContext: (...args: unknown[]) => getGraphReplyParentContext(...args),
  getGraphMessageInternetHeaders: vi.fn(async () => []),
}));

import { ingestGraphReplyCandidates } from "./ingest-graph-replies";

const knownRequest = {
  inquiryId: "req-1",
  requestNumber: "WR-2026-00072",
  mailbox: "info@mccoy.nl",
  submitterEmail: "mike@example.com",
  internetMessageIds: ["<admin-reply@mccoy.nl>"],
  graphMessageIds: ["g-admin"],
  conversationIds: ["conv-1"],
};

function graphMessage(extra: Record<string, unknown> = {}) {
  return {
    id: "g-in",
    subject: "RE: Offerte meubelreiniging (WR-2026-00072)",
    bodyPreview: "Hierbij mijn antwoord",
    receivedDateTime: "2026-09-18T15:11:00.000Z",
    isRead: false,
    hasAttachments: false,
    internetMessageId: "<in@example.com>",
    conversationId: "conv-1",
    from: { emailAddress: { address: "mike@example.com" } },
    internetMessageHeaders: [
      {
        name: "Authentication-Results",
        value: "spf=pass smtp.mailfrom=example.com; dkim=pass; dmarc=pass header.from=example.com",
      },
    ],
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  listKnownMailIdentitiesForMailbox.mockResolvedValue([knownRequest]);
  upsertWebsiteRequestMailMessage.mockResolvedValue({ status: "appended", id: "mail-in" });
  recordUnmatchedInboundMail.mockResolvedValue({ status: "recorded", id: "unmatched-1" });
  resolveUnmatchedInboundMail.mockResolvedValue(0);
  findWebsiteRequestIdByNumber.mockResolvedValue(null);
  getWebsiteRequest.mockResolvedValue(null);
  getGraphReplyParentContext.mockResolvedValue(null);
});

describe("ingestGraphReplyCandidates", () => {
  it("appends a reply that belongs to a known conversation", async () => {
    const result = await ingestGraphReplyCandidates({
      messages: [graphMessage()],
      mailbox: "info@mccoy.nl",
    });

    expect(result).toMatchObject({ appended: 1, unmatched: 0 });
    expect(upsertWebsiteRequestMailMessage).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req-1", direction: "inbound", graphMessageId: "g-in" }),
    );
    expect(recordUnmatchedInboundMail).not.toHaveBeenCalled();
    expect(resolveUnmatchedInboundMail).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req-1", graphMessageId: "g-in" }),
    );
  });

  it("ignores mail whose WR token does not identify an existing request", async () => {
    // Another customer's reply: same form-kind subject, unknown conversation, no
    // In-Reply-To pointing at anything we sent.
    const result = await ingestGraphReplyCandidates({
      messages: [
        graphMessage({
          id: "g-foreign",
          conversationId: "conv-other",
          internetMessageId: "<foreign@benerink.nl>",
          subject: "RE: Offerte meubelreiniging (WR-2026-00055)",
          from: { emailAddress: { address: "yvonne@benerink.nl" } },
        }),
      ],
      mailbox: "info@mccoy.nl",
    });

    expect(result).toMatchObject({ appended: 0, unmatched: 0 });
    expect(upsertWebsiteRequestMailMessage).not.toHaveBeenCalled();
    expect(recordUnmatchedInboundMail).not.toHaveBeenCalled();
  });

  it("queues ambiguous mail with its candidate requests and attaches nothing", async () => {
    listKnownMailIdentitiesForMailbox.mockResolvedValue([
      knownRequest,
      { ...knownRequest, inquiryId: "req-2", requestNumber: "WR-2026-00073" },
    ]);

    const result = await ingestGraphReplyCandidates({
      messages: [graphMessage({ id: "g-ambiguous" })],
      mailbox: "info@mccoy.nl",
    });

    expect(result).toMatchObject({ appended: 0, unmatched: 1 });
    expect(upsertWebsiteRequestMailMessage).not.toHaveBeenCalled();
    expect(recordUnmatchedInboundMail).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "ambiguous",
        candidateRequestIds: ["req-1", "req-2"],
      }),
    );
  });

  it("does not attach a reply whose token cites another request", async () => {
    findWebsiteRequestIdByNumber.mockResolvedValue("req-1");
    getWebsiteRequest.mockResolvedValue({
      id: "req-1",
      number: "WR-2026-00072",
      status: "open",
      submitterEmail: "mike@example.com",
    });

    const result = await ingestGraphReplyCandidates({
      messages: [
        graphMessage({
          id: "g-token-only",
          conversationId: "conv-unknown",
          subject: "RE: Offerte meubelreiniging (WR-2026-00072)",
          from: { emailAddress: { address: "stranger@example.com" } },
        }),
      ],
      mailbox: "info@mccoy.nl",
    });

    expect(result).toMatchObject({ appended: 0, unmatched: 1 });
    expect(upsertWebsiteRequestMailMessage).not.toHaveBeenCalled();
  });

  it("ignores ordinary mailbox mail when no request identity or WR number exists", async () => {
    listKnownMailIdentitiesForMailbox.mockResolvedValue([]);

    const result = await ingestGraphReplyCandidates({
      messages: [
        graphMessage({
          id: "g-ordinary",
          subject: "Vraag over openingstijden",
          conversationId: "conv-ordinary",
          internetMessageId: "<ordinary@example.com>",
          from: { emailAddress: { address: "visitor@example.com" } },
        }),
      ],
      mailbox: "info@mccoy.nl",
    });

    expect(result).toMatchObject({ appended: 0, unmatched: 0 });
    expect(upsertWebsiteRequestMailMessage).not.toHaveBeenCalled();
    expect(recordUnmatchedInboundMail).not.toHaveBeenCalled();
  });

  it("recovers an exact WR reply from the request submitter when identity history is absent", async () => {
    listKnownMailIdentitiesForMailbox.mockResolvedValue([]);
    findWebsiteRequestIdByNumber.mockResolvedValue("req-1");
    getWebsiteRequest.mockResolvedValue({
      id: "req-1",
      number: "WR-2026-00072",
      status: "closed",
      submitterEmail: "mike@example.com",
    });

    const result = await ingestGraphReplyCandidates({
      messages: [graphMessage({ conversationId: "new-conversation" })],
      mailbox: "info@mccoy.nl",
    });

    expect(result).toMatchObject({ appended: 1, unmatched: 0 });
    expect(upsertWebsiteRequestMailMessage).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req-1", direction: "inbound" }),
    );
  });

  it("quarantines a same-address WR message when Exchange reports DMARC failure", async () => {
    listKnownMailIdentitiesForMailbox.mockResolvedValue([]);
    findWebsiteRequestIdByNumber.mockResolvedValue("req-1");
    getWebsiteRequest.mockResolvedValue({
      id: "req-1",
      number: "WR-2026-00072",
      status: "open",
      submitterEmail: "mike@example.com",
    });

    const result = await ingestGraphReplyCandidates({
      messages: [
        graphMessage({
          conversationId: "new-conversation",
          internetMessageHeaders: [
            {
              name: "Authentication-Results",
              value: "spf=fail; dkim=fail; dmarc=fail header.from=example.com",
            },
          ],
        }),
      ],
      mailbox: "info@mccoy.nl",
    });

    expect(result).toMatchObject({ appended: 0, unmatched: 1, participantRejected: 0 });
    expect(upsertWebsiteRequestMailMessage).not.toHaveBeenCalled();
  });

  it("does not let an exact reply id bypass an explicit DMARC failure", async () => {
    const result = await ingestGraphReplyCandidates({
      messages: [
        graphMessage({
          conversationId: "new-conversation",
          internetMessageHeaders: [
            { name: "In-Reply-To", value: "<admin-reply@mccoy.nl>" },
            {
              name: "Authentication-Results",
              value: "spf=fail; dkim=fail; dmarc=fail header.from=example.com",
            },
          ],
        }),
      ],
      mailbox: "info@mccoy.nl",
    });

    expect(result).toMatchObject({ appended: 0, unmatched: 1, participantRejected: 1 });
    expect(upsertWebsiteRequestMailMessage).not.toHaveBeenCalled();
  });

  it("accepts an exact known In-Reply-To chain when authentication headers are unavailable", async () => {
    const result = await ingestGraphReplyCandidates({
      messages: [
        graphMessage({
          conversationId: "other-conversation",
          internetMessageHeaders: [{ name: "In-Reply-To", value: "<admin-reply@mccoy.nl>" }],
        }),
      ],
      mailbox: "info@mccoy.nl",
    });

    expect(result).toMatchObject({ appended: 1, participantRejected: 0 });
    expect(upsertWebsiteRequestMailMessage).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: "req-1", inReplyTo: "<admin-reply@mccoy.nl>" }),
    );
  });

  it("accepts an alternate sender only through the exact Graph reply parent", async () => {
    findWebsiteRequestIdByNumber.mockResolvedValue("req-1");
    getWebsiteRequest.mockResolvedValue({
      id: "req-1",
      number: "WR-2026-00072",
      status: "open",
      submitterEmail: "mike@example.com",
    });
    getGraphReplyParentContext.mockResolvedValue({
      inReplyTo: "<admin-reply@mccoy.nl>",
      references: ["<admin-reply@mccoy.nl>"],
      parent: {
        id: "g-admin",
        subject: "Aanvraag (WR-2026-00072)",
        bodyPreview: "Antwoord voor WR-2026-00072",
        internetMessageId: "<admin-reply@mccoy.nl>",
        conversationId: "conv-1",
        fromAddress: "info@mccoy.nl",
        toAddresses: ["mike@example.com"],
      },
    });

    const result = await ingestGraphReplyCandidates({
      messages: [
        graphMessage({
          from: { emailAddress: { address: "mike-alias@example.net" } },
          toRecipients: [{ emailAddress: { address: "info@mccoy.nl" } }],
        }),
      ],
      mailbox: "info@mccoy.nl",
    });

    expect(result).toMatchObject({ appended: 1, unmatched: 0, participantRejected: 0 });
    expect(upsertWebsiteRequestMailMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: "req-1",
        inReplyTo: "<admin-reply@mccoy.nl>",
        referencesHeader: "<admin-reply@mccoy.nl>",
      }),
    );
  });

  it("does not resurrect a deleted request referenced by WR number", async () => {
    listKnownMailIdentitiesForMailbox.mockResolvedValue([]);
    findWebsiteRequestIdByNumber.mockResolvedValue("req-deleted");
    getWebsiteRequest.mockResolvedValue({
      id: "req-deleted",
      number: "WR-2026-00072",
      status: "deleted",
      submitterEmail: "mike@example.com",
    });

    const result = await ingestGraphReplyCandidates({
      messages: [graphMessage({ conversationId: "new-conversation" })],
      mailbox: "info@mccoy.nl",
    });

    expect(result).toMatchObject({ appended: 0, unmatched: 0 });
    expect(upsertWebsiteRequestMailMessage).not.toHaveBeenCalled();
    expect(recordUnmatchedInboundMail).not.toHaveBeenCalled();
  });

  it("resolves a stale diagnostic when the message was already attached", async () => {
    const result = await ingestGraphReplyCandidates({
      messages: [graphMessage({ id: "g-admin" })],
      mailbox: "info@mccoy.nl",
    });

    expect(result).toMatchObject({ appended: 0, alreadyProcessed: 1, unmatched: 0 });
    expect(resolveUnmatchedInboundMail).toHaveBeenCalledWith({
      mailbox: "info@mccoy.nl",
      graphMessageId: "g-admin",
      internetMessageId: "<in@example.com>",
      requestId: "req-1",
    });
  });

  it("quarantines an already-stored Graph message when its sender is not the request submitter", async () => {
    const result = await ingestGraphReplyCandidates({
      messages: [
        graphMessage({
          id: "g-admin",
          from: { emailAddress: { address: "other-customer@example.com" } },
        }),
      ],
      mailbox: "info@mccoy.nl",
    });

    expect(result).toMatchObject({
      appended: 0,
      alreadyProcessed: 0,
      unmatched: 1,
      participantRejected: 1,
    });
    expect(upsertWebsiteRequestMailMessage).not.toHaveBeenCalled();
    expect(recordUnmatchedInboundMail).toHaveBeenCalledWith(
      expect.objectContaining({
        graphMessageId: "g-admin",
        senderAddress: "other-customer@example.com",
        reason: "unmatched",
      }),
    );
  });
});
