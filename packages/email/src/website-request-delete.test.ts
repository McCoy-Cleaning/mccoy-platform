import { describe, expect, it, vi, beforeEach } from "vitest";

const setWebsiteRequestStatus = vi.fn();
const getWebsiteRequest = vi.fn();
const listWebsiteRequestMailMessages = vi.fn();
const findWebsiteRequestIdByGraphMessageId = vi.fn();
const findWebsiteRequestIdByNumber = vi.fn();
const deleteGraphFormInboxMessage = vi.fn();
const shouldAttemptGraphMail = vi.fn();
const getGraphMailConfig = vi.fn();
const peekGraphMessageRequestNumber = vi.fn();

vi.mock("@mccoy/database/server", () => ({
  getWebsiteRequest: (...args: unknown[]) => getWebsiteRequest(...args),
  setWebsiteRequestStatus: (...args: unknown[]) => setWebsiteRequestStatus(...args),
  listWebsiteRequestMailMessages: (...args: unknown[]) =>
    listWebsiteRequestMailMessages(...args),
  findWebsiteRequestIdByGraphMessageId: (...args: unknown[]) =>
    findWebsiteRequestIdByGraphMessageId(...args),
  findWebsiteRequestIdByNumber: (...args: unknown[]) =>
    findWebsiteRequestIdByNumber(...args),
}));

vi.mock("./form-inbox-provider", () => ({
  shouldAttemptGraphMail: (...args: unknown[]) => shouldAttemptGraphMail(...args),
}));

vi.mock("./graph-config", () => ({
  getGraphMailConfig: (...args: unknown[]) => getGraphMailConfig(...args),
}));

vi.mock("./graph-mail", () => ({
  deleteGraphFormInboxMessage: (...args: unknown[]) => deleteGraphFormInboxMessage(...args),
  peekGraphMessageRequestNumber: (...args: unknown[]) => peekGraphMessageRequestNumber(...args),
}));

import {
  closeWebsiteRequestForGraphMessage,
  deleteWebsiteRequestFormInboxMessage,
} from "./website-request-inbox";

describe("deleteWebsiteRequestFormInboxMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getWebsiteRequest.mockResolvedValue({
      id: "req-1",
      number: "WR-2026-00001",
      status: "new",
    });
    setWebsiteRequestStatus.mockResolvedValue({
      id: "req-1",
      number: "WR-2026-00001",
      status: "closed",
    });
    shouldAttemptGraphMail.mockReturnValue(true);
    getGraphMailConfig.mockReturnValue({ mailbox: "info@mccoy.nl" });
    listWebsiteRequestMailMessages.mockResolvedValue([
      { graph_message_id: "g1", mailbox: "info@mccoy.nl" },
      { graph_message_id: "g1", mailbox: "info@mccoy.nl" },
      { graph_message_id: "g2", mailbox: "info@mccoy.nl" },
    ]);
    deleteGraphFormInboxMessage.mockResolvedValue(undefined);
  });

  it("closes the website request and deletes unique Graph copies", async () => {
    await deleteWebsiteRequestFormInboxMessage(
      "req:website-requests:11111111-1111-1111-1111-111111111111",
    );

    expect(getWebsiteRequest).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
    expect(setWebsiteRequestStatus).toHaveBeenCalledWith("req-1", "closed");
    expect(deleteGraphFormInboxMessage).toHaveBeenCalledTimes(2);
    expect(deleteGraphFormInboxMessage).toHaveBeenCalledWith("g1", "info@mccoy.nl");
    expect(deleteGraphFormInboxMessage).toHaveBeenCalledWith("g2", "info@mccoy.nl");
  });

  it("still succeeds when Graph cleanup fails", async () => {
    deleteGraphFormInboxMessage.mockRejectedValue(new Error("403"));
    await expect(
      deleteWebsiteRequestFormInboxMessage(
        "req:website-requests:11111111-1111-1111-1111-111111111111",
      ),
    ).resolves.toBeUndefined();
    expect(setWebsiteRequestStatus).toHaveBeenCalledWith("req-1", "closed");
  });
});

describe("closeWebsiteRequestForGraphMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findWebsiteRequestIdByGraphMessageId.mockResolvedValue("req-1");
    getWebsiteRequest.mockResolvedValue({
      id: "req-1",
      number: "WR-1",
      status: "new",
    });
    setWebsiteRequestStatus.mockResolvedValue({
      id: "req-1",
      status: "closed",
    });
  });

  it("closes by graph message id lookup", async () => {
    const closed = await closeWebsiteRequestForGraphMessage("graph-abc");
    expect(closed).toBe(true);
    expect(setWebsiteRequestStatus).toHaveBeenCalledWith("req-1", "closed");
  });

  it("falls back to WR number from Graph subject", async () => {
    findWebsiteRequestIdByGraphMessageId.mockResolvedValue(null);
    peekGraphMessageRequestNumber.mockResolvedValue("WR-99");
    findWebsiteRequestIdByNumber.mockResolvedValue("req-99");
    getWebsiteRequest.mockResolvedValue({
      id: "req-99",
      number: "WR-99",
      status: "new",
    });
    setWebsiteRequestStatus.mockResolvedValue({ id: "req-99", status: "closed" });

    const closed = await closeWebsiteRequestForGraphMessage("graph-xyz", "info@mccoy.nl");
    expect(closed).toBe(true);
    expect(peekGraphMessageRequestNumber).toHaveBeenCalledWith("graph-xyz", "info@mccoy.nl");
    expect(findWebsiteRequestIdByNumber).toHaveBeenCalledWith("WR-99");
    expect(setWebsiteRequestStatus).toHaveBeenCalledWith("req-99", "closed");
  });

  it("returns true when already closed", async () => {
    getWebsiteRequest.mockResolvedValue({
      id: "req-1",
      status: "closed",
    });
    const closed = await closeWebsiteRequestForGraphMessage("graph-abc");
    expect(closed).toBe(true);
    expect(setWebsiteRequestStatus).not.toHaveBeenCalled();
  });
});
