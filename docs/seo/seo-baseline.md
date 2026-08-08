# SEO-0 — Technical baseline

Captured for the Safe Mode infrastructure kickoff (2026-08-08). Operator-owned Search Console cells live in `indexation-baseline.md`.

## Canonical policy

| Item | Value |
|------|-------|
| Preferred host | `https://www.mccoy.nl` |
| Apex | `https://mccoy.nl` → 301 to www |
| Trailing slash | Strip except `/` (aligned with `normalizeCmsPath`) |
| Query strings | Preserved on host/slash redirects (`?utm_*` ok) |
| Preview canonical | Forbidden — fail closed to www origin for public head |

## Crawl surfaces (storefront)

| Surface | Expected |
|---------|----------|
| `/robots.txt` | Dynamic; production Allow + Disallow preview/sync; Sitemap www |
| `/sitemap.xml` | Dynamic published CMS locales only |
| Static `public/sitemap.xml` | Removed after dynamic proof |
| Admin `robots.txt` | `Disallow: /` |

## Head architecture

| Locale | Source |
|--------|--------|
| `/` + `/en/*` CMS pages | `resolveSeoMetadata` / `buildCmsHeadFromSnapshot` |
| NL marketing routes | CMS head path with **frozen deployed** titles/descriptions (SEO-7 ≠ SEO-8) |
| City / vacancy slug | Local head + absolute www canonical helper |

## IndexNow

| Item | Value |
|------|-------|
| Host allowlist | `https://www.mccoy.nl` only |
| Secret | `INDEXNOW_KEY` server-only |
| Publish behavior | Fail-open |

## Visible body

See `docs/seo/baselines/` — `VISIBLE_BODY_CHANGED` must remain `false`.
