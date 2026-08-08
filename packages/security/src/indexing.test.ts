import { describe, expect, it } from "vitest";
import {
  isStorefrontIndexable,
  storefrontRobotsMetaContent,
  storefrontRobotsTxt,
} from "./indexing";

describe("isStorefrontIndexable", () => {
  it("allows Vercel production by default", () => {
    expect(isStorefrontIndexable({ vercelEnv: "production" })).toBe(true);
  });

  it("blocks Vercel preview and development", () => {
    expect(isStorefrontIndexable({ vercelEnv: "preview" })).toBe(false);
    expect(isStorefrontIndexable({ vercelEnv: "development" })).toBe(false);
  });

  it("blocks local / unknown by default even when NODE_ENV=production", () => {
    expect(isStorefrontIndexable({ nodeEnv: "production" })).toBe(false);
    expect(isStorefrontIndexable({ nodeEnv: "development" })).toBe(false);
    expect(isStorefrontIndexable({})).toBe(false);
  });

  it("honors MCCOY_ALLOW_INDEXING override", () => {
    expect(
      isStorefrontIndexable({ vercelEnv: "production", allowIndexing: "0" }),
    ).toBe(false);
    expect(
      isStorefrontIndexable({ vercelEnv: "preview", allowIndexing: "1" }),
    ).toBe(true);
    expect(isStorefrontIndexable({ allowIndexing: "true" })).toBe(true);
  });
});

describe("storefrontRobotsMetaContent", () => {
  it("returns index, follow only when indexable", () => {
    expect(storefrontRobotsMetaContent({ vercelEnv: "production" })).toBe(
      "index, follow",
    );
    expect(storefrontRobotsMetaContent({ vercelEnv: "preview" })).toBe(
      "noindex, nofollow",
    );
  });
});

describe("storefrontRobotsTxt", () => {
  it("disallows all when not indexable", () => {
    const body = storefrontRobotsTxt({ vercelEnv: "preview" });
    expect(body).toContain("Disallow: /");
    expect(body).not.toContain("Allow: /");
    expect(body).not.toContain("Sitemap:");
  });

  it("allows crawl and lists sitemap when indexable", () => {
    const body = storefrontRobotsTxt(
      { vercelEnv: "production" },
      "https://www.mccoy.nl/sitemap.xml",
    );
    expect(body).toContain("Allow: /");
    expect(body).toContain("Disallow: /cms-preview");
    expect(body).toContain("Sitemap: https://www.mccoy.nl/sitemap.xml");
  });

  it("fail-closed: preview never indexable without explicit override", () => {
    expect(isStorefrontIndexable({ vercelEnv: "preview", nodeEnv: "production" })).toBe(
      false,
    );
    expect(storefrontRobotsMetaContent({ vercelEnv: "preview" })).toBe("noindex, nofollow");
  });
});
