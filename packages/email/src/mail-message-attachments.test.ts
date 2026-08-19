import { describe, expect, it } from "vitest";
import {
  inboxAttachmentsToStored,
  storedMailAttachmentsToInbox,
} from "./mail-message-attachments";

describe("mail-message-attachments", () => {
  it("maps stored Graph metadata onto Gesprek attachment chips", () => {
    const inbox = storedMailAttachmentsToInbox([
      {
        filename: "IMG_1234.JPG",
        contentType: "image/jpeg",
        size: 240_000,
        graphAttachmentId: "AAMk-photo",
      },
      { filename: "setup.exe", contentType: "application/x-msdownload", size: 12 },
    ]);
    expect(inbox).toEqual([
      {
        filename: "IMG_1234.JPG",
        contentType: "image/jpeg",
        size: 240_000,
        omitted: false,
        part: "AAMk-photo",
      },
    ]);
  });

  it("round-trips Graph list payloads into JSON column shape", () => {
    const stored = inboxAttachmentsToStored([
      {
        filename: "keuken.jpg",
        contentType: "image/jpeg",
        size: 80_000,
        omitted: false,
        part: "a1",
      },
    ]);
    expect(stored).toEqual([
      {
        filename: "keuken.jpg",
        contentType: "image/jpeg",
        size: 80_000,
        graphAttachmentId: "a1",
      },
    ]);
    expect(storedMailAttachmentsToInbox(stored)[0]?.part).toBe("a1");
  });
});
