import { describe, expect, it } from "vitest";

import {
  EMAIL_BRAND_LOGO_PRODUCTION_URL,
  resolveEmailBrandLogoUrl,
} from "./transactional-layout";

describe("resolveEmailBrandLogoUrl", () => {
  it("prefers explicit EMAIL_BRAND_LOGO_URL override", () => {
    expect(
      resolveEmailBrandLogoUrl({
        explicit: "https://cdn.example.com/logo.png",
        storefrontOrigin: "http://localhost:5173",
      }),
    ).toBe("https://cdn.example.com/logo.png");
  });

  it("skips localhost storefront origins and falls back to production", () => {
    expect(
      resolveEmailBrandLogoUrl({
        storefrontOrigin: "http://localhost:5173",
        siteOrigin: "http://127.0.0.1:3000",
      }),
    ).toBe(EMAIL_BRAND_LOGO_PRODUCTION_URL);
  });

  it("uses public HTTPS storefront origin when configured", () => {
    expect(
      resolveEmailBrandLogoUrl({
        storefrontOrigin: "https://www.mccoy.nl",
      }),
    ).toBe("https://www.mccoy.nl/images/cms/logo-mccoy.png");
  });
});
