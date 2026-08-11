# McCoy content improvement proposals (Phase 12)

Planning only. Does **not** authorize new body copy, layout redesign, or new URLs.
Phase 6 titles / H1 / meta already marked **`DEPLOYED`** in [`proposed-metadata.md`](./proposed-metadata.md).

Companion: [`mccoy-keyword-map.md`](./mccoy-keyword-map.md), [`content-briefs/`](./content-briefs/).

## How to use

| Column | Meaning |
|--------|---------|
| Purpose | Business role of the page |
| Intent | Search / user intent |
| Keywords | From keyword map (verified only for live targeting) |
| Title / H1 / meta | Recommendation — note if already DEPLOYED |
| Next editorial | Optional body/internal-link improvements (approval-gated) |

Do not invent volumes, reviews, prices, or thin EN legal overlays.

---

## `/` (Home)

| Field | Value |
|-------|-------|
| Purpose | Brand + Twente cleaning company entry |
| Intent | Navigational + local commercial (“schoonmaakbedrijf Twente / Oldenzaal”) |
| Keywords | verified: schoonmaakbedrijf Twente; McCoy Cleaning Oldenzaal |
| Title / H1 / meta | **DEPLOYED** Phase 6 — see proposed-metadata |
| Next editorial | Keep hero factual; optional soft CTA clarity only via content-change request |

## `/services`

| Field | Value |
|-------|-------|
| Purpose | Service overview + hash deep-links to six offerings |
| Intent | Commercial investigation of cleaning services in Twente |
| Keywords | verified: schoonmaakdiensten Twente; supporting kantoorschoonmaak / glasbewassing Twente |
| Title / H1 / meta | **DEPLOYED** Phase 6 |
| Next editorial | Hash anchors + SSR full text already shipped (Phases 7–8). Dedicated landings deferred |

## `/products`

| Field | Value |
|-------|-------|
| Purpose | Wholesale McCoy Cleaning Products (protected Producten surface) |
| Intent | B2B product / wholesale discovery |
| Keywords | verified: McCoy Cleaning Products; hygiënepapier; professionele zepen; groothandel |
| Title / H1 / meta | **DEPLOYED** Phase 6 (H1 Producten / H2 scent) |
| Next editorial | No fake Offer JSON-LD. Ecommerce Product/Offer roadmap: [`product-seo-roadmap.md`](./product-seo-roadmap.md) |

## `/about`

| Field | Value |
|-------|-------|
| Purpose | Trust / history (since 1998, Oldenzaal) |
| Intent | Brand / about |
| Keywords | verified: McCoy Cleaning sinds 1998 |
| Title / H1 / meta | **DEPLOYED** Phase 6 |
| Next editorial | Keep 1998 / Oldenzaal facts aligned with NAP |

## `/contact`

| Field | Value |
|-------|-------|
| Purpose | Contact form + NAP |
| Intent | Contact / local |
| Keywords | verified: contact McCoy Cleaning Oldenzaal |
| Title / H1 / meta | **DEPLOYED** Phase 6 |
| Next editorial | NAP must match [`nap-canonical.md`](./nap-canonical.md) |

## `/offerte`

| Field | Value |
|-------|-------|
| Purpose | Quote request conversion |
| Intent | Transactional quote |
| Keywords | verified: offerte schoonmaak Twente |
| Title / H1 / meta | **DEPLOYED** Phase 6 (NL). EN unpublished → 302 (no thin EN) |
| Next editorial | Publish EN only with factual overlays |

## `/vacatures` + `/vacatures/$slug`

| Field | Value |
|-------|-------|
| Purpose | Hiring list + detail |
| Intent | Job seeker |
| Keywords | verified: vacatures schoonmaak Twente |
| Title / H1 / meta | List **DEPLOYED** Phase 6; detail titles from vacancy |
| Next editorial | JobPosting JSON-LD on **detail only** (Phase 9). See product roadmap JobPosting note |

## City landings

| URL | Purpose / intent | Keywords | Meta status | Next |
|-----|-------------------|----------|-------------|------|
| `/schoonmaakbedrijf-enschede` | Local Enschede landing | verified: schoonmaakbedrijf Enschede | Existing city head (not Phase 6 frozen table) | Keep NAP-aligned; optional content refresh via CCR |
| `/schoonmaakbedrijf-hengelo` | Local Hengelo landing | verified: schoonmaakbedrijf Hengelo | Same | Same |

Candidate cities (Almelo, …): **not implemented** — approval-gated.

## Legal (`/privacy`, `/terms`)

| Field | Value |
|-------|-------|
| Purpose | Legal compliance |
| Intent | Informational |
| Keywords | Brand + document type only |
| Title / H1 / meta | Frozen NL legal titles; EN bleed → noindex until factual EN overlays |
| Next editorial | Operator EN legal overlays (locale-en-gaps) — not SEO inventiveness |

## Deferred content opportunities

- Six dedicated service landing URLs (today: `/services#…`)
- Additional city landings beyond Enschede / Hengelo
- Thin EN legal / offerte publish (only with real copy)
- Body-copy keyword densification — require [`content-change-request.md`](./content-change-request.md)
