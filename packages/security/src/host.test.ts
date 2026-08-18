import { describe, expect, it } from "vitest";
import { dropAdminPathPrefix, isAdminPathPrefix, shouldRedirectForHost } from "./host";

describe("dropAdminPathPrefix", () => {
  it("maps /admin and trailing slash to /", () => {
    expect(dropAdminPathPrefix("/admin")).toBe("/");
    expect(dropAdminPathPrefix("/admin/")).toBe("/");
  });

  it("strips the prefix from nested paths", () => {
    expect(dropAdminPathPrefix("/admin/website")).toBe("/website");
    expect(dropAdminPathPrefix("/admin/inquiries")).toBe("/inquiries");
    expect(dropAdminPathPrefix("/admin/website/page_home")).toBe("/website/page_home");
  });

  it("returns null when the path is already unprefixed", () => {
    expect(dropAdminPathPrefix("/")).toBeNull();
    expect(dropAdminPathPrefix("/website")).toBeNull();
    expect(dropAdminPathPrefix("/login")).toBeNull();
  });
});

describe("isAdminPathPrefix", () => {
  it("detects only the /admin path prefix", () => {
    expect(isAdminPathPrefix("/admin")).toBe(true);
    expect(isAdminPathPrefix("/admin/login")).toBe(true);
    expect(isAdminPathPrefix("/login")).toBe(false);
    expect(isAdminPathPrefix("/administrator")).toBe(false);
  });
});

describe("shouldRedirectForHost admin app", () => {
  it("does not redirect the dashboard at /", () => {
    expect(
      shouldRedirectForHost({
        host: "admin.mccoy.nl",
        pathname: "/",
        protocol: "https",
        app: "admin",
      }),
    ).toBeNull();
  });

  it("does not redirect / to /admin", () => {
    expect(
      shouldRedirectForHost({
        host: "admin.mccoy.nl",
        pathname: "/",
        protocol: "https",
        app: "admin",
      }),
    ).toBeNull();
  });

  it("301s /admin/website to /website once and keeps the query", () => {
    expect(
      shouldRedirectForHost({
        host: "admin.mccoy.nl",
        pathname: "/admin/website",
        search: "?id=home",
        protocol: "https",
        app: "admin",
      }),
    ).toEqual({ redirectTo: "/website?id=home", status: 301 });
  });

  it("301s /admin/invite with auth query to /invite", () => {
    expect(
      shouldRedirectForHost({
        host: "localhost:5174",
        pathname: "/admin/invite",
        search: "?token_hash=abc&type=invite",
        protocol: "http",
        app: "admin",
      }),
    ).toEqual({ redirectTo: "/invite?token_hash=abc&type=invite", status: 301 });
  });

  it("does not rewrite /_serverFn", () => {
    expect(
      shouldRedirectForHost({
        host: "admin.mccoy.nl",
        pathname: "/_serverFn/xyz",
        protocol: "https",
        app: "admin",
      }),
    ).toBeNull();
  });

  it("does not redirect vercel.app preview hosts to admin.mccoy.nl", () => {
    expect(
      shouldRedirectForHost({
        host: "mccoy-platform-admin-3ghydymsu-mccoy1.vercel.app",
        pathname: "/",
        protocol: "https",
        app: "admin",
      }),
    ).toBeNull();

    expect(
      shouldRedirectForHost({
        host: "mccoy-platform-admin-git-development-mccoy1.vercel.app",
        pathname: "/website",
        protocol: "https",
        app: "admin",
      }),
    ).toBeNull();
  });

  it("strips /admin on vercel.app without bouncing to production admin host", () => {
    expect(
      shouldRedirectForHost({
        host: "mccoy-platform-admin-3ghydymsu-mccoy1.vercel.app",
        pathname: "/admin/website",
        protocol: "https",
        app: "admin",
      }),
    ).toEqual({ redirectTo: "/website", status: 301 });
  });
});

describe("shouldRedirectForHost storefront", () => {
  it("sends /admin/website to the admin host without the prefix", () => {
    expect(
      shouldRedirectForHost({
        host: "www.mccoy.nl",
        pathname: "/admin/website",
        protocol: "https",
        app: "storefront",
      }),
    ).toEqual({
      redirectTo: "https://admin.mccoy.nl/website",
      status: 301,
    });
  });

  it("sends admin-host hits on the storefront app to /", () => {
    expect(
      shouldRedirectForHost({
        host: "admin.mccoy.nl",
        pathname: "/",
        protocol: "https",
        app: "storefront",
      }),
    ).toEqual({ redirectTo: "https://admin.mccoy.nl/" });
  });
});
