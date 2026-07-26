import { afterEach, describe, expect, it } from "vitest";
import {
  addUploadedImage,
  CMS_MAX_SOURCE_IMAGE_BYTES,
  readUploadedImages,
  removeUploadedImage,
  validateImageUploadFile,
} from "./uploaded-images";

const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

afterEach(() => {
  window.localStorage.clear();
});

describe("uploaded-images library", () => {
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

  it("persists uploads and supports remove", () => {
    const added = addUploadedImage({
      dataUrl: PNG_DATA_URL,
      label: "Nav logo",
      tags: ["logo"],
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    expect(readUploadedImages()).toHaveLength(1);
    expect(readUploadedImages()[0]?.image.src).toBe(PNG_DATA_URL);
    expect(removeUploadedImage(added.entry.id).ok).toBe(true);
    expect(readUploadedImages()).toHaveLength(0);
  });
});
