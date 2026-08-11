# SEO-0 — URL inventory

Public storefront paths known from routes + dynamic sitemap builders. Fill live HTTP status from production when auditing.

**Superseded for Phase 0 matrix detail by** [`mccoy-seo-baseline.md`](./mccoy-seo-baseline.md) **and legacy decisions by** [`legacy-url-migration-map.md`](./legacy-url-migration-map.md). Keep this file as the short inventory stub.

## Core NL

| Path | Type | Notes |
|------|------|-------|
| `/` | CMS builtin | Home |
| `/about` | CMS builtin | Over ons |
| `/services` | CMS builtin | Diensten |
| `/products` | CMS builtin | Producten (protected surface) |
| `/contact` | CMS builtin | Contact |
| `/offerte` | CMS builtin | Offerte / aanvraag |
| `/vacatures` | CMS builtin | Vacatures |
| `/vacatures/:slug` | Derived | Vacancy detail |
| `/privacy` | CMS builtin | Legal |
| `/terms` | CMS builtin | Legal |
| `/schoonmaakbedrijf-enschede` | Static landing | City |
| `/schoonmaakbedrijf-hengelo` | Static landing | City |

## Core EN

| Path | Type |
|------|------|
| `/en` | CMS home EN |
| `/en/about` | CMS |
| `/en/services` | CMS |
| `/en/products` | CMS |
| `/en/contact` | CMS |
| `/en/offerte` | CMS |
| `/en/vacatures` | CMS |
| `/en/privacy` | CMS |
| `/en/terms` | CMS |
| `/en/*` custom | Published custom pages only |

## Non-index / technical

| Path | Policy |
|------|--------|
| `/cms-preview` | Disallow + noindex |
| `/cms-sync` | Disallow + noindex |
| `/admin*` | Admin host only; not storefront index targets |
| Preview Vercel hosts | `noindex, nofollow` |

## Operator fill-in

| URL | HTTP | Indexed GSC | Indexed Bing | Notes |
|-----|------|-------------|--------------|-------|
| `https://www.mccoy.nl/` | | | | |
| `https://www.mccoy.nl/sitemap.xml` | | | | |
| `https://www.mccoy.nl/robots.txt` | | | | |
