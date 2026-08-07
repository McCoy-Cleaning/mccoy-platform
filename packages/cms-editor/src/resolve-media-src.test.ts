import { describe, expect, it } from "vitest";
import type { CmsImage } from "@mccoy/cms-schema";
import {
  filterProjectImagesForStorage,
  lookupResolvedProjectImage,
  resolveCmsAssetSrc,
  resolveCmsImageDisplaySrc,
  resolveProjectThumbSrc,
} from "./resolve-media-src";

const storageImage = (src: string): CmsImage => ({
  assetId: "storage:abc",
  src,
  alt: "Seeded",
  decorative: false,
});

describe("resolveCmsAssetSrc", () => {
  it("passes through absolute and data URLs", () => {
    expect(resolveCmsAssetSrc("https://cdn.example/a.jpg", "http://localhost:5173")).toBe(
      "https://cdn.example/a.jpg",
    );
    expect(resolveCmsAssetSrc("data:image/png;base64,xx")).toBe("data:image/png;base64,xx");
  });

  it("prefixes relative paths with assetBaseUrl", () => {
    expect(resolveCmsAssetSrc("/images/cms/about-mission.png", "http://localhost:5173")).toBe(
      "http://localhost:5173/images/cms/about-mission.png",
    );
    expect(resolveCmsAssetSrc("images/foo.jpg", "http://localhost:5173/")).toBe(
      "http://localhost:5173/images/foo.jpg",
    );
  });

  it("returns relative path when assetBaseUrl is missing", () => {
    expect(resolveCmsAssetSrc("/images/cms/about-mission.png")).toBe(
      "/images/cms/about-mission.png",
    );
  });
});

describe("resolveProjectThumbSrc", () => {
  it("prefers Storage public URL over storefront-relative path", () => {
    const resolve = (path: string): CmsImage | null =>
      path === "/images/cms/about-mission.png"
        ? storageImage("https://xxx.supabase.co/storage/v1/object/public/cms/about-mission.png")
        : null;

    expect(
      resolveProjectThumbSrc("/images/cms/about-mission.png", {
        assetBaseUrl: "http://localhost:5173",
        resolveProjectImage: resolve,
      }),
    ).toBe("https://xxx.supabase.co/storage/v1/object/public/cms/about-mission.png");
  });

  it("falls back to assetBaseUrl when Storage map misses", () => {
    expect(
      resolveProjectThumbSrc("/images/cms/about-mission.png", {
        assetBaseUrl: "http://localhost:5173",
        resolveProjectImage: () => null,
      }),
    ).toBe("http://localhost:5173/images/cms/about-mission.png");
  });
});

describe("resolveCmsImageDisplaySrc", () => {
  it("resolves local project paths via Storage for previews", () => {
    const resolve = (path: string): CmsImage | null =>
      path === "/images/cms/about-mission.png"
        ? storageImage("https://cdn.example/mission.png")
        : null;
    expect(
      resolveCmsImageDisplaySrc("/images/cms/about-mission.png", {
        assetBaseUrl: "http://localhost:5173",
        resolveProjectImage: resolve,
      }),
    ).toBe("https://cdn.example/mission.png");
  });
});

describe("lookupResolvedProjectImage / filterProjectImagesForStorage", () => {
  it("looks up with and without leading slash", () => {
    const resolve = (path: string): CmsImage | null =>
      path === "/images/a.jpg" ? storageImage("https://cdn.example/a.jpg") : null;
    expect(lookupResolvedProjectImage("images/a.jpg", resolve)?.src).toBe(
      "https://cdn.example/a.jpg",
    );
  });

  it("keeps full catalog while Storage map is empty", () => {
    const catalog = [
      { path: "/images/a.jpg", label: "A", tags: ["about"] },
      { path: "/images/b.jpg", label: "B", tags: ["about"] },
    ];
    expect(filterProjectImagesForStorage(catalog, () => null)).toEqual(catalog);
  });

  it("hides local-only paths once any Storage hit exists", () => {
    const catalog = [
      { path: "/images/a.jpg", label: "A", tags: ["about"] },
      { path: "/images/b.jpg", label: "B", tags: ["about"] },
    ];
    const resolve = (path: string): CmsImage | null =>
      path === "/images/a.jpg" ? storageImage("https://cdn.example/a.jpg") : null;
    expect(filterProjectImagesForStorage(catalog, resolve)).toEqual([catalog[0]]);
  });
});
