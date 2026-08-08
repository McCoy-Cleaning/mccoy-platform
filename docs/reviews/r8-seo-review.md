# R8 — SEO review

**HEAD:** `1da669f872471c6453adb2e6c395305bcc5d7a80`  
**Date:** 2026-08-08  
**Skill:** `.cursor/skills/seo-review/SKILL.md`  
**Mode:** report-only (storefront public routes)

## Scope

Titles, canonicals, robots, CMS head mapping, preview noindex.

## Route evidence (code)

| Route | Title present | Canonical | Notes |
|-------|---------------|-----------|-------|
| `/` | yes (`tanstackHeadFromCms` / fallback) | via CMS head | CMS-driven |
| `/products` | Producten — McCoy… | `/products` | |
| `/services` | Diensten — McCoy… | `/services` | |
| `/about` | Over ons — McCoy… | `/about` | |
| `/contact` | Contact — … | `/contact` | |
| `/offerte` | Contact & Offerte — … | `/offerte` | |
| `/vacatures` | Vacatures … | `/vacatures` | |
| `/privacy` | Privacyverklaring — … | `/privacy` | |
| `/terms` | Algemene Voorwaarden — … | `/terms` | |
| `/cms-preview`, `/cms-sync` | n/a | n/a | `noindex,nofollow` by design |
| `/en/*` without head | n/a | n/a | `robots: noindex` when unpublished |

Head helper: `apps/storefront/src/lib/cms/cms-head.ts` maps CMS meta/links + JSON-LD.

## Findings

No blocker/high SEO regressions verified. Preview/admin sync routes correctly noindexed.

## Verdict

**PASS**
