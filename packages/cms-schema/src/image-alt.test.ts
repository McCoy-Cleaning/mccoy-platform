import { describe, expect, it } from "vitest";
import {
  isGenericImageAlt,
  resolvePublicImageAlt,
  withResolvedPublicImageAlt,
  sanitizePublicCmsImageTree,
} from "./image-alt";
import { localImage } from "./content";

describe("image-alt (Phase 10)", () => {
  it("flags empty and generic placeholder alts", () => {
    expect(isGenericImageAlt("")).toBe(true);
    expect(isGenericImageAlt("   ")).toBe(true);
    expect(isGenericImageAlt("Image")).toBe(true);
    expect(isGenericImageAlt("Afbeelding")).toBe(true);
    expect(isGenericImageAlt("Hero")).toBe(true);
    expect(isGenericImageAlt("Logo")).toBe(true);
    expect(isGenericImageAlt("McCoy Cleaning professional at work")).toBe(false);
    expect(isGenericImageAlt("Reguliere schoonmaak")).toBe(false);
  });

  it("returns empty alt for decorative images", () => {
    const decorative = localImage("/images/cms/logo-mccoy.png", "McCoy Cleaning", true);
    expect(resolvePublicImageAlt(decorative, "McCoy Cleaning")).toBe("");
    expect(withResolvedPublicImageAlt(decorative, "McCoy Cleaning").alt).toBe("");
  });

  it("replaces generic alts with concise descriptive fallbacks", () => {
    const generic = localImage("/images/cms/hero-cleaning.jpg", "Image");
    expect(resolvePublicImageAlt(generic, "McCoy Cleaning professional at work")).toBe(
      "McCoy Cleaning professional at work",
    );
    expect(withResolvedPublicImageAlt(generic, "Producten flyer").alt).toBe("Producten flyer");
  });

  it("preserves meaningful CMS alts without geo stuffing", () => {
    const meaningful = localImage("/images/cms/work-regular.jpg", "Reguliere schoonmaak");
    expect(resolvePublicImageAlt(meaningful, "Dienst")).toBe("Reguliere schoonmaak");
  });

  it("sanitizes generic alts in CMS trees using filename or brand fallback", () => {
    const tree = {
      images: [
        { id: "a", image: localImage("/images/cms/work-horeca.jpg", "Image") },
        {
          id: "b",
          image: {
            assetId: "storage:x",
            src: "https://cdn.example/media/a0000000-0000-4000-8000-000000000001/toilet-dispensers.jpg",
            alt: "Afbeelding",
            decorative: false,
          },
        },
        { id: "c", image: localImage("/images/cms/logo.png", "McCoy Cleaning", true) },
      ],
    };
    const next = sanitizePublicCmsImageTree(tree);
    expect(next.images[0]!.image.alt).toBe("Work Horeca");
    expect(next.images[1]!.image.alt).toBe("Toilet Dispensers");
    expect(next.images[2]!.image.alt).toBe("");
  });
});
