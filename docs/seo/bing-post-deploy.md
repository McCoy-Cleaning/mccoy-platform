# Bing Webmaster Tools — post-deploy checklist

Extends / replaces the Bing portion of [`seo-1-search-engines.md`](./seo-1-search-engines.md) for **after** production deploy of SEO Migration Hardening.

Human-only. Do not invent ranks.

## Before you start

Same deploy prerequisites as [`search-console-post-deploy.md`](./search-console-post-deploy.md).

## Steps

1. **Verify** `https://www.mccoy.nl` (import from GSC or Bing verification).
   - XML file method: ship `apps/storefront/public/BingSiteAuth.xml` so  
     `https://www.mccoy.nl/BingSiteAuth.xml` returns the Bing users XML (200, `application/xml` or text).  
     After deploy, use **Try Again** in Bing Webmaster Tools.
2. **Sitemap** — Submit `https://www.mccoy.nl/sitemap.xml`.
3. **IndexNow**
   - Production env `INDEXNOW_KEY` set server-side only
   - Key file `https://www.mccoy.nl/{INDEXNOW_KEY}.txt` returns the key body
   - Confirm publish still succeeds if IndexNow notify fails (fail-open by design)
4. **URL Inspection / Fetch** — Same spot-check set as GSC (home, services, products, cities, one vacancy detail).
5. **Redirect / Gone** — Confirm `/ultrasoon` and `/actie` return **410**; identity aliases and legacy paths 301 to slashless www targets.
6. **Bing Places** — Align NAP with [`nap-canonical.md`](./nap-canonical.md) (not Bremenstraat).
7. **Crawl control** — Ensure preview hosts are not the verified production property.

## Sign-off

| Step | Owner | Date | Done |
|------|-------|------|------|
| Property verified | | | |
| Sitemap submitted | | | |
| IndexNow key live | | | |
| 410/301 spot-check | | | |
| Bing Places NAP | | | |

## Related

- GSC: [`search-console-post-deploy.md`](./search-console-post-deploy.md)
- SEO-1 stub: [`seo-1-search-engines.md`](./seo-1-search-engines.md)
- Final report: [`mccoy-seo-final-report.md`](./mccoy-seo-final-report.md)
