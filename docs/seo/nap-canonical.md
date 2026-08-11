# NAP canonical (SEO-9…11 / Phase 9)

Authoritative NAP for McCoy Cleaning (from existing site JSON-LD / contact facts).

**Code source of truth:** `packages/cms-schema/src/business-nap.ts` (`MCCOY_NAP`,
`buildMccoyCleaningServiceJsonLd`, `buildCityLandingJsonLd`, `buildJobPostingJsonLd`).

| Field | Value |
|-------|-------|
| Name | McCoy Cleaning |
| Street | Nijverheidsstraat 63 |
| Postal | 7575 BH |
| City | Oldenzaal |
| Region | Overijssel |
| Country | NL |
| Phone | +31 541 534 982 (`+31541534982`) |
| Email | info@mccoy.nl |
| Website | https://www.mccoy.nl |
| Organization `@id` | `https://www.mccoy.nl/#organization` |

## Entity strategy

- Emit **one** sitewide `CleaningService` (LocalBusiness subtype) in root head with the stable `@id` above.
- Page-level types (city `WebPage`, `JobPosting.hiringOrganization`) **reference** the same `@id` — do not emit a second Organization/LocalBusiness identity.
- Fact-only: no AggregateRating / invented reviews.

## Citations / JobPosting

Operator citation cleanup (Bremenstraat → Nijverheidsstraat) and JobPosting
eligibility notes: [`mccoy-local-citation-cleanup.md`](./mccoy-local-citation-cleanup.md).

## Audit template

| Directory / profile | Name match | Address match | Phone match | URL match | Action |
|---------------------|------------|---------------|-------------|-----------|--------|
| Google Business Profile | | | | | |
| Bing Places | | | | | |
| Kamer van Koophandel | | | | | |
| Other citation 1 | | | | | |

Do not auto-edit external profiles from this repository.
