import { describe, expect, it } from "vitest";
import {
  LEGACY_GONE_PATHS,
  LEGACY_PERMANENT_REDIRECTS,
} from "./legacy-redirects";
import {
  MAJOR_PUBLIC_CANONICAL_PATHS,
  assertInternalLinkIntegrity,
  collectInternalLinkIntegrityIssues,
  evaluateInternalLinkHref,
  parseMccoyInternalHref,
  type InternalLinkRef,
} from "./internal-link-integrity";

/**
 * Inventory of McCoy-owned hrefs emitted on major public surfaces
 * (chrome defaults + service hash links + city landings). Hashes allowed.
 */
const MAJOR_PUBLIC_INTERNAL_LINKS: InternalLinkRef[] = [
  // Nav / chrome (NL pages)
  { href: "/", source: "nav:home", sourceLocale: "nl" },
  { href: "/services", source: "nav:services", sourceLocale: "nl" },
  { href: "/products", source: "nav:products", sourceLocale: "nl" },
  { href: "/about", source: "nav:about", sourceLocale: "nl" },
  { href: "/contact", source: "nav:contact", sourceLocale: "nl" },
  { href: "/vacatures", source: "nav:jobs", sourceLocale: "nl" },
  { href: "/offerte", source: "nav:quote", sourceLocale: "nl" },
  { href: "/privacy", source: "footer:legal", sourceLocale: "nl" },
  { href: "/terms", source: "footer:legal", sourceLocale: "nl" },
  // Footer service hashes (Phase 8)
  { href: "/services#reguliere-schoonmaak", source: "footer:svc", sourceLocale: "nl" },
  { href: "/services#horeca-schoonmaak", source: "footer:svc", sourceLocale: "nl" },
  { href: "/services#opleveringsschoonmaak", source: "footer:svc", sourceLocale: "nl" },
  { href: "/services#vloeronderhoud", source: "footer:svc", sourceLocale: "nl" },
  { href: "/services#meubelreiniging", source: "footer:svc", sourceLocale: "nl" },
  { href: "/services#glas-gevelreiniging", source: "footer:svc", sourceLocale: "nl" },
  // City landings
  { href: "/schoonmaakbedrijf-enschede", source: "city:enschede", sourceLocale: "nl" },
  { href: "/schoonmaakbedrijf-hengelo", source: "city:hengelo", sourceLocale: "nl" },
  // EN chrome / service hashes
  { href: "/en", source: "nav:home", sourceLocale: "en" },
  { href: "/en/services", source: "nav:services", sourceLocale: "en" },
  { href: "/en/services#reguliere-schoonmaak", source: "footer:svc", sourceLocale: "en" },
  { href: "/en/services#horeca-schoonmaak", source: "footer:svc", sourceLocale: "en" },
  { href: "/en/about", source: "nav:about", sourceLocale: "en" },
  { href: "/en/contact", source: "nav:contact", sourceLocale: "en" },
  { href: "/en/offerte", source: "nav:quote", sourceLocale: "en" },
  { href: "/en/vacatures", source: "nav:jobs", sourceLocale: "en" },
  { href: "/en/products", source: "nav:products", sourceLocale: "en" },
  { href: "/en/privacy", source: "footer:legal", sourceLocale: "en" },
  { href: "/en/terms", source: "footer:legal", sourceLocale: "en" },
];

describe("internal-link integrity gate (Phase 8)", () => {
  it("accepts the major public inventory", () => {
    expect(() => assertInternalLinkIntegrity(MAJOR_PUBLIC_INTERNAL_LINKS)).not.toThrow();
    expect(collectInternalLinkIntegrityIssues(MAJOR_PUBLIC_INTERNAL_LINKS)).toEqual([]);
  });

  it("rejects Phase 2 legacy redirect destinations as link targets", () => {
    for (const from of Object.keys(LEGACY_PERMANENT_REDIRECTS)) {
      const issue = evaluateInternalLinkHref(from);
      expect(issue?.reason).toBe("legacy_redirect");
    }
  });

  it("rejects Phase 2 gone destinations as link targets", () => {
    for (const path of LEGACY_GONE_PATHS) {
      expect(evaluateInternalLinkHref(path)?.reason).toBe("gone");
      expect(evaluateInternalLinkHref(`${path}/`)?.reason).toBe("noncanonical_slash");
    }
  });

  it("rejects trailing-slash and apex-host variants", () => {
    expect(evaluateInternalLinkHref("/services/")?.reason).toBe("noncanonical_slash");
    expect(evaluateInternalLinkHref("https://mccoy.nl/services")?.reason).toBe(
      "noncanonical_host",
    );
  });

  it("rejects identity aliases and wrong-locale peers", () => {
    expect(evaluateInternalLinkHref("/producten")?.reason).toBe("identity_alias");
    expect(
      evaluateInternalLinkHref("/services", { sourceLocale: "en" })?.reason,
    ).toBe("wrong_locale");
    expect(
      evaluateInternalLinkHref("/en/services#vloeronderhoud", { sourceLocale: "en" }),
    ).toBeNull();
  });

  it("skips external and mailto/tel hrefs", () => {
    expect(parseMccoyInternalHref("https://facebook.com/x")).toBeNull();
    expect(evaluateInternalLinkHref("mailto:info@mccoy.nl")).toBeNull();
    expect(evaluateInternalLinkHref("tel:+31541534982")).toBeNull();
    expect(evaluateInternalLinkHref("#section")).toBeNull();
  });

  it("allows www absolute and root-relative canonicals with hashes", () => {
    expect(
      evaluateInternalLinkHref("https://www.mccoy.nl/services#meubelreiniging"),
    ).toBeNull();
    expect(MAJOR_PUBLIC_CANONICAL_PATHS).toContain("/services");
    expect(MAJOR_PUBLIC_CANONICAL_PATHS).toContain("/en/services");
  });
});
