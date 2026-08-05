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

  it("upgrades legacy product gallery copy in textAndImage mode", () => {
    const normalized = def.normalize({
      title: "Een blik op wat wij doen",
      body: "Schoonmaak op het hoogste niveau voor bedrijven, horeca en specialistische projecten in Twente.",
      contentMode: "textAndImage",
      textPlacement: "below",
      columns: 3,
      images: [
        {
          id: "img_1",
          image: localImage("/images/a.jpg", "A"),
          title: "Dispensers",
          caption: "DISPENSERS",
          body: "Alles is mogelijk voor een efficiënte inrichting.",
        },
        {
          id: "img_2",
          image: localImage("/images/b.jpg", "B"),
          title: "Hygiene papier",
          caption: "HYGIENE PAPIER",
        },
        {
          id: "img_3",
          image: localImage("/images/c.jpg", "C"),
          title: "Schoonmaakmiddelen",
          caption: "SCHOONMAAKMIDDELEN",
        },
      ],
    }) as GalleryBlockData;

    expect(normalized.title).toBe("Alles voor een professioneel schone werkomgeving");
    expect(normalized.body).toContain("sanitaire voorzieningen");
    expect(normalized.images[0]?.title).toBe("Sanitaire dispensers");
    expect(normalized.images[1]?.title).toBe("Hygiënepapier");
    expect(normalized.images[2]?.title).toBe("Professionele reinigingsmiddelen");
    expect(normalized.images[0]?.body).toContain("Functionele dispensers");
    expect(normalized.images[0]?.caption).toBeUndefined();
  });

  it("preserves EN-localized / customized gallery copy (no Dutch rewrite on normalize)", () => {
    const normalized = def.normalize({
      title: "A look at what we do",
      body: "Everything for a clean and hygienic working environment under one roof.",
      contentMode: "textAndImage",
      textPlacement: "below",
      columns: 3,
      images: [
        {
          id: "img_q4fpvnop",
          image: localImage("/images/a.jpg", "Dispensers"),
          caption: "Dispenser",
          body: "Everything is possible for an efficient layout of your toilet group",
          shape: "square",
        },
        {
          id: "img_n3wrjj5s",
          image: localImage("/images/b.jpg", "Hygiene paper"),
          caption: "Hygiene paper",
          body: "A wide selection of toilet paper, towel rolls and paper towels",
          shape: "square",
        },
        {
          id: "img_ubrnczrs",
          image: localImage("/images/c.jpg", "Cleaning agents"),
          caption: "Cleaning agents",
          body: "Cleaners for Interior, Floors and Sanitary.",
          shape: "square",
        },
      ],
    }) as GalleryBlockData;

    expect(normalized.title).toBe("A look at what we do");
    expect(normalized.body).toContain("clean and hygienic");
    expect(normalized.images[0]?.body).toContain("efficient layout");
    expect(normalized.images[1]?.caption).toBe("Hygiene paper");
    expect(normalized.images[2]?.body).toContain("Cleaners for Interior");
    expect(normalized.images[0]?.title).toBeUndefined();
  });

  it("does not rewrite imagesOnly mosaic titles", () => {
    const normalized = def.normalize({
      title: "Een blik op wat wij doen",
      layout: "featured",
      images: [
        {
          id: "img_1",
          image: localImage("/images/a.jpg", "A"),
          title: "Reguliere schoonmaak",
        },
      ],
    }) as GalleryBlockData;

    expect(normalized.contentMode).toBe("imagesOnly");
    expect(normalized.title).toBe("Een blik op wat wij doen");
    expect(normalized.images[0]?.title).toBe("Reguliere schoonmaak");
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
