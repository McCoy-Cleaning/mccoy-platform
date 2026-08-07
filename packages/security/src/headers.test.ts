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

  it("allows admin to embed the storefront (frame-src), not only same-origin", () => {
    const csp = buildContentSecurityPolicy("admin");
    expect(csp).toMatch(/frame-src\s+'self'/);
    expect(csp).toContain("https://www.mccoy.nl");
    expect(csp).toContain("http://localhost:5173");
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

  it("parses comma-separated admin frame ancestors from env", () => {
    const prev = process.env.MCCOY_ADMIN_FRAME_ANCESTORS;
    process.env.MCCOY_ADMIN_FRAME_ANCESTORS =
      "https://admin-a.example, https://admin-b.example/";
    try {
      const csp = buildContentSecurityPolicy("storefront");
      expect(csp).toContain("https://admin-a.example");
      expect(csp).toContain("https://admin-b.example");
    } finally {
      if (prev === undefined) delete process.env.MCCOY_ADMIN_FRAME_ANCESTORS;
      else process.env.MCCOY_ADMIN_FRAME_ANCESTORS = prev;
    }
  });
});
