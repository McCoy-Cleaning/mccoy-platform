import { describe, expect, it } from "vitest";
import {
  GALLERY_IMAGE_SIZES,
  HERO_IMAGE_PRELOAD_MEDIA,
  HERO_IMAGE_SIZES,
  heroWebpSrcSet,
  homeHeroPreloadLink,
  isLocalPublicImageSrc,
  localCmsPhotoWebpSrcSet,
  localWebpSibling,
  partnerLogoWebpSrc,
} from "./image-delivery";

describe("image-delivery", () => {
  it("builds responsive hero WebP srcset for the known local hero", () => {
    expect(heroWebpSrcSet("/images/cms/hero-cleaning.jpg")).toBe(
      "/images/cms/hero-cleaning-640.webp 640w, /images/cms/hero-cleaning-960.webp 960w, /images/cms/hero-cleaning-1280.webp 1280w",
    );
    expect(heroWebpSrcSet("/images/cms/other.jpg")).toBeUndefined();
    expect(heroWebpSrcSet("https://cdn.example/hero-cleaning.jpg")).toBeUndefined();
  });

  it("maps partner PNG masters to 480w WebP display variants", () => {
    expect(partnerLogoWebpSrc("/images/partners/acme.png")).toBe(
      "/images/partners/acme-w480.webp",
    );
    expect(partnerLogoWebpSrc("/images/cms/logo.png")).toBeUndefined();
  });

  it("maps allowlisted CMS photos to sibling WebP without inventing unknowns", () => {
    expect(localWebpSibling("/images/cms/work-horeca.jpg")).toBe(
      "/images/cms/work-horeca.webp",
    );
    expect(localCmsPhotoWebpSrcSet("/images/cms/work-horeca.jpg")).toBe(
      "/images/cms/work-horeca.webp 1200w",
    );
    expect(localWebpSibling("/images/cms/unknown-photo.jpg")).toBeUndefined();
  });

  it("exports sizes strings used by DeliveryImage / preload", () => {
    expect(isLocalPublicImageSrc("/images/cms/hero-cleaning.jpg")).toBe(true);
    expect(HERO_IMAGE_SIZES).toContain("28rem");
    expect(GALLERY_IMAGE_SIZES).toContain("100vw");
  });

  it("builds a desktop-only hero preload link for home head", () => {
    const link = homeHeroPreloadLink("/images/cms/hero-cleaning.jpg");
    expect(link.rel).toBe("preload");
    expect(link.as).toBe("image");
    expect(link.type).toBe("image/webp");
    expect(link.href).toBe("/images/cms/hero-cleaning-640.webp");
    expect(link.imageSrcSet).toContain("640w");
    expect(link.imageSizes).toBe(HERO_IMAGE_SIZES);
    expect(link.fetchPriority).toBe("high");
    expect(link.media).toBe(HERO_IMAGE_PRELOAD_MEDIA);
    expect(link.media).toContain("1024px");
  });

  it("matches DeliveryImage contain transforms for Supabase hero preloads", () => {
    const src =
      "https://bwrktdwnnlgxdpefecmv.supabase.co/storage/v1/object/public/cms-media/media/hero.webp";
    const link = homeHeroPreloadLink(src);
    expect(link.href).toContain("width=640");
    expect(link.href).toContain("quality=72");
    expect(link.href).toContain("format=webp");
    expect(link.href).toContain("resize=contain");
    expect(link.imageSrcSet).toContain("resize=contain");
  });
});
