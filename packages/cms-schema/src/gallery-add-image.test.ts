import { describe, expect, it } from "vitest";
import { localImage, workGalleryContentSchema, partnersContentSchema } from "./content";

/**
 * Canvas "Foto toevoegen" previously sent images without assetId.
 * cmsImageSchema requires assetId — those adds were rejected silently.
 */
describe("gallery/partner add image validation", () => {
  it("rejects gallery item image missing assetId", () => {
    const result = workGalleryContentSchema.safeParse({
      heading: "Werken",
      items: [
        {
          id: "g1",
          title: "Nieuwe foto",
          image: {
            src: "/images/hero-placeholder.jpg",
            alt: "Nieuwe foto",
            decorative: false,
          },
        },
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes("assetId"))).toBe(true);
    }
  });

  it("accepts gallery item built with localImage", () => {
    const result = workGalleryContentSchema.safeParse({
      heading: "Werken",
      items: [
        {
          id: "g1",
          title: "Nieuwe foto",
          image: localImage("/images/hero-placeholder.jpg", "Nieuwe foto", false),
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects partner item image missing assetId", () => {
    const result = partnersContentSchema.safeParse({
      heading: "Partners",
      items: [
        {
          id: "p1",
          name: "Nieuwe partner",
          image: {
            src: "/images/hero-placeholder.jpg",
            alt: "Nieuwe partner",
            decorative: false,
          },
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
