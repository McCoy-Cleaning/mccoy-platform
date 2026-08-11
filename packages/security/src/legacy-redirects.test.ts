import { describe, expect, it } from "vitest";
import {
  LEGACY_GONE_PATHS,
  LEGACY_PERMANENT_REDIRECTS,
  buildLegacyRedirectLocation,
  resolveLegacyHttpAction,
  resolveLegacyUrlDecision,
} from "./legacy-redirects";

const REDIRECT_CASES: Array<{ from: string; to: string }> = [
  { from: "/cleaning", to: "/services" },
  { from: "/over-ons", to: "/about" },
  { from: "/collegas-gezocht", to: "/vacatures" },
  { from: "/solliciteer-direct", to: "/vacatures" },
  { from: "/privacybeleid", to: "/privacy" },
];

const GONE_CASES = ["/ultrasoon", "/actie"] as const;

describe("resolveLegacyUrlDecision", () => {
  for (const { from, to } of REDIRECT_CASES) {
    it(`301 ${from} → ${to}`, () => {
      expect(resolveLegacyUrlDecision(from)).toEqual({
        kind: "redirect",
        status: 301,
        toPath: to,
      });
    });

    it(`301 ${from}/ → ${to} (trailing slash)`, () => {
      expect(resolveLegacyUrlDecision(`${from}/`)).toEqual({
        kind: "redirect",
        status: 301,
        toPath: to,
      });
    });
  }

  for (const path of GONE_CASES) {
    it(`410 ${path}`, () => {
      expect(resolveLegacyUrlDecision(path)).toEqual({
        kind: "gone",
        status: 410,
      });
    });

    it(`410 ${path}/ (trailing slash, no soft-404 hop)`, () => {
      expect(resolveLegacyUrlDecision(`${path}/`)).toEqual({
        kind: "gone",
        status: 410,
      });
    });
  }

  it("does not remap unrelated 404s to home or products", () => {
    expect(resolveLegacyUrlDecision("/does-not-exist")).toBeNull();
    expect(resolveLegacyUrlDecision("/random-page/")).toBeNull();
    expect(resolveLegacyUrlDecision("/")).toBeNull();
    expect(resolveLegacyUrlDecision("/products")).toBeNull();
    expect(resolveLegacyUrlDecision("/aanbiedingen")).toBeNull();
  });

  it("exposes maps covering every Phase 2 locked path", () => {
    expect([...LEGACY_GONE_PATHS].sort()).toEqual(["/actie", "/ultrasoon"]);
    expect(Object.keys(LEGACY_PERMANENT_REDIRECTS).sort()).toEqual(
      REDIRECT_CASES.map((c) => c.from).sort(),
    );
  });
});

describe("buildLegacyRedirectLocation", () => {
  it("preserves query params on absolute www Location", () => {
    expect(
      buildLegacyRedirectLocation({
        toPath: "/services",
        search: "?utm_source=legacy&x=1",
        host: "www.mccoy.nl",
      }),
    ).toBe("https://www.mccoy.nl/services?utm_source=legacy&x=1");
  });

  it("one-hop apex host to www + mapped path", () => {
    expect(
      buildLegacyRedirectLocation({
        toPath: "/about",
        search: "?ref=old",
        host: "mccoy.nl",
      }),
    ).toBe("https://www.mccoy.nl/about?ref=old");
  });

  it("uses relative Location on localhost", () => {
    expect(
      buildLegacyRedirectLocation({
        toPath: "/vacatures",
        search: "?a=1",
        host: "localhost:3000",
      }),
    ).toBe("/vacatures?a=1");
  });

  it("does not mint preview hosts as canonical", () => {
    expect(
      buildLegacyRedirectLocation({
        toPath: "/privacy",
        host: "mccoy-storefront-git-seo.vercel.app",
      }),
    ).toBe("/privacy");
  });
});

describe("resolveLegacyHttpAction", () => {
  for (const { from, to } of REDIRECT_CASES) {
    it(`HTTP 301 ${from} Location → www${to}`, () => {
      expect(
        resolveLegacyHttpAction({
          pathname: from,
          host: "www.mccoy.nl",
          search: "?utm=1",
        }),
      ).toEqual({
        kind: "redirect",
        status: 301,
        location: `https://www.mccoy.nl${to}?utm=1`,
      });
    });

    it(`HTTP 301 ${from}/ one-hop (slash + legacy)`, () => {
      expect(
        resolveLegacyHttpAction({
          pathname: `${from}/`,
          host: "mccoy.nl",
          search: "",
        }),
      ).toEqual({
        kind: "redirect",
        status: 301,
        location: `https://www.mccoy.nl${to}`,
      });
    });
  }

  for (const path of GONE_CASES) {
    it(`HTTP 410 ${path}`, () => {
      expect(
        resolveLegacyHttpAction({ pathname: path, host: "www.mccoy.nl" }),
      ).toEqual({ kind: "gone", status: 410 });
    });

    it(`HTTP 410 ${path}/ without redirect hop`, () => {
      expect(
        resolveLegacyHttpAction({ pathname: `${path}/`, host: "www.mccoy.nl" }),
      ).toEqual({ kind: "gone", status: 410 });
    });
  }

  it("returns null for unknown paths (never soft-redirect to /)", () => {
    expect(
      resolveLegacyHttpAction({
        pathname: "/unknown-soft-404-candidate",
        host: "www.mccoy.nl",
      }),
    ).toBeNull();
  });
});

describe("Phase 4 light — host/slash + legacy composition", () => {
  it("non-legacy trailing slash is not claimed by legacy map (host layer owns slash)", () => {
    expect(resolveLegacyUrlDecision("/services/")).toBeNull();
    expect(resolveLegacyUrlDecision("/en/services/")).toBeNull();
    expect(resolveLegacyHttpAction({ pathname: "/products/", host: "www.mccoy.nl" })).toBeNull();
  });

  it("legacy slash + path still one-hop Absolute Location on apex", () => {
    expect(
      resolveLegacyHttpAction({
        pathname: "/cleaning/",
        host: "mccoy.nl",
        search: "?utm=1",
      }),
    ).toEqual({
      kind: "redirect",
      status: 301,
      location: "https://www.mccoy.nl/services?utm=1",
    });
  });

  it("documents apex→www then 410 for ultrasoon as acceptable remaining chain", () => {
    // App middleware returns 410 for path identity; Vercel cannot emit 410 on apex alone.
    // Apex request may 301→www first, then 410 — documented OK vs soft-404.
    expect(resolveLegacyHttpAction({ pathname: "/ultrasoon", host: "www.mccoy.nl" })).toEqual({
      kind: "gone",
      status: 410,
    });
    expect(resolveLegacyHttpAction({ pathname: "/ultrasoon/", host: "mccoy.nl" })).toEqual({
      kind: "gone",
      status: 410,
    });
  });
});


describe("Phase 11 — Response construction (storefront middleware mirror)", () => {
  function responseFromLegacyAction(
    action: ReturnType<typeof resolveLegacyHttpAction>,
  ): Response | null {
    if (!action) return null;
    if (action.kind === "gone") {
      return new Response(null, { status: 410, statusText: "Gone" });
    }
    return new Response(null, {
      status: action.status,
      headers: { Location: action.location },
    });
  }

  for (const path of GONE_CASES) {
    it(`builds real HTTP 410 Response for ${path} (not 200 soft-gone)`, () => {
      const action = resolveLegacyHttpAction({ pathname: path, host: "www.mccoy.nl" });
      const res = responseFromLegacyAction(action);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(410);
      expect(res!.headers.get("Location")).toBeNull();
    });
  }

  for (const { from, to } of REDIRECT_CASES) {
    it(`builds 301 Response with one-hop www Location for ${from}`, () => {
      const action = resolveLegacyHttpAction({
        pathname: from,
        host: "www.mccoy.nl",
        search: "?utm=1",
      });
      const res = responseFromLegacyAction(action);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(301);
      expect(res!.headers.get("Location")).toBe(`https://www.mccoy.nl${to}?utm=1`);
    });
  }

  it("apex host still one-hops Location to www canonical", () => {
    const action = resolveLegacyHttpAction({
      pathname: "/cleaning/",
      host: "mccoy.nl",
      search: "",
    });
    const res = responseFromLegacyAction(action);
    expect(res!.status).toBe(301);
    expect(res!.headers.get("Location")).toBe("https://www.mccoy.nl/services");
  });
});