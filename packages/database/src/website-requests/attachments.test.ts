import { describe, expect, it } from "vitest";

import {
  isWebsiteRequestUploadStoragePath,
  websiteRequestAttachmentStoragePath,
} from "./attachments";

describe("website request attachment storage paths", () => {
  it("keeps every request in its own private prefix", () => {
    expect(
      websiteRequestAttachmentStoragePath(
        "11111111-1111-4111-8111-111111111111",
        "situatie (2).webp",
      ),
    ).toBe("11111111-1111-4111-8111-111111111111/situatie%20(2).webp");
  });

  it("rejects path traversal and non-request ids", () => {
    expect(() =>
      websiteRequestAttachmentStoragePath("11111111-1111-4111-8111-111111111111", "../secret.pdf"),
    ).toThrow(/filename/i);
    expect(() => websiteRequestAttachmentStoragePath("not-a-uuid", "cv.pdf")).toThrow(/id/i);
  });

  it("accepts only server-shaped direct-upload paths", () => {
    expect(
      isWebsiteRequestUploadStoragePath(
        "uploads/11111111-1111-4111-8111-111111111111/01-photo%20front.jpg",
      ),
    ).toBe(true);
    expect(isWebsiteRequestUploadStoragePath("uploads/not-a-uuid/01-photo.jpg")).toBe(false);
    expect(
      isWebsiteRequestUploadStoragePath(
        "uploads/11111111-1111-4111-8111-111111111111/../../secret",
      ),
    ).toBe(false);
  });
});
