# Semrush Opportunities — audit triage (Safe Mode)

Operator screenshots of Semrush-style **Opportunities** (≈24 rows). Disposition below. Prefer technical crawl/head fixes; no `cms-renderer` redesign; no invented rankings content.

## Fixed / hardened in code

| Finding | Disposition | Change |
|---------|-------------|--------|
| `SITEMAP_EMPTY` / sitemap fetched but no URLs enqueued | **Hardened** | City landings (`/schoonmaakbedrijf-enschede`, `/schoonmaakbedrijf-hengelo`) always merge into `buildPublishedSitemapEntries`. Sitemap route returns **503** (not empty `<urlset>`) when build fails or has no `<loc>`. |
| `FETCH_TIMING_*` (crawler TTFB, not CWV) | **Mitigated** | Boot warm expanded beyond `/` + `/en` to `/services`, `/products`, `/about`, `/contact`, `/vacatures`, `/offerte`. Still not a Core Web Vital; remaining latency is CMS/DB cold-start / edge. |
| `TITLE_TOO_SHORT` / `DESCRIPTION_TOO_SHORT` / `DESCRIPTION_TOO_LONG` on NL legal + commercial meta | **Partially fixed** | NL `/privacy` + `/terms` frozen titles/descriptions lengthened within Phase 6 authorization. Commercial descriptions kept ≤~160 where adjusted. |
| Keyword IMPROVE rows (`glazenwasser oldenzaal`, `schoonmaakster oldenzaal`, `schoonmaakbedrijf`, `schoonmaakdienst`, `mccoy vacatures`, `zonnepanelen schoonmaken oldenzaal`) | **Documented** | Added to [`mccoy-keyword-map.md`](./mccoy-keyword-map.md) + [`keyword-baseline.md`](./keyword-baseline.md). Content/ranking work — not a code defect. |

## Verified false positive / already OK

| Finding | Why |
|---------|-----|
| HTML not served with gzip/br/zstd | Production responds with `Content-Encoding: br` when `Accept-Encoding` includes `br`/`gzip`. Node `npm start` enables compression via `MCCOY_ENABLE_RESPONSE_COMPRESSION=1` (`apps/storefront/scripts/start-prod.mjs`). Audits that omit `Accept-Encoding` report a false positive. |
| Populated `/sitemap.xml` when healthy | Live sitemap includes CMS URLs; empty-urlset was a failure-mode bug (now 503). |

## Deferred — intentional or out of Safe Mode

| Finding | Why deferred |
|---------|--------------|
| Missing H1 / H1 identical to title / missing H2 / heading skip | Phase 6 already set major H1s. Remaining “H1 ≈ title” and H2 density are content/UX choices; changing heading tags in `cms-renderer` is Safe Mode–forbidden without new authorization. |
| Page references >50 files (script/link/img) | Bundle/asset inventory — not a ranking bug; splitting for SEO alone risks product regressions. |
| Page embeds iframes | Intentional (maps / embeds / third-party widgets). Do not remove for audit score. |
| Protect/Improve page experience for `/` (CWV regression tooling) | Separate performance program; crawler fetch ms ≠ LCP/INP. |
| EN `/terms` `/privacy` short title/description | Dutch-bleed EN legal stays **noindex** — no invented legal EN overlays ([`proposed-metadata.md`](./proposed-metadata.md)). |
| Ranking IMPROVE “Go now” copy changes | Needs approved content/landing strategy; keyword map only. |

## Operator re-check

1. Re-crawl with `Accept-Encoding: gzip, br` — compression warning should clear.
2. Confirm `/sitemap.xml` returns 200 with `<loc>` entries including city landings after deploy.
3. Re-measure crawler fetch after warm (expect lower cold-start; not a CWV claim).
