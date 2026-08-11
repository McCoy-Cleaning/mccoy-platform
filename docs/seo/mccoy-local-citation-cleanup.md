# McCoy local citation cleanup (Phase 9)

Operator checklist for aligning **off-site** local citations and directories with the
canonical NAP in [`nap-canonical.md`](./nap-canonical.md) and the single code
source `packages/cms-schema/src/business-nap.ts`.

**This repository does not auto-edit external directories.** Update citations
manually (or via your listing vendor) after confirming ownership.

## Canonical NAP (do not invent alternatives)

| Field | Value |
|-------|-------|
| Name | McCoy Cleaning |
| Street | **Nijverheidsstraat 63** |
| Postal + city | 7575 BH Oldenzaal |
| Region | Overijssel |
| Country | NL |
| Phone | +31 541 534 982 (`+31541534982`) |
| Email | info@mccoy.nl |
| Website | https://www.mccoy.nl |

Legacy / incorrect street to retire everywhere it still appears:

- **Bremenstraat** (any number / spelling) → replace with **Nijverheidsstraat 63**

Repo scan note (Phase 2 / legacy map): no Bremenstraat string remains in this
codebase. Citations may still show the old street on third-party sites.

## Cleanup checklist

For each profile / directory, verify name, address, phone, and website URL match
the table above. Prefer `https://www.mccoy.nl` (not apex-only or preview hosts).

| Directory / profile | Name | Address (not Bremenstraat) | Phone | URL www | Action / owner | Done |
|---------------------|------|----------------------------|-------|---------|----------------|------|
| Google Business Profile | | | | | | |
| Bing Places | | | | | | |
| Kamer van Koophandel (public listing) | | | | | | |
| Apple Business Connect (if used) | | | | | | |
| Facebook / Instagram business info | | | | | | |
| LinkedIn company page | | | | | | |
| Local Twente / Overijssel directories | | | | | | |
| Other citation 1 | | | | | | |
| Other citation 2 | | | | | | |

### Suggested edit steps per citation

1. Confirm you control the listing.
2. Replace any **Bremenstraat** address with **Nijverheidsstraat 63, 7575 BH Oldenzaal**.
3. Set phone to **+31 541 534 982** (or national **0541 534 982** where international format is unavailable).
4. Set website to **https://www.mccoy.nl**.
5. Remove duplicate listings that create a second NAP identity; keep one primary.
6. After edit, request re-crawl / refresh where the platform offers it.

## Structured data on-site (already Phase 9)

- One sitewide `CleaningService` entity with `@id` `https://www.mccoy.nl/#organization`.
- City landings emit `WebPage` nodes that **reference** that `@id` (no second LocalBusiness).
- JobPostings emit on vacancy **detail** routes only (see below).

## JobPosting eligibility decision (Phase 9)

**Decision:** Emit `JobPosting` JSON-LD on `/vacatures/$slug` detail pages only.
Do **not** attach a multi-job `JobPosting` array to the `/vacatures` list route.

**Why:** Google’s JobPosting guidelines expect each posting to describe a single
job on a dedicated page. A list page with three unrelated `JobPosting` nodes is
list abuse / eligibility risk and previously drifted from CMS vacancy titles.

**Implementation:**

- `/vacatures` — CMS WebPage / marketing head only (no JobPosting scripts).
- `/vacatures/$slug` — one fact-only `JobPosting` built from the visible CMS
  vacancy (`buildJobPostingJsonLd`), with `hiringOrganization.@id` pointing at
  `https://www.mccoy.nl/#organization`.
- `datePosted` is included only when `vacancy.startDate` (or an explicit option)
  is present — never invented.

## Related docs

- [`nap-canonical.md`](./nap-canonical.md) — authoritative NAP values
- [`legacy-url-migration-map.md`](./legacy-url-migration-map.md) — Bremenstraat absent in repo
- [`SEO-SAFE-MODE.md`](./SEO-SAFE-MODE.md) — no invented ratings / reviews
