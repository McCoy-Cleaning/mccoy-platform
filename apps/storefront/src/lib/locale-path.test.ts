import { describe, expect, it } from "vitest";
import { mapPathnameToLocale, type LocalePathPage } from "./locale-path";

const pages: LocalePathPage[] = [
  { slug: "/", paths: { nl: "/", en: "/" } },
  { slug: "/products", paths: { nl: "/products", en: "/products" } },
  { slug: "/vacatures", paths: { nl: "/vacatures", en: "/vacatures" } },
  { slug: "/services", paths: { nl: "/services", en: "/services" } },
  { slug: "/over-ons", paths: { nl: "/over-ons", en: "/about" } },
];

describe("mapPathnameToLocale", () => {
  it("maps home NL ↔ EN", () => {
    expect(mapPathnameToLocale("/", "en", pages)).toBe("/en");
    expect(mapPathnameToLocale("/en", "nl", pages)).toBe("/");
  });

  it("maps products with canonical EN slug", () => {
    expect(mapPathnameToLocale("/products", "en", pages)).toBe("/en/products");
    expect(mapPathnameToLocale("/en/products", "nl", pages)).toBe("/products");
  });

  it("canonicalizes EN aliases like /en/producten → /en/products", () => {
    expect(mapPathnameToLocale("/en/producten", "en", pages)).toBe("/en/products");
    expect(mapPathnameToLocale("/en/producten", "nl", pages)).toBe("/products");
    expect(mapPathnameToLocale("/producten", "en", pages)).toBe("/en/products");
  });

  it("maps vacatures and preserves nested slug", () => {
    expect(mapPathnameToLocale("/vacatures", "en", pages)).toBe("/en/vacatures");
    expect(mapPathnameToLocale("/en/vacatures", "nl", pages)).toBe("/vacatures");
    expect(mapPathnameToLocale("/vacatures/senior-cleaner", "en", pages)).toBe(
      "/en/vacatures/senior-cleaner",
    );
    expect(mapPathnameToLocale("/en/vacatures/senior-cleaner", "nl", pages)).toBe(
      "/vacatures/senior-cleaner",
    );
  });

  it("uses distinct EN identity when pages differ (nl ≠ en slug)", () => {
    expect(mapPathnameToLocale("/over-ons", "en", pages)).toBe("/en/about");
    expect(mapPathnameToLocale("/en/about", "nl", pages)).toBe("/over-ons");
  });

  it("falls back without pages via strip/prefix + aliases", () => {
    expect(mapPathnameToLocale("/products", "en")).toBe("/en/products");
    expect(mapPathnameToLocale("/en/products", "nl")).toBe("/products");
    expect(mapPathnameToLocale("/en/jobs", "nl")).toBe("/vacatures");
    expect(mapPathnameToLocale("/en/jobs", "en")).toBe("/en/vacatures");
  });
});
