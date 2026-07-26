import { describe, expect, it } from "vitest";
import {
  detectImageFormat,
  inspectCmsImageBytes,
  sanitizeOriginalFilename,
  buildCmsMediaStoragePath,
  deriveCmsMediaPublicUrl,
} from "./media-validate";

/** 1x1 PNG */
const PNG_1X1 = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

describe("inspectCmsImageBytes", () => {
  it("accepts a real PNG for logo profile", () => {
    const result = inspectCmsImageBytes(PNG_1X1, "logo");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mimeType).toBe("image/png");
      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
    }
  });

  it("rejects SVG content", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    const result = inspectCmsImageBytes(svg, "logo");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("svg_rejected");
  });

  it("rejects fake PNG magic", () => {
    const fake = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00]);
    const result = inspectCmsImageBytes(fake, "photo");
    expect(result.ok).toBe(false);
  });

  it("rejects GIF for logo profile", () => {
    // minimal GIF89a 1x1
    const gif = Uint8Array.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x3b,
    ]);
    const result = inspectCmsImageBytes(gif, "logo");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("unsupported");
  });

  it("sanitizes path traversal in filenames", () => {
    expect(sanitizeOriginalFilename("../../etc/passwd.png")).toBe("passwd.png");
    expect(sanitizeOriginalFilename("C:\\\\foo\\\\bar logo.PNG")).toBe("bar logo.PNG");
  });

  it("builds deterministic storage paths from asset id not filename", () => {
    const path = buildCmsMediaStoragePath({
      siteId: "site-1",
      assetId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      extension: "webp",
    });
    expect(path).toBe("media/site-1/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.webp");
    expect(path.includes("evil")).toBe(false);
  });

  it("derives public URL without storing it", () => {
    expect(
      deriveCmsMediaPublicUrl({
        supabaseUrl: "https://proj.supabase.co",
        bucketId: "cms-media",
        storagePath: "media/s/a.webp",
      }),
    ).toBe("https://proj.supabase.co/storage/v1/object/public/cms-media/media/s/a.webp");
  });

  it("detectImageFormat returns null for empty", () => {
    expect(detectImageFormat(new Uint8Array())).toBeNull();
  });
});
