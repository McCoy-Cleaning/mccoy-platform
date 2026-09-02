import { describe, expect, it } from "vitest";
import { normalizeCmsImage } from "./image-normalize";

describe("normalizeCmsImage", () => {
  it("keeps storage images when width/height are zero (drops invalid dims)", () => {
    const image = normalizeCmsImage({
      assetId: "storage:abc",
      src: "https://cdn.example.com/photo.webp",
      alt: "Test",
      decorative: false,
      width: 0,
      height: 0,
    });
    expect(image).toEqual({
      assetId: "storage:abc",
      src: "https://cdn.example.com/photo.webp",
      alt: "Test",
      decorative: false,
    });
  });

  it("keeps image when focalPoint is invalid (drops focalPoint)", () => {
    const image = normalizeCmsImage({
      assetId: "storage:abc",
      src: "https://cdn.example.com/photo.webp",
      alt: "Test",
      decorative: false,
      width: 800,
      height: 600,
      focalPoint: { x: 2, y: -1 },
    });
    expect(image).toMatchObject({
      assetId: "storage:abc",
      src: "https://cdn.example.com/photo.webp",
      width: 800,
      height: 600,
    });
    expect(image?.focalPoint).toBeUndefined();
  });

  it("preserves valid dimensions and focal point", () => {
    const image = normalizeCmsImage({
      assetId: "storage:abc",
      src: "https://cdn.example.com/photo.webp",
      alt: "Test",
      decorative: false,
      width: 800,
      height: 600,
      focalPoint: { x: 0.5, y: 0.25 },
    });
    expect(image).toEqual({
      assetId: "storage:abc",
      src: "https://cdn.example.com/photo.webp",
      alt: "Test",
      decorative: false,
      width: 800,
      height: 600,
      focalPoint: { x: 0.5, y: 0.25 },
    });
  });
});
