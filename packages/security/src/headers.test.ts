import { describe, expect, it } from "vitest";
import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "./headers";

describe("security headers", () => {
  it("denies framing for admin", () => {
    const headers = buildSecurityHeaders({ app: "admin" });
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Content-Security-Policy"]).toMatch(/frame-ancestors\s+'none'/);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("keeps storefront embeddable by admin (no X-Frame-Options DENY)", () => {
    const headers = buildSecurityHeaders({
      app: "storefront",
      adminFrameAncestors: ["http://localhost:5174"],
    });
    expect(headers["X-Frame-Options"]).toBeUndefined();
    expect(headers["Content-Security-Policy"]).toMatch(/object-src\s+'none'/);
    expect(headers["Content-Security-Policy"]).toContain("http://localhost:5174");
  });

  it("allows CMS video iframe hosts including Facebook plugins", () => {
    const csp = buildContentSecurityPolicy("storefront", ["http://localhost:5174"]);
    expect(csp).toMatch(/frame-src\s+'self'/);
    expect(csp).toContain("https://www.youtube-nocookie.com");
    expect(csp).toContain("https://player.vimeo.com");
    expect(csp).toContain("https://www.facebook.com");
    expect(csp).toContain("https://web.facebook.com");
    expect(csp).toContain("https://www.fb.com");
    // Admin CSP must not open frame-src for third-party embeds
    expect(buildContentSecurityPolicy("admin")).not.toContain("frame-src");
  });

  it("applies headers onto an existing Response", () => {
    const secured = applySecurityHeaders(
      new Response("ok", { headers: { "content-type": "text/plain" } }),
      { app: "admin" },
    );
    expect(secured.headers.get("content-type")).toBe("text/plain");
    expect(secured.headers.get("x-frame-options")).toBe("DENY");
  });

  it("builds distinct CSPs per app", () => {
    expect(buildContentSecurityPolicy("admin")).toMatch(/frame-ancestors\s+'none'/);
    expect(buildContentSecurityPolicy("storefront", ["https://admin.example"])).toContain(
      "https://admin.example",
    );
  });
});
