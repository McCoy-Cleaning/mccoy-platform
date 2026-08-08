# SEO-0 — Indexation baseline

## Crawlability checklist (automated / code)

| Check | Expected | Owner |
|-------|----------|-------|
| Production robots Allow | yes | `storefrontRobotsTxt` |
| Preview robots Disallow all | yes | indexing fail-closed |
| Admin robots Disallow all | yes | `apps/admin/public/robots.txt` |
| Sitemap www absolute locs | yes | dynamic sitemap |
| Draft/admin/preview excluded from sitemap | yes | `buildPublishedSitemapEntries` |
| Canonical never preview host | yes | `resolveCanonicalOrigin` |
| Indexable ⇒ robots meta index,follow | yes | root head |

## Operator — Google Search Console

| Item | Status | Date | Notes |
|------|--------|------|-------|
| Property `https://www.mccoy.nl` | | | |
| Sitemap submitted | | | |
| Coverage errors reviewed | | | |
| Apex property redirect verified | | | |

## Operator — Bing Webmaster

| Item | Status | Date | Notes |
|------|--------|------|-------|
| Site registered | | | |
| Sitemap submitted | | | |
| IndexNow key verified | | | |

## Operator — Google Business Profile / NAP

See `nap-canonical.md`.
