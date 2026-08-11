# Phase 6 — On-page titles, H1, meta (deployed)

Authorized by [`SEO-SAFE-MODE-AUTHORIZATION.md`](./SEO-SAFE-MODE-AUTHORIZATION.md).

## What changed

- Frozen NL + EN titles/descriptions in `apps/storefront/src/lib/cms/frozen-deployed-seo.ts`
- Home/services/about/form H1 copy via i18n + `defaultSectionContent` (+ legacy factory remaps)
- Producten: page-level H1 on eyebrow classes; scent title demoted to H2 (same display classes)
- Removed ranking `<meta name="keywords">` from public heads / `resolveSeoMetadata`
- Docs: `proposed-metadata.md` (`DEPLOYED`), `mccoy-keyword-map.md`

## Visible baselines

Phase 6 intentionally changes visible heading copy/semantics. After deploy:

```bash
npm run seo:visible-baseline:write
npm run test:seo
```

`VISIBLE_COPY_CHANGED` / `VISIBLE_BODY_CHANGED` may be true vs Phase 0–5 baselines; re-capture is required and documented here.

## Not in Phase 6

- Phase 7 services modal SSR / hash links
- New city/service landings
- Thin EN legal overlays
