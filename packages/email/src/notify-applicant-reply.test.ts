import { beforeEach, describe, expect, it, vi } from "vitest";

const getWebsiteRequest = vi.fn();
const setWebsiteRequestStatus = vi.fn();
const enqueueNotificationOutbox = vi.fn();
const processNotificationOutbox = vi.fn();

vi.mock("@mccoy/database/server", () => ({
  getWebsiteRequest: (...args: unknown[]) => getWebsiteRequest(...args),
  setWebsiteRequestStatus: (...args: unknown[]) => setWebsiteRequestStatus(...args),
  enqueueNotificationOutbox: (...args: unknown[]) => enqueueNotificationOutbox(...args),
  processNotificationOutbox: (...args: unknown[]) => processNotificationOutbox(...args),
}));

import { notifyApplicantReplyAppended } from "./notify-applicant-reply";

const input = {
  requestId: "11111111-1111-1111-1111-111111111111",
  mailMessageId: "mail-1",
  mailbox: "info@mccoy.nl",
  senderAddress: "ada@example.com",
};

describe("notifyApplicantReplyAppended lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setWebsiteRequestStatus.mockResolvedValue({ id: input.requestId, status: "open" });
    enqueueNotificationOutbox.mockResolvedValue(undefined);
    processNotificationOutbox.mockResolvedValue(undefined);
  });

  it("reopens a resolved request and makes the notification explicit", async () => {
    getWebsiteRequest.mockResolvedValue({
      id: input.requestId,
      number: "WR-2026-00001",
      status: "closed",
      submitterName: "Ada",
    });

    await notifyApplicantReplyAppended(input);

    expect(setWebsiteRequestStatus).toHaveBeenCalledWith(input.requestId, "open");
    expect(enqueueNotificationOutbox).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Ada heeft gereageerd op een afgeronde aanvraag.",
        metadata: expect.objectContaining({ reopenedFromResolved: true }),
      }),
    );
  });

  it.each(["deleted", "spam"] as const)(
    "never reopens or notifies a %s request",
    async (status) => {
      getWebsiteRequest.mockResolvedValue({
        id: input.requestId,
        number: "WR-2026-00001",
        status,
        submitterName: "Ada",
      });

      await notifyApplicantReplyAppended(input);

      expect(setWebsiteRequestStatus).not.toHaveBeenCalled();
      expect(enqueueNotificationOutbox).not.toHaveBeenCalled();
    },
  );
});
