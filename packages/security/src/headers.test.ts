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

  it("allows admin connect-src and img-src to the same storefront origins as frame-src", () => {
    const csp = buildContentSecurityPolicy("admin");
    const connectSrc =
      csp.split(";").find((part) => part.trim().startsWith("connect-src")) ?? "";
    const frameSrc =
      csp.split(";").find((part) => part.trim().startsWith("frame-src")) ?? "";
    const imgSrc =
      csp.split(";").find((part) => part.trim().startsWith("img-src")) ?? "";

    expect(connectSrc).toContain("'self'");
    expect(connectSrc.split(/\s+/)).toContain("https:");
    expect(connectSrc.split(/\s+/)).toContain("wss:");
    expect(connectSrc).toContain("http://localhost:5173");
    expect(connectSrc).toContain("http://127.0.0.1:5173");
    expect(connectSrc).toContain("https://www.mccoy.nl");
    expect(connectSrc).toContain("https://mccoy.nl");

    expect(imgSrc.split(/\s+/)).toContain("https:");
    expect(imgSrc).toContain("data:");
    expect(imgSrc).toContain("blob:");

    // Probe / thumbnail origins must match embed origins (shared storefront list).
    for (const origin of [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://www.mccoy.nl",
      "https://mccoy.nl",
    ]) {
      expect(frameSrc).toContain(origin);
      expect(connectSrc).toContain(origin);
      expect(imgSrc).toContain(origin);
    }
  });

  it("includes VITE_STOREFRONT_ORIGIN in admin frame-src, connect-src, and img-src", () => {
    const prev = process.env.VITE_STOREFRONT_ORIGIN;
    process.env.VITE_STOREFRONT_ORIGIN = "https://preview-storefront.example/";
    try {
      const csp = buildContentSecurityPolicy("admin");
      const connectSrc =
        csp.split(";").find((part) => part.trim().startsWith("connect-src")) ?? "";
      const frameSrc =
        csp.split(";").find((part) => part.trim().startsWith("frame-src")) ?? "";
      const imgSrc =
        csp.split(";").find((part) => part.trim().startsWith("img-src")) ?? "";
      expect(frameSrc).toContain("https://preview-storefront.example");
      expect(connectSrc).toContain("https://preview-storefront.example");
      expect(imgSrc).toContain("https://preview-storefront.example");
    } finally {
      if (prev === undefined) delete process.env.VITE_STOREFRONT_ORIGIN;
      else process.env.VITE_STOREFRONT_ORIGIN = prev;
    }
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

  it("allows Vercel preview toolbar in storefront frame-src", () => {
    const csp = buildContentSecurityPolicy("storefront", ["http://localhost:5174"]);
    const frameSrc =
      csp.split(";").find((part) => part.trim().startsWith("frame-src")) ?? "";
    expect(frameSrc.split(/\s+/)).toContain("https://vercel.live");
  });

  it("applies headers onto an existing Response", () => {
    const secured = applySecurityHeaders(
      new Response("ok", { headers: { "content-type": "text/plain" } }),
      { app: "admin" },
    );
    expect(secured.headers.get("content-type")).toBe("text/plain");
    expect(secured.headers.get("x-frame-options")).toBe("DENY");
  });

  it("allows Google Fonts stylesheets for admin (Archivo / Quicksand)", () => {
    const csp = buildContentSecurityPolicy("admin");
    expect(csp).toContain("https://fonts.googleapis.com");
    expect(csp).toContain("https://fonts.gstatic.com");
  });

  it("allows Vercel preview feedback script host without opening script-src to all https", () => {
    const csp = buildContentSecurityPolicy("admin");
    expect(csp).toMatch(/script-src[^;]*https:\/\/vercel\.live/);
    // Must not allow any https origin via a bare `https:` token in script-src.
    const scriptSrc = csp.split(";").find((part) => part.trim().startsWith("script-src")) ?? "";
    expect(scriptSrc.split(/\s+/)).not.toContain("https:");
  });

  it("allows storefront GA4 / gtag script hosts without opening script-src to all https", () => {
    const csp = buildContentSecurityPolicy("storefront", ["http://localhost:5174"]);
    const scriptSrc =
      csp.split(";").find((part) => part.trim().startsWith("script-src")) ?? "";
    const connectSrc =
      csp.split(";").find((part) => part.trim().startsWith("connect-src")) ?? "";
    expect(scriptSrc).toContain("https://www.googletagmanager.com");
    expect(scriptSrc).toContain("https://www.google-analytics.com");
    expect(scriptSrc).toContain("https://va.vercel-scripts.com");
    expect(scriptSrc.split(/\s+/)).not.toContain("https:");
    expect(connectSrc).toContain("https://www.googletagmanager.com");
    expect(connectSrc).toContain("https://www.google-analytics.com");
    expect(connectSrc).toContain("https://region1.google-analytics.com");
    expect(connectSrc).toContain("https://analytics.google.com");
    expect(connectSrc.split(/\s+/)).toContain("https://*.supabase.co");
    expect(connectSrc.split(/\s+/)).toContain("wss://*.supabase.co");
    expect(connectSrc.split(/\s+/)).not.toContain("https:");
    expect(connectSrc.split(/\s+/)).not.toContain("wss:");
  });

  it("allows storefront connect-src to SUPABASE_URL origin without opening all https", () => {
    const prevUrl = process.env.SUPABASE_URL;
    const prevVite = process.env.VITE_SUPABASE_URL;
    process.env.SUPABASE_URL = "https://project-ref.supabase.co/";
    delete process.env.VITE_SUPABASE_URL;
    try {
      const csp = buildContentSecurityPolicy("storefront", ["http://localhost:5174"]);
      const connectSrc =
        csp.split(";").find((part) => part.trim().startsWith("connect-src")) ?? "";
      const tokens = connectSrc.split(/\s+/);
      expect(tokens).toContain("https://project-ref.supabase.co");
      expect(tokens).toContain("wss://project-ref.supabase.co");
      expect(tokens).toContain("https://*.supabase.co");
      expect(tokens).toContain("wss://*.supabase.co");
      expect(tokens).not.toContain("https:");
      expect(tokens).not.toContain("wss:");
    } finally {
      if (prevUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = prevUrl;
      if (prevVite === undefined) delete process.env.VITE_SUPABASE_URL;
      else process.env.VITE_SUPABASE_URL = prevVite;
    }
  });

  it("falls back to VITE_SUPABASE_URL when SUPABASE_URL is unset", () => {
    const prevUrl = process.env.SUPABASE_URL;
    const prevVite = process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    process.env.VITE_SUPABASE_URL = "https://vite-project.supabase.co";
    try {
      const csp = buildContentSecurityPolicy("storefront", ["http://localhost:5174"]);
      const connectSrc =
        csp.split(";").find((part) => part.trim().startsWith("connect-src")) ?? "";
      const tokens = connectSrc.split(/\s+/);
      expect(tokens).toContain("https://vite-project.supabase.co");
      expect(tokens).toContain("wss://vite-project.supabase.co");
    } finally {
      if (prevUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = prevUrl;
      if (prevVite === undefined) delete process.env.VITE_SUPABASE_URL;
      else process.env.VITE_SUPABASE_URL = prevVite;
    }
  });

  it("keeps hosted Supabase connect-src when project URL env is unset", () => {
    const prevUrl = process.env.SUPABASE_URL;
    const prevVite = process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    try {
      const csp = buildContentSecurityPolicy("storefront", ["http://localhost:5174"]);
      const connectSrc =
        csp.split(";").find((part) => part.trim().startsWith("connect-src")) ?? "";
      const tokens = connectSrc.split(/\s+/);
      expect(tokens).toContain("https://*.supabase.co");
      expect(tokens).toContain("wss://*.supabase.co");
      expect(tokens).not.toContain("https:");
      expect(tokens).not.toContain("wss:");
    } finally {
      if (prevUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = prevUrl;
      if (prevVite === undefined) delete process.env.VITE_SUPABASE_URL;
      else process.env.VITE_SUPABASE_URL = prevVite;
    }
  });

  it("builds distinct CSPs per app", () => {
    expect(buildContentSecurityPolicy("admin")).toMatch(/frame-ancestors\s+'none'/);
    expect(buildContentSecurityPolicy("storefront", ["https://admin.example"])).toContain(
      "https://admin.example",
    );
  });


  it("allows official admin.mccoy.nl to embed the storefront by default", () => {
    const csp = buildContentSecurityPolicy("storefront");
    expect(csp).toContain("https://admin.mccoy.nl");
    expect(csp).toContain("http://localhost:5174");
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
