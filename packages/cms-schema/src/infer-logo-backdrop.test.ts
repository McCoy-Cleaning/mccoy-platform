/**
 * Logo backdrop unit tests — plate color → box hex; white default for existing.
 */
import { describe, expect, it } from "vitest";
import {
  inferLogoBackdrop,
  isPlateCssColor,
  LOGO_BACKDROP_BLACK,
  LOGO_BACKDROP_WHITE,
  logoBackdropFromCssColor,
  logoBackdropFromPlateMatte,
  normalizeLogoBackdropColor,
  resolveLogoBackdrop,
  rgbToLogoBackdropHex,
} from "./infer-logo-backdrop";

describe("rgbToLogoBackdropHex / logoBackdropFromPlateMatte", () => {
  it("formats plate RGB as #rrggbb", () => {
    expect(rgbToLogoBackdropHex({ r: 3, g: 41, b: 90 })).toBe("#03295a");
    expect(logoBackdropFromPlateMatte({ r: 254, g: 254, b: 254 })).toBe("#fefefe");
    expect(logoBackdropFromPlateMatte({ r: 0, g: 0, b: 0 })).toBe("#000000");
  });

  it("defaults to white when no matte was removed", () => {
    expect(logoBackdropFromPlateMatte(null)).toBe(LOGO_BACKDROP_WHITE);
    expect(logoBackdropFromPlateMatte(undefined)).toBe(LOGO_BACKDROP_WHITE);
  });
});

describe("inferLogoBackdrop", () => {
  it("returns white (plate path replaces ink-luminance mats)", () => {
    const data = new Uint8ClampedArray(4);
    data[0] = 250;
    data[1] = 250;
    data[2] = 250;
    data[3] = 255;
    expect(inferLogoBackdrop({ data, width: 1, height: 1 })).toBe(LOGO_BACKDROP_WHITE);
  });
});

describe("normalizeLogoBackdropColor / isPlateCssColor", () => {
  it("maps keywords and hex", () => {
    expect(normalizeLogoBackdropColor("#fff")).toBe(LOGO_BACKDROP_WHITE);
    expect(normalizeLogoBackdropColor("light")).toBe(LOGO_BACKDROP_WHITE);
    expect(normalizeLogoBackdropColor("dark")).toBe(LOGO_BACKDROP_BLACK);
    expect(normalizeLogoBackdropColor("#03295a")).toBe("#03295a");
    expect(normalizeLogoBackdropColor("#b2b")).toBe("#bb22bb");
  });

  it("treats legacy light|dark as non-plate tokens", () => {
    expect(isPlateCssColor("light")).toBe(false);
    expect(isPlateCssColor("dark")).toBe(false);
    expect(isPlateCssColor("#03295a")).toBe(true);
    expect(isPlateCssColor("#ffffff")).toBe(true);
  });
});

describe("logoBackdropFromCssColor", () => {
  it("maps white/black and hex plates to normalized hex", () => {
    expect(logoBackdropFromCssColor("#ffffff")).toBe(LOGO_BACKDROP_WHITE);
    expect(logoBackdropFromCssColor("#000000")).toBe(LOGO_BACKDROP_BLACK);
    expect(logoBackdropFromCssColor("#fefefe")).toBe("#fefefe");
    expect(logoBackdropFromCssColor("#1d1d1b")).toBe("#1d1d1b");
    expect(logoBackdropFromCssColor("#b2b2b2")).toBe("#b2b2b2");
    expect(logoBackdropFromCssColor("#03295a")).toBe("#03295a");
  });
});

describe("resolveLogoBackdrop", () => {
  it("prefers manual override over cached plate color", () => {
    expect(
      resolveLogoBackdrop({ logoBackdrop: "dark", resolvedBackdrop: "#fefefe" }),
    ).toBe(LOGO_BACKDROP_BLACK);
    expect(
      resolveLogoBackdrop({ logoBackdrop: "light", resolvedBackdrop: "#03295a" }),
    ).toBe(LOGO_BACKDROP_WHITE);
    expect(
      resolveLogoBackdrop({ logoBackdrop: "auto", resolvedBackdrop: "#03295a" }),
    ).toBe("#03295a");
    expect(resolveLogoBackdrop({ logoBackdrop: "auto" })).toBe(LOGO_BACKDROP_WHITE);
    expect(
      resolveLogoBackdrop({ logoBackdrop: "auto", resolvedBackdrop: "dark" }),
    ).toBe(LOGO_BACKDROP_WHITE);
  });
});
