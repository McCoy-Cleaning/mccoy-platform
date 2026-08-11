/**
 * Phase 9 — single canonical NAP + fact-only business JSON-LD helpers.
 *
 * Authoritative values match `docs/seo/nap-canonical.md`.
 * Sitewide entity uses a stable `@id` so page-level nodes can reference it
 * without emitting a second Organization / LocalBusiness identity.
 */

import { absoluteCanonicalUrl, CANONICAL_SITE_ORIGIN } from "./resolve-seo";
import type { EmploymentType, VacancyItem } from "./blocks/jobs";
import { resolveVacancyPublicSlug } from "./blocks/jobs";

/** Stable graph id for the one McCoy Cleaning business entity. */
export const MCCOY_ORGANIZATION_ID = `${CANONICAL_SITE_ORIGIN}/#organization`;

/**
 * Canonical Name / Address / Phone (and related contact facts).
 * Do not duplicate these literals elsewhere — import from this module.
 */
export const MCCOY_NAP = {
  name: "McCoy Cleaning",
  streetAddress: "Nijverheidsstraat 63",
  postalCode: "7575 BH",
  addressLocality: "Oldenzaal",
  addressRegion: "Overijssel",
  addressCountry: "NL",
  /** Schema.org / tel: E.164 without spaces. */
  telephoneE164: "+31541534982",
  /** Human-readable international form from nap-canonical.md. */
  telephoneDisplayInternational: "+31 541 534 982",
  /** National display used in footer / contact seeds. */
  telephoneDisplayNational: "0541 534 982",
  email: "info@mccoy.nl",
  website: CANONICAL_SITE_ORIGIN,
  /** Existing published office-hours band (not invented for SEO). */
  officeHoursLabelNl: "Maandag t/m vrijdag 08:30 – 17:00",
  openingHours: {
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"] as const,
    opens: "08:30",
    closes: "17:00",
  },
  priceRange: "€€",
} as const;

export type MccoyNap = typeof MCCOY_NAP;

/** Single-line address for footer / compact UI. */
export function napAddressSingleLine(): string {
  return `${MCCOY_NAP.streetAddress}, ${MCCOY_NAP.postalCode} ${MCCOY_NAP.addressLocality}`;
}

/** Multiline address for contact / offerte info cards. */
export function napAddressMultiline(): string {
  return `${MCCOY_NAP.streetAddress}\n${MCCOY_NAP.postalCode} ${MCCOY_NAP.addressLocality}`;
}

export function napTelHref(): string {
  return `tel:${MCCOY_NAP.telephoneE164}`;
}

export function napMailtoHref(): string {
  return `mailto:${MCCOY_NAP.email}`;
}

/** schema.org PostalAddress from canonical NAP. */
export function napPostalAddressJsonLd(): Record<string, unknown> {
  return {
    "@type": "PostalAddress",
    streetAddress: MCCOY_NAP.streetAddress,
    postalCode: MCCOY_NAP.postalCode,
    addressLocality: MCCOY_NAP.addressLocality,
    addressRegion: MCCOY_NAP.addressRegion,
    addressCountry: MCCOY_NAP.addressCountry,
  };
}

const DEFAULT_SERVICE_TYPES = [
  "Kantoorschoonmaak",
  "Glasbewassing",
  "Vloeronderhoud",
  "Horeca schoonmaak",
  "Opleveringsschoonmaak",
  "Tapijtreiniging",
] as const;

const DEFAULT_AREA_SERVED = [
  { "@type": "City", name: "Oldenzaal" },
  { "@type": "City", name: "Hengelo" },
  { "@type": "City", name: "Enschede" },
  { "@type": "City", name: "Almelo" },
  { "@type": "AdministrativeArea", name: "Twente" },
] as const;

export type CleaningServiceJsonLdOptions = {
  /** Absolute or site-relative logo URL already published on the site. */
  image?: string;
  description?: string;
};

/**
 * Sitewide CleaningService (LocalBusiness subtype) — emit once in root head.
 * Always uses `@id` = MCCOY_ORGANIZATION_ID so other pages can reference it.
 */
export function buildMccoyCleaningServiceJsonLd(
  options?: CleaningServiceJsonLdOptions,
): Record<string, unknown> {
  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CleaningService",
    "@id": MCCOY_ORGANIZATION_ID,
    name: MCCOY_NAP.name,
    url: MCCOY_NAP.website,
    telephone: MCCOY_NAP.telephoneE164,
    email: MCCOY_NAP.email,
    priceRange: MCCOY_NAP.priceRange,
    address: napPostalAddressJsonLd(),
    areaServed: [...DEFAULT_AREA_SERVED],
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: [...MCCOY_NAP.openingHours.days],
        opens: MCCOY_NAP.openingHours.opens,
        closes: MCCOY_NAP.openingHours.closes,
      },
    ],
    serviceType: [...DEFAULT_SERVICE_TYPES],
    description:
      options?.description ??
      "Professioneel schoonmaakbedrijf in Twente. Kantoorschoonmaak, glasbewassing, vloeronderhoud, horeca- en opleveringsschoonmaak.",
  };
  if (options?.image) node.image = options.image;
  return node;
}

/**
 * City landing JSON-LD — WebPage + areaServed that *references* the sitewide
 * organization `@id`. Does not emit a second LocalBusiness / Organization.
 */
export function buildCityLandingJsonLd(city: string, path: string): Record<string, unknown> {
  const absolute = absoluteCanonicalUrl(path);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${absolute}#webpage`,
    url: absolute,
    name: `Schoonmaakbedrijf ${city} — ${MCCOY_NAP.name}`,
    description: `Professioneel schoonmaakbedrijf actief in ${city} en omgeving. Kantoorschoonmaak, glasbewassing, vloeronderhoud en horecaschoonmaak.`,
    about: { "@id": MCCOY_ORGANIZATION_ID },
    provider: { "@id": MCCOY_ORGANIZATION_ID },
    areaServed: { "@type": "City", name: city },
    isPartOf: {
      "@type": "WebSite",
      name: MCCOY_NAP.name,
      url: MCCOY_NAP.website,
    },
  };
}

const SCHEMA_EMPLOYMENT: Record<EmploymentType, string> = {
  "full-time": "FULL_TIME",
  "part-time": "PART_TIME",
  temporary: "TEMPORARY",
  freelance: "CONTRACTOR",
  internship: "INTERN",
  "on-call": "OTHER",
  other: "OTHER",
};

export type JobPostingJsonLdOptions = {
  /** ISO datePosted override; defaults to vacancy.startDate when present. */
  datePosted?: string;
};

/**
 * Fact-only JobPosting for a single vacancy detail URL.
 * Prefer emitting this on `/vacatures/$slug`, not as a multi-job array on `/vacatures`
 * (Google JobPosting eligibility expects one posting per detail page).
 *
 * Returns null when required facts (title + description) are missing.
 * Omits `datePosted` when unknown — do not invent a posting date.
 */
export function buildJobPostingJsonLd(
  vacancy: Pick<
    VacancyItem,
    | "title"
    | "shortDescription"
    | "fullDescription"
    | "employmentType"
    | "location"
    | "startDate"
    | "applicationDeadline"
    | "id"
    | "slug"
  >,
  options?: JobPostingJsonLdOptions,
): Record<string, unknown> | null {
  const title = vacancy.title?.trim();
  const description =
    (vacancy.fullDescription?.trim() || vacancy.shortDescription?.trim() || "").trim();
  if (!title || !description) return null;

  const slug = resolveVacancyPublicSlug(vacancy);
  const jobUrl = absoluteCanonicalUrl(`/vacatures/${slug}`);
  const datePosted = options?.datePosted?.trim() || vacancy.startDate?.trim() || undefined;

  const node: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "@id": `${jobUrl}#jobposting`,
    title,
    description,
    url: jobUrl,
    employmentType: SCHEMA_EMPLOYMENT[vacancy.employmentType] ?? "OTHER",
    hiringOrganization: {
      "@type": "Organization",
      "@id": MCCOY_ORGANIZATION_ID,
      name: MCCOY_NAP.name,
      sameAs: MCCOY_NAP.website,
      url: MCCOY_NAP.website,
    },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: vacancy.location?.trim() || MCCOY_NAP.addressLocality,
        addressRegion: MCCOY_NAP.addressRegion,
        addressCountry: MCCOY_NAP.addressCountry,
      },
    },
    identifier: {
      "@type": "PropertyValue",
      name: MCCOY_NAP.name,
      value: vacancy.id,
    },
  };

  if (datePosted) node.datePosted = datePosted;
  if (vacancy.applicationDeadline?.trim()) {
    node.validThrough = vacancy.applicationDeadline.trim();
  }

  return node;
}

/**
 * Collect Organization / LocalBusiness / CleaningService nodes (including @graph).
 * Used by tests to prove a payload does not introduce a second business identity.
 */
export function collectBusinessEntityNodes(
  payload: unknown,
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  const seen = new Set<object>();
  const stack: unknown[] = [payload];
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;
    if (seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    const obj = node as Record<string, unknown>;
    const types = Array.isArray(obj["@type"])
      ? obj["@type"].map(String)
      : obj["@type"] != null
        ? [String(obj["@type"])]
        : [];
    const isBusiness = types.some(
      (t) =>
        t === "Organization" ||
        t === "LocalBusiness" ||
        t === "CleaningService" ||
        t.endsWith("Business"),
    );
    if (isBusiness) {
      out.push(obj);
      // Still walk nested nodes so hiringOrganization references are visible,
      // but skip descending into unrelated graph siblings twice via @graph.
    }
    if ("@graph" in obj && Array.isArray(obj["@graph"])) {
      stack.push(...obj["@graph"]);
      continue;
    }
    for (const value of Object.values(obj)) {
      if (value && typeof value === "object") stack.push(value);
    }
  }
  return out;
}

/**
 * Assert every absolute http(s) URL / `@id` in JSON-LD stays on www.mccoy.nl
 * (or is a non-McCoy external URL). Rejects preview/localhost/admin hosts and
 * apex `https://mccoy.nl` without www for McCoy identities.
 */
export function assertCanonicalJsonLdUrls(payload: unknown): void {
  const stack: unknown[] = [payload];
  while (stack.length) {
    const node = stack.pop();
    if (typeof node === "string") {
      if (!/^https?:\/\//i.test(node)) continue;
      let url: URL;
      try {
        url = new URL(node);
      } catch {
        throw new Error(`json-ld: invalid URL ${node}`);
      }
      const host = url.hostname.toLowerCase();
      if (
        host === "localhost" ||
        host.endsWith(".localhost") ||
        host.endsWith(".vercel.app") ||
        host === "127.0.0.1" ||
        host === "admin.mccoy.nl"
      ) {
        throw new Error(`json-ld: forbidden host in URL ${node}`);
      }
      if (host === "mccoy.nl" || host.endsWith(".mccoy.nl")) {
        if (host !== "www.mccoy.nl") {
          throw new Error(`json-ld: McCoy URLs must use https://www.mccoy.nl (got ${node})`);
        }
        if (url.protocol !== "https:") {
          throw new Error(`json-ld: McCoy URLs must be https (got ${node})`);
        }
      }
      continue;
    }
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      stack.push(...node);
      continue;
    }
    for (const value of Object.values(node as Record<string, unknown>)) stack.push(value);
  }
}
