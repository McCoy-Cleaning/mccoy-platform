import { describe, expect, it } from "vitest";

import {
  isWebsiteRequestUploadStoragePath,
  isWebsiteRequestAttachmentPathOwnedByRequest,
  reservedWebsiteFormUploadBytes,
  sanitizeAttachmentFilename,
  sanitizeStorageObjectName,
  uniqueStorageObjectName,
  websiteRequestAttachmentStoragePath,
  websiteRequestUploadStorageFilename,
} from "./attachments";

describe("website request attachment storage paths", () => {
  it("keeps every request in its own private prefix without URL-encoding the key", () => {
    expect(
      websiteRequestAttachmentStoragePath(
        "11111111-1111-4111-8111-111111111111",
        "situatie (2).webp",
      ),
    ).toBe("11111111-1111-4111-8111-111111111111/situatie_2.webp");
  });

  it("never puts encodeURIComponent output or % into a storage object key", () => {
    const path = websiteRequestAttachmentStoragePath(
      "11111111-1111-4111-8111-111111111111",
      "Broker side 1.pdf",
    );
    expect(path).toBe("11111111-1111-4111-8111-111111111111/Broker_side_1.pdf");
    expect(path).not.toContain("%");
    expect(path).not.toContain(encodeURIComponent("Broker side 1.pdf"));
  });

  it("strips percent signs that would make Supabase reject the key", () => {
    expect(sanitizeStorageObjectName("100%.pdf")).toBe("100.pdf");
    expect(sanitizeStorageObjectName("Broker%20side%201.pdf")).toBe("Broker_side_1.pdf");
  });

  it("keeps a human filename for admin download names", () => {
    expect(sanitizeAttachmentFilename("Broker side 1.pdf")).toBe("Broker side 1.pdf");
    expect(sanitizeAttachmentFilename("Broker%20side%201.pdf")).toBe("Broker side 1.pdf");
  });

  it("disambiguates colliding sanitized object names", () => {
    const used = new Set<string>();
    expect(uniqueStorageObjectName("Broker side 1.pdf", used)).toBe("Broker_side_1.pdf");
    expect(uniqueStorageObjectName("Broker_side_1.pdf", used)).toBe("Broker_side_1-2.pdf");
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
        "uploads/11111111-1111-4111-8111-111111111111/01-photo_front.jpg",
      ),
    ).toBe(true);
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

  it("reads the object name from a staged upload path", () => {
    expect(
      websiteRequestUploadStorageFilename(
        "uploads/11111111-1111-4111-8111-111111111111/01-Broker_side_1.pdf",
      ),
    ).toBe("Broker_side_1.pdf");
  });

  it("never accepts another request's durable storage path", () => {
    const requestId = "11111111-1111-4111-8111-111111111111";
    expect(isWebsiteRequestAttachmentPathOwnedByRequest(requestId, `${requestId}/photo.webp`)).toBe(
      true,
    );
    expect(
      isWebsiteRequestAttachmentPathOwnedByRequest(
        requestId,
        "22222222-2222-4222-8222-222222222222/photo.webp",
      ),
    ).toBe(false);
    expect(
      isWebsiteRequestAttachmentPathOwnedByRequest(
        requestId,
        "uploads/11111111-1111-4111-8111-111111111111/01-photo.webp",
      ),
    ).toBe(false);
  });

  it("reserves the full storage exposure instead of trusting claimed byte sizes", () => {
    expect(reservedWebsiteFormUploadBytes(0)).toBe(0);
    expect(reservedWebsiteFormUploadBytes(8)).toBe(200 * 1024 * 1024);
    expect(() => reservedWebsiteFormUploadBytes(9)).toThrow(/count/i);
    expect(() => reservedWebsiteFormUploadBytes(1.5)).toThrow(/count/i);
  });
});
