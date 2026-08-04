import { describe, expect, it } from "vitest";
import { localImage } from "../content";
import {
  createDefaultBlock,
  getBlockDataDefinition,
  normalizeGalleryColumns,
  normalizeGalleryContentMode,
  normalizeGalleryTextPlacement,
  parseBlockData,
  parseOptionalGalleryShape,
  type GalleryBlockData,
} from "./index";

describe("gallery content mode helpers", () => {
  it("defaults missing contentMode to imagesOnly", () => {
    expect(normalizeGalleryContentMode(undefined)).toBe("imagesOnly");
    expect(normalizeGalleryContentMode("textAndImage")).toBe("textAndImage");
    expect(normalizeGalleryContentMode("nope")).toBe("imagesOnly");
  });

  it("defaults textPlacement to below", () => {
    expect(normalizeGalleryTextPlacement(undefined)).toBe("below");
    expect(normalizeGalleryTextPlacement("left")).toBe("left");
    expect(normalizeGalleryTextPlacement("above")).toBe("above");
    expect(normalizeGalleryTextPlacement("right")).toBe("right");
  });

  it("defaults columns to 2", () => {
    expect(normalizeGalleryColumns(undefined)).toBe(2);
    expect(normalizeGalleryColumns(3)).toBe(3);
    expect(normalizeGalleryColumns("4")).toBe(4);
    expect(normalizeGalleryColumns(9)).toBe(2);
  });

  it("only keeps explicit shapes", () => {
    expect(parseOptionalGalleryShape(undefined)).toBeUndefined();
    expect(parseOptionalGalleryShape("square")).toBe("square");
    expect(parseOptionalGalleryShape("wide")).toBe("wide");
    expect(parseOptionalGalleryShape("bogus")).toBeUndefined();
  });
});

describe("gallery block normalize", () => {
  const def = getBlockDataDefinition("gallery");

  it("createDefault is imagesOnly featured mosaic", () => {
    const block = createDefaultBlock("gallery");
    const data = block.data as GalleryBlockData;
    expect(data.contentMode).toBe("imagesOnly");
    expect(data.layout).toBe("featured");
    expect(data.textPlacement).toBe("below");
    expect(data.columns).toBe(2);
  });

  it("legacy published gallery without new fields stays imagesOnly", () => {
    const normalized = def.normalize({
      title: "Ons werk",
      layout: "featured",
      images: [
        {
          id: "img_1",
          image: localImage("/images/a.jpg", "A"),
          title: "Reguliere schoonmaak",
          caption: "Twente",
        },
      ],
    }) as GalleryBlockData;

    expect(normalized.contentMode).toBe("imagesOnly");
    expect(normalized.textPlacement).toBe("below");
    expect(normalized.columns).toBe(2);
    expect(normalized.images[0]?.shape).toBeUndefined();
    expect(normalized.images[0]?.title).toBe("Reguliere schoonmaak");

    const parsed = parseBlockData("gallery", normalized);
    expect(parsed.ok).toBe(true);
  });

  it("preserves explicit shape and text+image fields", () => {
    const normalized = def.normalize({
      title: "Galerij",
      contentMode: "textAndImage",
      textPlacement: "left",
      columns: 3,
      images: [
        {
          id: "img_1",
          image: localImage("/images/a.jpg", "A"),
          title: "Titel",
          caption: "Bijschrift",
          body: "Langere tekst",
          shape: "wide",
        },
      ],
    }) as GalleryBlockData;

    expect(normalized.contentMode).toBe("textAndImage");
    expect(normalized.textPlacement).toBe("left");
    expect(normalized.columns).toBe(3);
    expect(normalized.images[0]?.body).toBe("Langere tekst");
    expect(normalized.images[0]?.shape).toBe("wide");

    const parsed = parseBlockData("gallery", normalized);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const data = parsed.data as GalleryBlockData;
      expect(data.contentMode).toBe("textAndImage");
      expect(data.images[0]?.body).toBe("Langere tekst");
    }
  });

  it("does not invent shape for URL-only legacy images", () => {
    const normalized = def.normalize({
      title: "Galerij",
      images: ["/images/legacy.jpg"],
    }) as GalleryBlockData;
    expect(normalized.images).toHaveLength(1);
    expect(normalized.images[0]?.shape).toBeUndefined();
    expect(normalized.contentMode).toBe("imagesOnly");
  });
});
