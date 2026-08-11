import { describe, expect, it } from "vitest";
import {
  MCCOY_NAP,
  MCCOY_ORGANIZATION_ID,
  assertCanonicalJsonLdUrls,
  buildCityLandingJsonLd,
  buildJobPostingJsonLd,
  buildMccoyCleaningServiceJsonLd,
  collectBusinessEntityNodes,
  napAddressMultiline,
  napAddressSingleLine,
  napMailtoHref,
  napPostalAddressJsonLd,
  napTelHref,
} from "./business-nap";
import { assertFactOnlyJsonLd, CANONICAL_SITE_ORIGIN } from "./resolve-seo";
import { createDefaultVacancy } from "./blocks/jobs";
import { defaultSiteFooter } from "./footer";
import { defaultSectionContent } from "./content";

describe("MCCOY_NAP single source", () => {
  it("matches docs/seo/nap-canonical.md", () => {
    expect(MCCOY_NAP.name).toBe("McCoy Cleaning");
    expect(MCCOY_NAP.streetAddress).toBe("Nijverheidsstraat 63");
    expect(MCCOY_NAP.postalCode).toBe("7575 BH");
    expect(MCCOY_NAP.addressLocality).toBe("Oldenzaal");
    expect(MCCOY_NAP.addressRegion).toBe("Overijssel");
    expect(MCCOY_NAP.addressCountry).toBe("NL");
    expect(MCCOY_NAP.telephoneE164).toBe("+31541534982");
    expect(MCCOY_NAP.telephoneDisplayInternational).toBe("+31 541 534 982");
    expect(MCCOY_NAP.email).toBe("info@mccoy.nl");
    expect(MCCOY_NAP.website).toBe(CANONICAL_SITE_ORIGIN);
    expect(MCCOY_ORGANIZATION_ID).toBe("https://www.mccoy.nl/#organization");
  });

  it("formats address / tel / mailto helpers from NAP", () => {
    expect(napAddressSingleLine()).toBe("Nijverheidsstraat 63, 7575 BH Oldenzaal");
    expect(napAddressMultiline()).toBe("Nijverheidsstraat 63\n7575 BH Oldenzaal");
    expect(napTelHref()).toBe("tel:+31541534982");
    expect(napMailtoHref()).toBe("mailto:info@mccoy.nl");
    expect(napPostalAddressJsonLd()).toEqual({
      "@type": "PostalAddress",
      streetAddress: "Nijverheidsstraat 63",
      postalCode: "7575 BH",
      addressLocality: "Oldenzaal",
      addressRegion: "Overijssel",
      addressCountry: "NL",
    });
  });

  it("wires footer contact defaults to NAP", () => {
    const footer = defaultSiteFooter();
    const addr = footer.contactRows.find((r) => r.id === "footer_contact_addr");
    const phone = footer.contactRows.find((r) => r.id === "footer_contact_phone");
    const email = footer.contactRows.find((r) => r.id === "footer_contact_email");
    expect(addr?.label).toBe(napAddressSingleLine());
    expect(phone?.label).toBe(MCCOY_NAP.telephoneDisplayNational);
    expect(phone?.href).toBe(napTelHref());
    expect(email?.label).toBe(MCCOY_NAP.email);
    expect(email?.href).toBe(napMailtoHref());
  });

  it("wires contact + offerte info seeds to NAP", () => {
    const contact = defaultSectionContent("contact.info") as {
      items: Array<{ id: string; value?: string; href?: string }>;
    };
    const offerte = defaultSectionContent("offerte.info") as {
      items: Array<{ id: string; value?: string; href?: string }>;
    };
    const contactAddr = contact.items.find((i) => i.id === "contact_address");
    const offerteAddr = offerte.items.find((i) => i.id === "offerte_address");
    expect(contactAddr?.value).toBe(napAddressMultiline());
    expect(offerteAddr?.value).toBe(napAddressMultiline());
    expect(contact.items.find((i) => i.id === "contact_phone")?.value).toBe(
      MCCOY_NAP.telephoneDisplayNational,
    );
    expect(contact.items.find((i) => i.id === "contact_email")?.value).toBe(MCCOY_NAP.email);
  });
});

describe("business JSON-LD invariants", () => {
  it("emits one CleaningService with stable @id and fact-only fields", () => {
    const ld = buildMccoyCleaningServiceJsonLd({ image: "/logo.png" });
    assertFactOnlyJsonLd(ld);
    assertCanonicalJsonLdUrls(ld);
    expect(ld["@type"]).toBe("CleaningService");
    expect(ld["@id"]).toBe(MCCOY_ORGANIZATION_ID);
    expect(ld.url).toBe(CANONICAL_SITE_ORIGIN);
    expect(ld.telephone).toBe(MCCOY_NAP.telephoneE164);
    expect(ld).not.toHaveProperty("aggregateRating");
    expect(JSON.stringify(ld)).not.toMatch(/AggregateRating|Review/);
  });

  it("city landing references org @id without a second LocalBusiness", () => {
    const sitewide = buildMccoyCleaningServiceJsonLd();
    const city = buildCityLandingJsonLd("Enschede", "/schoonmaakbedrijf-enschede");
    assertFactOnlyJsonLd(city);
    assertCanonicalJsonLdUrls(city);
    expect(city["@type"]).toBe("WebPage");
    expect(city.url).toBe("https://www.mccoy.nl/schoonmaakbedrijf-enschede");
    expect(city.about).toEqual({ "@id": MCCOY_ORGANIZATION_ID });
    expect(city.provider).toEqual({ "@id": MCCOY_ORGANIZATION_ID });

    const entities = collectBusinessEntityNodes({
      "@graph": [sitewide, city],
    });
    const withId = entities.filter((e) => e["@id"] === MCCOY_ORGANIZATION_ID);
    expect(withId).toHaveLength(1);
    expect(withId[0]?.["@type"]).toBe("CleaningService");
    expect(entities.some((e) => e["@type"] === "LocalBusiness")).toBe(false);
  });

  it("JobPosting is detail-page scoped and references the same org @id", () => {
    const vacancy = createDefaultVacancy({
      id: "job_seed_glazenwasser",
      title: "Glazenwasser",
      slug: "glazenwasser",
      shortDescription: "Glasbewassing in Twente.",
      employmentType: "full-time",
      location: "Twente",
      startDate: "2026-01-15",
    });
    const job = buildJobPostingJsonLd(vacancy);
    expect(job).not.toBeNull();
    if (!job) return;
    assertFactOnlyJsonLd(job);
    assertCanonicalJsonLdUrls(job);
    expect(job["@type"]).toBe("JobPosting");
    expect(job.url).toBe("https://www.mccoy.nl/vacatures/glazenwasser");
    expect(job.datePosted).toBe("2026-01-15");
    expect((job.hiringOrganization as Record<string, unknown>)["@id"]).toBe(
      MCCOY_ORGANIZATION_ID,
    );
  });

  it("rejects non-www McCoy hosts in JSON-LD URLs", () => {
    expect(() =>
      assertCanonicalJsonLdUrls({
        "@id": "https://mccoy.nl/#organization",
      }),
    ).toThrow(/www\.mccoy\.nl/);
    expect(() =>
      assertCanonicalJsonLdUrls({
        url: "https://admin.mccoy.nl/secret",
      }),
    ).toThrow(/forbidden host/);
  });

  it("returns null JobPosting when description facts are missing", () => {
    expect(
      buildJobPostingJsonLd(
        createDefaultVacancy({ title: "X", shortDescription: "", fullDescription: "" }),
      ),
    ).toBeNull();
  });
});
