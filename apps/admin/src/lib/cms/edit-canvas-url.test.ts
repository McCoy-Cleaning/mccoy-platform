import { describe, expect, it } from "vitest";
import { buildStorefrontEditCanvasUrl } from "./edit-canvas-url";

describe("buildStorefrontEditCanvasUrl", () => {
  it("includes edit mode, page id, and preview locale on the NL path", () => {
    expect(
      buildStorefrontEditCanvasUrl({
        origin: "http://localhost:5173",
        slug: "/contact",
        pageId: "page_contact",
        locale: "en",
      }),
    ).toBe(
      "http://localhost:5173/contact?_cmsMode=edit&_cmsPage=page_contact&_cmsLocale=en",
    );
  });

  it("defaults NL locale and normalizes home + origin trailing slash", () => {
    expect(
      buildStorefrontEditCanvasUrl({
        origin: "http://localhost:5173/",
        slug: "/",
        pageId: "page_home",
        locale: "nl",
      }),
    ).toBe("http://localhost:5173/?_cmsMode=edit&_cmsPage=page_home&_cmsLocale=nl");
  });
});
