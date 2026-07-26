import { describe, expect, it } from "vitest";
import { resolveAdminParentOrigins, resolveStorefrontChildOrigins } from "./edit-origins";

describe("edit-origins", () => {
  it("includes sibling admin port when storefront is on 5173", () => {
    const origins = resolveAdminParentOrigins({
      currentOrigin: "http://localhost:5173",
      envAdminOrigin: undefined,
    });
    expect(origins).toContain("http://localhost:5173");
    expect(origins).toContain("http://localhost:5174");
  });

  it("honours VITE_ADMIN_ORIGIN and referrer", () => {
    const origins = resolveAdminParentOrigins({
      currentOrigin: "http://localhost:5173",
      envAdminOrigin: "http://127.0.0.1:5174/",
      referrer: "http://127.0.0.1:5174/admin/website/page_home",
    });
    expect(origins).toContain("http://127.0.0.1:5174");
  });

  it("resolves storefront child origins from admin", () => {
    const origins = resolveStorefrontChildOrigins({
      currentOrigin: "http://localhost:5174",
      envStorefrontOrigin: undefined,
    });
    expect(origins).toContain("http://localhost:5173");
    expect(origins).toContain("http://localhost:5174");
  });

  it("includes sibling admin port when storefront is on preview 4173", () => {
    const origins = resolveAdminParentOrigins({
      currentOrigin: "http://localhost:4173",
      envAdminOrigin: undefined,
    });
    expect(origins).toContain("http://localhost:4173");
    expect(origins).toContain("http://localhost:4174");
  });

  it("resolves storefront child origins from admin preview 4174", () => {
    const origins = resolveStorefrontChildOrigins({
      currentOrigin: "http://localhost:4174",
      envStorefrontOrigin: undefined,
    });
    expect(origins).toContain("http://localhost:4173");
    expect(origins).toContain("http://localhost:4174");
  });
});
