import { describe, expect, it } from "vitest";
import {
  assertSafeWebsiteFormUpload,
  WEBSITE_FORM_CV_FILE_ACCEPT,
  WEBSITE_FORM_MEDIA_FILE_ACCEPT,
} from "./website-form-upload";

function jpegBytes(): Uint8Array {
  return Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
}

function pngBytes(): Uint8Array {
  return Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
}

function pdfBytes(extra = ""): Uint8Array {
  return new TextEncoder().encode(`%PDF-1.4\n${extra}\ntrailer\n`);
}

function zipLikeOffice(extra = ""): Uint8Array {
  const text = `PK\u0003\u0004[Content_Types].xml word/document.xml${extra}`;
  return new TextEncoder().encode(text);
}

function oleDoc(extra = ""): Uint8Array {
  const header = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const tail = new TextEncoder().encode(extra);
  const out = new Uint8Array(header.length + tail.length);
  out.set(header, 0);
  out.set(tail, header.length);
  return out;
}

describe("assertSafeWebsiteFormUpload allowlist", () => {
  it("allows offerte image/pdf metadata and blocks svg/docx/exe", () => {
    expect(
      assertSafeWebsiteFormUpload({
        kind: "glass_washing",
        filename: "foto.jpg",
        contentType: "image/jpeg",
      }).ok,
    ).toBe(true);
    expect(
      assertSafeWebsiteFormUpload({
        kind: "furniture_cleaning",
        filename: "plattegrond.pdf",
        contentType: "application/pdf",
      }).ok,
    ).toBe(true);
    expect(
      assertSafeWebsiteFormUpload({
        kind: "inquiry",
        filename: "situatie.webp",
        contentType: "image/webp",
      }).ok,
    ).toBe(true);

    const svg = assertSafeWebsiteFormUpload({
      kind: "glass_washing",
      filename: "logo.svg",
      contentType: "image/svg+xml",
    });
    expect(svg.ok).toBe(false);
    if (!svg.ok) expect(svg.error).toMatch(/Bestand “logo\.svg”/);

    const docx = assertSafeWebsiteFormUpload({
      kind: "glass_washing",
      filename: "offerte.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    expect(docx.ok).toBe(false);

    const exe = assertSafeWebsiteFormUpload({
      kind: "inquiry",
      filename: "setup.exe",
      contentType: "application/octet-stream",
    });
    expect(exe.ok).toBe(false);
  });

  it("allows vacancy pdf/doc/docx and rejects jpeg", () => {
    expect(
      assertSafeWebsiteFormUpload({
        kind: "job_application",
        filename: "cv.pdf",
        contentType: "application/pdf",
      }).ok,
    ).toBe(true);
    expect(
      assertSafeWebsiteFormUpload({
        kind: "job_application",
        filename: "brief.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }).ok,
    ).toBe(true);

    const jpeg = assertSafeWebsiteFormUpload({
      kind: "job_application",
      filename: "foto.jpg",
      contentType: "image/jpeg",
    });
    expect(jpeg.ok).toBe(false);
    if (!jpeg.ok) expect(jpeg.error).toMatch(/Bestand “foto\.jpg”/);
  });

  it("rejects newsletter files and unknown kinds", () => {
    const news = assertSafeWebsiteFormUpload({
      kind: "newsletter",
      filename: "cv.pdf",
      contentType: "application/pdf",
    });
    expect(news.ok).toBe(false);

    const unknown = assertSafeWebsiteFormUpload({
      kind: "mystery",
      filename: "foto.jpg",
      contentType: "image/jpeg",
    });
    expect(unknown.ok).toBe(false);
  });

  it("exports accept strings without svg or wildcard images", () => {
    expect(WEBSITE_FORM_MEDIA_FILE_ACCEPT).not.toContain("image/*");
    expect(WEBSITE_FORM_MEDIA_FILE_ACCEPT).not.toContain("svg");
    expect(WEBSITE_FORM_MEDIA_FILE_ACCEPT).toContain("image/jpeg");
    expect(WEBSITE_FORM_MEDIA_FILE_ACCEPT).toContain("application/pdf");
    expect(WEBSITE_FORM_CV_FILE_ACCEPT).toBe(".pdf,.doc,.docx");
  });
});

describe("assertSafeWebsiteFormUpload magic bytes", () => {
  it("accepts real jpeg/png/pdf/docx-like zip", () => {
    expect(
      assertSafeWebsiteFormUpload({
        kind: "glass_washing",
        filename: "foto.jpg",
        contentType: "image/jpeg",
        bytes: jpegBytes(),
      }),
    ).toEqual({ ok: true, detectedType: "jpeg" });

    expect(
      assertSafeWebsiteFormUpload({
        kind: "inquiry",
        filename: "situatie.png",
        contentType: "image/png",
        bytes: pngBytes(),
      }),
    ).toEqual({ ok: true, detectedType: "png" });

    expect(
      assertSafeWebsiteFormUpload({
        kind: "furniture_cleaning",
        filename: "plattegrond.pdf",
        contentType: "application/pdf",
        bytes: pdfBytes(),
      }),
    ).toEqual({ ok: true, detectedType: "pdf" });

    expect(
      assertSafeWebsiteFormUpload({
        kind: "job_application",
        filename: "cv.docx",
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        bytes: zipLikeOffice(),
      }),
    ).toEqual({ ok: true, detectedType: "docx" });
  });

  it("rejects MZ renamed to pdf", () => {
    const mz = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00]);
    const result = assertSafeWebsiteFormUpload({
      kind: "job_application",
      filename: "cv.pdf",
      contentType: "application/pdf",
      bytes: mz,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/onveilig|geblokkeerd/);
  });

  it("rejects SVG pretending to be png", () => {
    const svg = new TextEncoder().encode(
      '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>',
    );
    const result = assertSafeWebsiteFormUpload({
      kind: "glass_washing",
      filename: "foto.png",
      contentType: "image/png",
      bytes: svg,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a jpeg uploaded as a vacancy file", () => {
    const result = assertSafeWebsiteFormUpload({
      kind: "job_application",
      filename: "foto.jpg",
      contentType: "image/jpeg",
      bytes: jpegBytes(),
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a docx on an offerte form", () => {
    const result = assertSafeWebsiteFormUpload({
      kind: "glass_washing",
      filename: "offerte.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: zipLikeOffice(),
    });
    expect(result.ok).toBe(false);
  });

  it("rejects declared/extension mismatch against detected bytes", () => {
    const result = assertSafeWebsiteFormUpload({
      kind: "inquiry",
      filename: "foto.png",
      contentType: "image/png",
      bytes: jpegBytes(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/komt niet overeen/);
  });
});

describe("assertSafeWebsiteFormUpload dangerous content", () => {
  it("rejects PDF with /JavaScript", () => {
    const result = assertSafeWebsiteFormUpload({
      kind: "job_application",
      filename: "cv.pdf",
      contentType: "application/pdf",
      bytes: pdfBytes("/JavaScript /OpenAction"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/onveilige inhoud/);
  });

  it("rejects docx containing vbaProject.bin", () => {
    const result = assertSafeWebsiteFormUpload({
      kind: "job_application",
      filename: "cv.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: zipLikeOffice(" word/vbaProject.bin"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/onveilige inhoud/);
  });

  it("rejects OLE doc with _VBA_PROJECT", () => {
    const result = assertSafeWebsiteFormUpload({
      kind: "job_application",
      filename: "cv.doc",
      contentType: "application/msword",
      bytes: oleDoc("_VBA_PROJECT Macros"),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/onveilige inhoud/);
  });

  it("rejects a zip that is not an Office document even when named docx", () => {
    const zip = new TextEncoder().encode("PK\u0003\u0004just-a-zip readme.txt");
    const result = assertSafeWebsiteFormUpload({
      kind: "job_application",
      filename: "cv.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: zip,
    });
    expect(result.ok).toBe(false);
  });
});