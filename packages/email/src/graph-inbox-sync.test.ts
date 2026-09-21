import { beforeEach, describe, expect, it, vi } from "vitest";

const findWebsiteRequestIdByNumber = vi.fn();
const upsertWebsiteRequestMailMessage = vi.fn();
const ingestGraphReplyCandidates = vi.fn();

vi.mock("@mccoy/database/server", () => ({
  findWebsiteRequestIdByNumber: (...args: unknown[]) => findWebsiteRequestIdByNumber(...args),
  upsertWebsiteRequestMailMessage: (...args: unknown[]) => upsertWebsiteRequestMailMessage(...args),
}));

vi.mock("./graph-config", () => ({
  getGraphMailConfig: () => ({ mailbox: "info@mccoy.nl" }),
}));

vi.mock("./ingest-graph-replies", () => ({
  ingestGraphReplyCandidates: (...args: unknown[]) => ingestGraphReplyCandidates(...args),
}));

import { syncGraphInboxAfterList } from "./graph-inbox-sync";

beforeEach(() => {
  vi.clearAllMocks();
  findWebsiteRequestIdByNumber.mockResolvedValue(null);
  upsertWebsiteRequestMailMessage.mockResolvedValue(null);
  ingestGraphReplyCandidates.mockResolvedValue({
    appended: 0,
    alreadyProcessed: 0,
    unmatched: 0,
    participantRejected: 0,
  });
});

describe("syncGraphInboxAfterList", () => {
  it("passes non-form Inbox messages to the request identity resolver", async () => {
    const result = await syncGraphInboxAfterList({
      mailbox: "info@mccoy.nl",
      candidates: [
        {
          id: "graph-ordinary",
          subject: "Vraag over openingstijden",
          bodyPreview: "Zijn jullie zaterdag open?",
          receivedDateTime: "2026-09-21T10:00:00.000Z",
          internetMessageId: "<ordinary@example.com>",
          conversationId: "conversation-ordinary",
          fromAddress: "visitor@example.com",
          toAddresses: ["info@mccoy.nl"],
          internetMessageHeaders: [{ name: "X-Test", value: "safe" }],
          isFormCandidate: false,
        },
      ],
    });

    expect(result.replies.unmatched).toBe(0);
    expect(ingestGraphReplyCandidates).toHaveBeenCalledWith({
      mailbox: "info@mccoy.nl",
      messages: [
        expect.objectContaining({
          id: "graph-ordinary",
          subject: "Vraag over openingstijden",
          from: { emailAddress: { address: "visitor@example.com" } },
          toRecipients: [{ emailAddress: { address: "info@mccoy.nl" } }],
          internetMessageHeaders: [{ name: "X-Test", value: "safe" }],
        }),
      ],
    });
  });
});
