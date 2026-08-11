# Performance-related SEO report (Phase 10)

Date: 2026-08-11  
Canonical host: `https://www.mccoy.nl`  
Method: production `vite` storefront build + `vite preview` (`127.0.0.1:4173`) + Playwright (Microsoft Edge channel), mobile viewport 390×844.  
**Not** full Lighthouse CLI / PageSpeed Insights against live production (CLI install blocked in this environment; Chrome distribution unavailable). Treat numbers as **local unthrottled** baselines, not lab scores with Slow-4G CPU throttling.

## Routes measured

| Route | HTTP | TTFB (ms) | FCP (ms) | LCP (ms) | CLS | Image resources | Duplicate URLs |
|-------|-----:|----------:|---------:|---------:|----:|----------------:|---------------:|
| `/` | 200 | ~1906 | ~2092 | ~2344 | 0 | 8 | none |
| `/services` | 200 | ~631 | ~712 | ~836 | 0 | 7 | none |
| `/products` | 200 | ~677 | ~736 | ~820 | 0 | 2+ gallery | none |
| `/contact` | 200 | ~642 | ~688 | ~688 | 0 | 2 (nav/footer logos) | none |
| `/offerte` | 200 | ~421 | ~472 | ~472 | 0 | 2 (nav/footer logos) | none |

Notes:

- Home cold TTFB includes CMS published hydrate / first paint path; warm navigations are much lower (services/products ~0.4–0.7s TTFB locally).
- LCP element on `/` was text/hero composite (`lcpUrl` null, size ~65KB); `/services` LCP was the first service card image via Supabase Image Transformation.
- `/products` LCP size ~200KB before DeliveryImage wiring for the flyer — see fix below.
- **TBT** was not measured with Lighthouse Total Blocking Time. Proxy: sum of script resource durations ~2.7–3.2s on these routes (dominated by the ~862KB client `index-*.js` chunk). That is a JS-weight signal, not a redesign mandate.

## Image SEO audit (alts)

| Surface | Classification | Result |
|---------|----------------|--------|
| Home hero | Content-bearing | Descriptive alt (`McCoy Cleaning professional at work` or CMS); decorative → `alt=""` |
| Services cards / detail | Content-bearing | Service title (no geo stuffing) |
| Products intro flyer | Content-bearing | `McCoy Cleaning Products flyer` (or CMS) via `DeliveryImage` |
| Products gallery blocks | Content-bearing | Generic `Image`/`Afbeelding` sanitized at storefront `BlockView` via `sanitizePublicCmsImageTree` |
| About pillars | Content-bearing | Pillar title / resolved CMS alt |
| Partners marquee | Content-bearing logos | Partner name |
| Nav / footer logos | Brand (link name) | `McCoy Cleaning` (default logo no longer marked decorative) |
| Editor placeholders | Decorative | `alt=""` |

Live DOM check after build: no remaining generic alts on `/`, `/services`, `/contact`, `/offerte`. `/products` generic `Image` addressed by public-block sanitization + DeliveryImage for the flyer (verified: flyer served as `/images/cms/products-flyer.webp`, former `Image` alt → brand fallback when src basename is non-descriptive).

## Already in place (do not redo)

From `docs/apps-and-hosts.md` and storefront shell:

- Self-hosted Archivo; no Google Fonts waterfall
- Desktop-only hero preload; mobile prioritizes H1 bandwidth
- Services card preloads for first-row LCP
- Below-fold home section code-splitting; nav preload on intent
- WebP delivery via `DeliveryImage` / partner logo variants

## Measured recommendations only (non-redesign)

1. **Done (Phase 10):** Route products intro flyer through `DeliveryImage` (`variant="photo"`) so the known `products-flyer.webp` sibling is used instead of the raw PNG on the LCP path; set `fetchPriority="high"` for that image only.
2. **Done (Phase 10):** Sanitize generic CMS alts at public `BlockView` (not cms-renderer) so published gallery/media with alt `Image`/`Afbeelding` never ship.
3. **Optional later (measured, not Phase 10):** Further split the 862KB client entry chunk if field Lighthouse TBT on production is high — requires profiling, not speculative memoization.
4. **Ops gap:** Re-run **mobile Lighthouse** (Simulated/applied 4G) against production `www.mccoy.nl` or a production preview for official LCP/CLS/TBT scores; attach results here when available.

## Gaps

| Gap | Impact |
|-----|--------|
| No Lighthouse CLI / throttled lab run in this session | Scores not comparable to PSI |
| No live `www.mccoy.nl` measurement | CDN/TTFB/cache differ from local preview |
| TBT not from Long Tasks API under Lighthouse | Use PSI/Lighthouse for TBT gate |

## Safe Mode

- No `cms-renderer` layout/CSS redesign
- Alt + DeliveryImage wiring only
- `npm run test:seo` includes `image-alt.test.ts`
