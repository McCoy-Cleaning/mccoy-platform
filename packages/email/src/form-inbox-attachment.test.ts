import { describe, expect, it } from "vitest";
import {
  MAX_FORM_INBOX_ATTACHMENT_BYTES,
  approxBytesFromBase64,
  attachmentFilenamesMatch,
  attachmentSizesMatch,
  classifyFormInboxAttachmentDownload,
  decodeAttachmentFilename,
  formInboxAttachmentDownloadErrorMessage,
  mergeFormInboxAttachmentLists,
  pickFormInboxAttachmentForDownload,
  sanitizeAttachmentFilename,
} from "./form-inbox-attachment";
import type { FormInboxAttachment } from "./form-inbox-contracts";

function att(partial: Partial<FormInboxAttachment>): FormInboxAttachment {
  return {
    filename: "cv.pdf",
    contentType: "application/pdf",
    size: 1024,
    ...partial,
  };
}

describe("sanitizeAttachmentFilename / attachmentFilenamesMatch", () => {
  it("sanitizes unsafe characters like Graph list metadata", () => {
    expect(sanitizeAttachmentFilename("CV Jorien/2020?.pdf")).toBe("CV Jorien_2020_.pdf");
  });

  it("matches request meta names against Graph-sanitized names", () => {
    expect(
      attachmentFilenamesMatch(
        "Curriculum Vitae Jorien 20201 (1).doc",
        "Curriculum Vitae Jorien 20201 (1).doc",
      ),
    ).toBe(true);
    expect(attachmentFilenamesMatch("photo.JPEG", "photo.jpeg")).toBe(true);
    expect(attachmentFilenamesMatch("cv.pdf", "other.docx")).toBe(false);
  });

  it("picks the single Graph file when the listed name differs slightly", () => {
    expect(
      pickFormInboxAttachmentForDownload(
        [
          att({
            filename: "Curriculum_Vitae_Jorien_20201_1.doc",
            size: 33_000,
            omitted: true,
            part: "att-1",
          }),
        ],
        "Curriculum Vitae Jorien 20201 (1).doc",
      )?.part,
    ).toBe("att-1");
  });

  it("picks by size when Graph renamed the file and names do not match", () => {
    expect(attachmentSizesMatch(33_000, 33_400)).toBe(true);
    expect(
      pickFormInboxAttachmentForDownload(
        [
          att({ filename: "bijlage.doc", size: 33_000, omitted: true, part: "att-size" }),
          att({ filename: "logo.png", size: 4_200, omitted: true, part: "att-logo" }),
        ],
        "Curriculum Vitae Jorien 20201 (1).doc",
        33_000,
      )?.part,
    ).toBe("att-size");
  });

  it("merges Graph inline photos into the request attachment list", () => {
    const merged = mergeFormInboxAttachmentLists(
      [],
      [
        att({ filename: "situatie.jpg", contentType: "image/jpeg", size: 48_000 }),
        att({ filename: "situatie.jpg", contentType: "image/jpeg", size: 48_000 }),
      ],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]?.filename).toBe("situatie.jpg");
  });

  it("preserves distinct photos that happen to have the same byte size", () => {
    const merged = mergeFormInboxAttachmentLists(
      [
        att({ filename: "voor.jpg", contentType: "image/jpeg", size: 48_000 }),
        att({ filename: "na.jpg", contentType: "image/jpeg", size: 48_000 }),
      ],
      [],
    );

    expect(merged.map((item) => item.filename)).toEqual(["voor.jpg", "na.jpg"]);
  });

  it("decodes Graph RFC 2231 attachment names", () => {
    expect(decodeAttachmentFilename("UTF-8''Curriculum%20Vitae.doc")).toBe("Curriculum Vitae.doc");
  });
});

describe("classifyFormInboxAttachmentDownload", () => {
  it("classifies missing attachment as not_found", () => {
    expect(classifyFormInboxAttachmentDownload(null)).toEqual({ status: "not_found" });
    expect(classifyFormInboxAttachmentDownload(undefined)).toEqual({ status: "not_found" });
    expect(formInboxAttachmentDownloadErrorMessage({ status: "not_found" })).toContain(
      "niet gevonden",
    );
  });

  it("accepts PDF / photo payloads under the size cap", () => {
    const pdfBytes = Buffer.from("%PDF-1.4 tiny").toString("base64");
    const pdf = classifyFormInboxAttachmentDownload(
      att({
        filename: "sollicitatie.pdf",
        contentType: "application/pdf",
        size: 0,
        contentBase64: pdfBytes,
      }),
    );
    expect(pdf.status).toBe("ok");
    if (pdf.status === "ok") {
      expect(pdf.attachment.contentBase64).toBe(pdfBytes);
      expect(pdf.attachment.size).toBe(approxBytesFromBase64(pdfBytes));
      expect(pdf.attachment.omitted).toBe(false);
    }

    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString("base64");
    const photo = classifyFormInboxAttachmentDownload(
      att({
        filename: "portret.jpg",
        contentType: "image/jpeg",
        size: 4,
        contentBase64: jpegBytes,
      }),
    );
    expect(photo.status).toBe("ok");
  });

  it("classifies omitted / oversize as too_large", () => {
    const oversize = classifyFormInboxAttachmentDownload(
      att({
        size: MAX_FORM_INBOX_ATTACHMENT_BYTES + 1,
        omitted: true,
        contentBase64: undefined,
      }),
    );
    expect(oversize.status).toBe("too_large");

    const hugeBase64 = "A".repeat(Math.ceil(((MAX_FORM_INBOX_ATTACHMENT_BYTES + 10) * 4) / 3));
    const fromBytes = classifyFormInboxAttachmentDownload(
      att({ size: 0, contentBase64: hugeBase64 }),
    );
    expect(fromBytes.status).toBe("too_large");
    expect(
      formInboxAttachmentDownloadErrorMessage({
        status: "too_large",
        attachment: att({ omitted: true, size: MAX_FORM_INBOX_ATTACHMENT_BYTES + 1 }),
      }),
    ).toMatch(/te groot/i);
    expect(
      formInboxAttachmentDownloadErrorMessage({
        status: "too_large",
        attachment: att({ omitted: true, size: MAX_FORM_INBOX_ATTACHMENT_BYTES + 1 }),
      }),
    ).not.toMatch(/niet gevonden/i);
  });

  it("does not call a 33KB meta-only CV too large", () => {
    const result = classifyFormInboxAttachmentDownload(
      att({
        filename: "Curriculum Vitae Jorien 20201 (1).doc",
        size: 33_000,
        omitted: true,
        contentBase64: undefined,
      }),
    );
    expect(result.status).toBe("unavailable");
    expect(formInboxAttachmentDownloadErrorMessage(result)).not.toMatch(/te groot/i);
  });

  it("classifies meta-only (no bytes, not omitted) as unavailable", () => {
    const result = classifyFormInboxAttachmentDownload(
      att({ size: 33_000, omitted: false, contentBase64: undefined }),
    );
    expect(result.status).toBe("unavailable");
  });
});
