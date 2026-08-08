import { describe, expect, it } from "vitest";
import {
  resolveCanonicalHostRedirect,
  stripTrailingSlashPath,
} from "./host";

describe("resolveCanonicalHostRedirect", () => {
  it("redirects apex http to https www in one hop", () => {
    const r = resolveCanonicalHostRedirect({
      host: "mccoy.nl",
      pathname: "/contact",
      search: "?utm_source=test",
      protocol: "http",
    });
    expect(r).toEqual({
      redirectTo: "https://www.mccoy.nl/contact?utm_source=test",
      status: 301,
      reason: "combined",
    });
  });

  it("redirects apex https to www", () => {
    const r = resolveCanonicalHostRedirect({
      host: "mccoy.nl",
      pathname: "/about",
      protocol: "https",
    });
    expect(r?.redirectTo).toBe("https://www.mccoy.nl/about");
    expect(r?.status).toBe(301);
  });

  it("strips trailing slash on www without looping", () => {
    const r = resolveCanonicalHostRedirect({
      host: "www.mccoy.nl",
      pathname: "/services/",
      protocol: "https",
    });
    expect(r).toEqual({
      redirectTo: "https://www.mccoy.nl/services",
      status: 301,
      reason: "trailing_slash",
    });
  });

  it("returns null when already canonical", () => {
    expect(
      resolveCanonicalHostRedirect({
        host: "www.mccoy.nl",
        pathname: "/contact",
        protocol: "https",
      }),
    ).toBeNull();
  });

  it("does not redirect localhost", () => {
    expect(
      resolveCanonicalHostRedirect({
        host: "localhost:3000",
        pathname: "/contact/",
        protocol: "http",
      }),
    ).toBeNull();
  });

  it("does not redirect admin host to www", () => {
    expect(
      resolveCanonicalHostRedirect({
        host: "admin.mccoy.nl",
        pathname: "/admin",
        protocol: "https",
      }),
    ).toBeNull();
  });

  it("preserves utm on trailing-slash redirect", () => {
    const r = resolveCanonicalHostRedirect({
      host: "www.mccoy.nl",
      pathname: "/offerte/",
      search: "?utm_campaign=a",
      protocol: "https",
    });
    expect(r?.redirectTo).toBe("https://www.mccoy.nl/offerte?utm_campaign=a");
  });
});

describe("stripTrailingSlashPath", () => {
  it("keeps root slash", () => {
    expect(stripTrailingSlashPath("/")).toBe("/");
    expect(stripTrailingSlashPath("/about/")).toBe("/about");
  });
});
