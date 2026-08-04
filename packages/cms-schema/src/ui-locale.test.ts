import { describe, expect, it } from "vitest";
import {
  preferredLocaleFromAcceptLanguage,
  preferredLocaleFromCookie,
  resolveHeroHeadingParts,
  resolveUiLangFromHints,
  resolveUiLocale,
  UI_LOCALE_COOKIE,
} from "./ui-locale";

describe("preferredLocaleFromCookie", () => {
  it("reads mccoy-lang from Cookie header", () => {
    expect(preferredLocaleFromCookie(`${UI_LOCALE_COOKIE}=en; other=1`)).toBe("en");
    expect(preferredLocaleFromCookie(`a=1; ${UI_LOCALE_COOKIE}=nl`)).toBe("nl");
  });

  it("ignores invalid values", () => {
    expect(preferredLocaleFromCookie(`${UI_LOCALE_COOKIE}=fr`)).toBeNull();
    expect(preferredLocaleFromCookie(null)).toBeNull();
  });
});

describe("preferredLocaleFromAcceptLanguage", () => {
  it("prefers highest q-factor among nl/en", () => {
    expect(preferredLocaleFromAcceptLanguage("fr-FR,en-US;q=0.9,nl;q=0.8")).toBe("en");
    expect(preferredLocaleFromAcceptLanguage("nl-NL,en;q=0.5")).toBe("nl");
  });

  it("returns null when no nl/en tag", () => {
    expect(preferredLocaleFromAcceptLanguage("de-DE,fr;q=0.9")).toBeNull();
    expect(preferredLocaleFromAcceptLanguage("")).toBeNull();
  });
});

describe("resolveUiLocale", () => {
  it("URL wins over cookie and Accept-Language", () => {
    expect(
      resolveUiLocale({
        pathname: "/en/services",
        cookieLocale: "nl",
        acceptLanguageLocale: "nl",
      }),
    ).toEqual({ locale: "en", source: "url" });
  });

  it("cookie wins over Accept-Language on NL paths", () => {
    expect(
      resolveUiLocale({
        pathname: "/",
        cookieLocale: "en",
        acceptLanguageLocale: "nl",
      }),
    ).toEqual({ locale: "en", source: "cookie" });
  });

  it("Accept-Language wins when no cookie", () => {
    expect(
      resolveUiLocale({
        pathname: "/",
        cookieLocale: null,
        acceptLanguageLocale: "en",
      }),
    ).toEqual({ locale: "en", source: "accept-language" });
  });

  it("defaults to nl", () => {
    expect(resolveUiLocale({ pathname: "/" })).toEqual({
      locale: "nl",
      source: "default",
    });
  });
});

describe("resolveUiLangFromHints", () => {
  it("SSR path: cookie beats Accept-Language", () => {
    expect(
      resolveUiLangFromHints({
        pathname: "/",
        cookieHeader: `${UI_LOCALE_COOKIE}=en`,
        acceptLanguage: "nl-NL,en;q=0.8",
      }),
    ).toBe("en");
  });

  it("SSR path: Accept-Language when no cookie", () => {
    expect(
      resolveUiLangFromHints({
        pathname: "/services",
        cookieHeader: null,
        acceptLanguage: "en-US,en;q=0.9",
      }),
    ).toBe("en");
  });

  it("client path: fallbackLocale when cookie absent", () => {
    expect(
      resolveUiLangFromHints({
        pathname: "/",
        cookieHeader: "",
        acceptLanguage: null,
        fallbackLocale: "en",
      }),
    ).toBe("en");
  });

  it("URL /en wins over all hints", () => {
    expect(
      resolveUiLangFromHints({
        pathname: "/en/about",
        cookieHeader: `${UI_LOCALE_COOKIE}=nl`,
        acceptLanguage: "nl",
        fallbackLocale: "nl",
      }),
    ).toBe("en");
  });
});

describe("resolveHeroHeadingParts", () => {
  it("keeps split heading + accent when not duplicated", () => {
    expect(resolveHeroHeadingParts("Bij McCoy wordt kwaliteit", "zichtbaar.")).toEqual({
      heading: "Bij McCoy wordt kwaliteit",
      headingAccent: "zichtbaar.",
    });
  });

  it("strips accent already present at end of heading", () => {
    expect(
      resolveHeroHeadingParts("At McCoy, quality is visible.", "visible."),
    ).toEqual({
      heading: "At McCoy, quality is",
      headingAccent: "visible.",
    });
    expect(
      resolveHeroHeadingParts("Bij McCoy wordt kwaliteit zichtbaar.", "zichtbaar."),
    ).toEqual({
      heading: "Bij McCoy wordt kwaliteit",
      headingAccent: "zichtbaar.",
    });
  });

  it("handles empty accent", () => {
    expect(resolveHeroHeadingParts("Title only", "")).toEqual({
      heading: "Title only",
      headingAccent: "",
    });
  });
});
