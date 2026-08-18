import { describe, expect, it } from "vitest";
import type { FormInboxAttachment, ParsedFormField } from "@mccoy/email/contracts";
import {
  isPreviewableImageAttachment,
  partitionFormAttachments,
  shouldHideAttachmentFieldText,
} from "../lib/form-field-attachments";

function field(key: string, value: string, label = key): ParsedFormField {
  return { key, label, value };
}

function attachment(
  filename: string,
  contentType: string,
  size = 128,
): FormInboxAttachment {
  return { filename, contentType, size, omitted: true };
}

describe("isPreviewableImageAttachment", () => {
  it("accepts raster MIME types and image extensions", () => {
    expect(isPreviewableImageAttachment(attachment("a.jpg", "image/jpeg"))).toBe(true);
    expect(isPreviewableImageAttachment(attachment("b.PNG", "application/octet-stream"))).toBe(
      true,
    );
    expect(isPreviewableImageAttachment(attachment("cv.pdf", "application/pdf"))).toBe(false);
  });
});

describe("partitionFormAttachments", () => {
  it("maps photos listed in a form field onto that row", () => {
    const result = partitionFormAttachments(
      [
        field("name", "Jan"),
        field("photos", "voor.jpg, na.png"),
        field("message", "Reiniging gevel"),
      ],
      [
        attachment("voor.jpg", "image/jpeg"),
        attachment("na.png", "image/png"),
        attachment("cv.pdf", "application/pdf"),
      ],
    );

    expect(result.imagesByFieldKey.get("photos")?.map((item) => item.filename)).toEqual([
      "voor.jpg",
      "na.png",
    ]);
    expect(result.unmappedImages).toEqual([]);
    expect(result.fileAttachments.map((item) => item.filename)).toEqual(["cv.pdf"]);
  });

  it("maps a data-URL field key onto photos.jpg-style attachments", () => {
    const result = partitionFormAttachments(
      [field("photos", "data:image/jpeg;base64,AAAA")],
      [attachment("photos.jpg", "image/jpeg")],
    );

    expect(result.imagesByFieldKey.get("photos")?.map((item) => item.filename)).toEqual([
      "photos.jpg",
    ]);
    expect(result.unmappedImages).toEqual([]);
  });

  it("collects leftover images when no field mapping exists", () => {
    const result = partitionFormAttachments(
      [field("name", "Jan"), field("message", "Hallo")],
      [attachment("situatie.jpg", "image/jpeg"), attachment("offerte.pdf", "application/pdf")],
    );

    expect(result.imagesByFieldKey.size).toBe(0);
    expect(result.unmappedImages.map((item) => item.filename)).toEqual(["situatie.jpg"]);
    expect(result.fileAttachments.map((item) => item.filename)).toEqual(["offerte.pdf"]);
  });

  it("does not attach leftover photos to ordinary text fields", () => {
    const result = partitionFormAttachments(
      [field("company", "McCoy"), field("message", "Zie de foto van de gevel")],
      [attachment("company-logo.jpg", "image/jpeg")],
    );

    expect(result.imagesByFieldKey.size).toBe(0);
    expect(result.unmappedImages.map((item) => item.filename)).toEqual(["company-logo.jpg"]);
  });

  it("assigns leftover images to a single photos field", () => {
    const result = partitionFormAttachments(
      [field("photos", ""), field("name", "Jan")],
      [attachment("gevel.webp", "image/webp")],
    );

    expect(result.imagesByFieldKey.get("photos")?.map((item) => item.filename)).toEqual([
      "gevel.webp",
    ]);
    expect(result.unmappedImages).toEqual([]);
  });
});

describe("shouldHideAttachmentFieldText", () => {
  it("hides data URLs and filename lists that match mapped images", () => {
    const images = [attachment("voor.jpg", "image/jpeg")];
    expect(shouldHideAttachmentFieldText("data:image/jpeg;base64,AAAA", images)).toBe(true);
    expect(shouldHideAttachmentFieldText("voor.jpg", images)).toBe(true);
    expect(shouldHideAttachmentFieldText("Reiniging van de gevel", images)).toBe(false);
  });
});
