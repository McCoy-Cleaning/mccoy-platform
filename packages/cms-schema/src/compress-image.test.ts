import { describe, expect, it } from "vitest";
import {
  CMS_MAX_SOURCE_IMAGE_BYTES,
  compressProfileFromTags,
  estimateDataUrlBytes,
  pickOutputMime,
  scaleToMaxEdge,
  validateImageUploadFile,
} from "./compress-image";

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("compress-image helpers", () => {
  it("estimates base64 data-URL byte size", () => {
    const bytes = estimateDataUrlBytes(PNG_DATA_URL);
    expect(bytes).toBeGreaterThan(40);
    expect(bytes).toBeLessThan(200);
  });

  it("scales down only when longer edge exceeds max", () => {
    expect(scaleToMaxEdge(4000, 2000, 2048)).toEqual({ width: 2048, height: 1024 });
    expect(scaleToMaxEdge(800, 600, 2048)).toEqual({ width: 800, height: 600 });
    expect(scaleToMaxEdge(100, 4000, 1280)).toEqual({ width: 32, height: 1280 });
  });

  it("picks output mime by profile and alpha", () => {
    expect(pickOutputMime("image/jpeg", "photo", false)).toBe("image/jpeg");
    expect(pickOutputMime("image/png", "photo", true)).toBe("image/webp");
    // Logos prefer lossless PNG (partner-card crispness).
    expect(pickOutputMime("image/png", "logo", false)).toBe("image/png");
    expect(pickOutputMime("image/jpeg", "logo", true)).toBe("image/png");
    expect(pickOutputMime("image/webp", "photo", false)).toBe("image/webp");
  });

  it("infers logo profile from preferTags", () => {
    expect(compressProfileFromTags(["hero", "home"])).toBe("photo");
    expect(compressProfileFromTags(["logo", "nav"])).toBe("logo");
    expect(compressProfileFromTags(["brand"])).toBe("logo");
    expect(compressProfileFromTags(["partners"])).toBe("logo");
    expect(compressProfileFromTags(["partners", "logo"])).toBe("logo");
    expect(compressProfileFromTags(undefined)).toBe("photo");
  });

  it("validates type and raised source size limit", () => {
    expect(validateImageUploadFile(new File(["x"], "a.txt", { type: "text/plain" }))).toMatch(
      /afbeelding/i,
    );
    const mid = new File([new Uint8Array(3 * 1024 * 1024)], "mid.jpg", { type: "image/jpeg" });
    expect(validateImageUploadFile(mid)).toBeNull();
    const huge = new File([new Uint8Array(CMS_MAX_SOURCE_IMAGE_BYTES + 1)], "huge.png", {
      type: "image/png",
    });
    expect(validateImageUploadFile(huge)).toMatch(/12MB|MB/i);
    expect(validateImageUploadFile(new File(["x"], "ok.png", { type: "image/png" }))).toBeNull();
  });
});
