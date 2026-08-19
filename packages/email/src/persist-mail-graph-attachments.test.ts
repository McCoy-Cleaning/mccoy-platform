import { beforeEach, describe, expect, it, vi } from "vitest";

const listGraphFormInboxAttachments = vi.fn();
const updateWebsiteRequestMailMessageAttachments = vi.fn();

vi.mock("./graph-mail", () => ({
  listGraphFormInboxAttachments: (...args: unknown[]) => listGraphFormInboxAttachments(...args),
}));

vi.mock("@mccoy/database/server", () => ({
  updateWebsiteRequestMailMessageAttachments: (...args: unknown[]) =>
    updateWebsiteRequestMailMessageAttachments(...args),
}));

import { persistMailMessageGraphAttachments } from "./persist-mail-graph-attachments";

describe("persistMailMessageGraphAttachments", () => {
  beforeEach(() => {
    listGraphFormInboxAttachments.mockReset();
    updateWebsiteRequestMailMessageAttachments.mockReset();
    updateWebsiteRequestMailMessageAttachments.mockResolvedValue(true);
  });

  it("stores Graph filename, type, size, and attachment id on the mail row", async () => {
    listGraphFormInboxAttachments.mockResolvedValue([
      {
        filename: "IMG_1234.JPG",
        contentType: "image/jpeg",
        size: 240_000,
        omitted: false,
        part: "AAMk-photo",
      },
    ]);

    const stored = await persistMailMessageGraphAttachments({
      mailMessageId: "mail-in",
      graphMessageId: "g-in",
      mailbox: "info@mccoy.nl",
    });

    expect(listGraphFormInboxAttachments).toHaveBeenCalledWith("g-in", "info@mccoy.nl");
    expect(updateWebsiteRequestMailMessageAttachments).toHaveBeenCalledWith("mail-in", [
      {
        filename: "IMG_1234.JPG",
        contentType: "image/jpeg",
        size: 240_000,
        graphAttachmentId: "AAMk-photo",
      },
    ]);
    expect(stored).toHaveLength(1);
  });
});
