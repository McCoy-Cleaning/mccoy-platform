# Google Search Console — post-deploy checklist

Extends / replaces the GSC portion of [`seo-1-search-engines.md`](./seo-1-search-engines.md) for **after** production deploy of SEO Migration Hardening (Phases 2–11).

Human-only. Do not invent impressions or ranks.

## Before you start

Confirm production deploy actually includes:

- Dynamic `/sitemap.xml` + `/robots.txt`
- Legacy 301/410 middleware + `vercel.json` host rules
- Absolute `https://www.mccoy.nl` canonicals
- Phase 6 frozen titles/H1 where authorized
- IndexNow key file live (if used)

Until then, treat this checklist as **blocked on deploy**.

## Steps

1. **Property** — `https://www.mccoy.nl` (URL-prefix) and/or Domain property covering apex + www.
2. **Ownership** — DNS / HTML file still valid after host changes.
3. **Sitemap** — Submit `https://www.mccoy.nl/sitemap.xml`. Re-submit once after dynamic sitemap is live if the old static artifact was previously submitted.
4. **URL Inspection** — Spot-check:
   - `/`, `/services`, `/products`, `/vacatures`
   - `/schoonmaakbedrijf-enschede`, `/schoonmaakbedrijf-hengelo`
   - One `/vacatures/{slug}` with JobPosting
5. **Redirect / Gone validation**
   - `/cleaning` → 301 `/services`
   - `/over-ons` → 301 `/about`
   - `/ultrasoon`, `/actie` → **410** (not soft 200)
6. **Coverage / Pages**
   - Soft-404 legacy paths should drop over time
   - `/en/terms`, `/en/privacy` may be `noindex` until EN overlays (expected)
   - Preview / admin hosts must not appear as indexable www URLs
7. **Removals** (optional) — Temporary Removals for stubborn soft-indexed legacy URLs if 410 is live but Google is slow.
8. **Enhancements** — Monitor JobPosting / local business reports for errors; fix facts, do not invent ratings.
9. **Performance** — Export baseline queries after 28 days; store in [`indexation-baseline.md`](./indexation-baseline.md) (no invented numbers before export).

## Sign-off

| Step | Owner | Date | Done |
|------|-------|------|------|
| Deploy verified on www | | | |
| Sitemap submitted | | | |
| Legacy 301/410 inspected | | | |
| Soft-404 drop monitored | | | |
| JobPosting / local report checked | | | |
| Query export filed | | | |

## Related

- Bing: [`bing-post-deploy.md`](./bing-post-deploy.md)
- Citations / GBP: [`mccoy-local-citation-cleanup.md`](./mccoy-local-citation-cleanup.md)
- Final program report: [`mccoy-seo-final-report.md`](./mccoy-seo-final-report.md)
