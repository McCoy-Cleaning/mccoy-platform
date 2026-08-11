# SEO regression gate (`npm run test:seo`)

Phase 11 acceptance gate for McCoy SEO Migration Hardening. Prefer consolidating assertions here rather than duplicating live `www` network probes (those remain ops/manual in Phase 12).

## How to run

```bash
npm run test:seo
```

## Assertion map

| # | Acceptance requirement | Covered by |
|---|------------------------|------------|
| 1 | Legacy permanent redirects: real status + `Location` + one-hop to canonical | `@mccoy/security` `legacy-redirects.test.ts` (+ Response construction mirroring storefront middleware); `host-canonical.test.ts` |
| 2 | `/ultrasoon` and `/actie`: real HTTP `410` (not 200 soft-gone) | `legacy-redirects.test.ts` (`resolveLegacyHttpAction` -> `Response` status 410, no Location) |
| 3 | Exactly one canonical per indexable page; self-referencing; www host | `@mccoy/cms-schema` `resolve-seo.test.ts`; storefront `on-page-seo-gate.test.ts` |
| 4 | Titles not bare `Home`; meta descriptions on commercial pages; one H1 on majors | storefront `on-page-seo-gate.test.ts` (frozen SEO + source H1 markers) |
| 5 | NL/EN primary language smoke | `ui-locale.test.ts` + `resolve-seo.test.ts` (`og:locale` / `inLanguage`); storefront `locale-path.test.ts` |
| 6 | Sitemap / indexability consistency | `@mccoy/database` `sitemap-seo.test.ts` + `sitemap-consistency.ts` |
| 7 | Redirect / 404 / 410 / `noindex` not in sitemap | `sitemap-seo.test.ts` (legacy + bleed / forbidden paths) |
| 8 | Internal-link integrity on major public pages | `@mccoy/security` `internal-link-integrity.test.ts` |
| 9 | Published hreflang pairs reciprocal and valid | `@mccoy/cms-schema` `hreflang.test.ts` |
| 10 | JSON-LD parses; no fake ratings; www `@id`/URLs; no duplicate Organization/LocalBusiness | `business-nap.test.ts` + `resolve-seo.test.ts` (`assertFactOnlyJsonLd`) |
| 11 | Service hash `<a href>` present; full service text once in initial HTML (not sr-only duplicate) | storefront `services-ssr-crawlability.test.ts` + `service-detail-anchors.test.ts`; schema `service-detail-anchors.test.ts` |
| 12 | Robots safe in prod config | `@mccoy/security` `indexing.test.ts` |
| 13 | Visual fingerprint vs Phase 0 baseline (tolerance for Phase 6-10 text/SEO edits) | `npm run seo:visual-fingerprint:check` -> `docs/seo/baselines/public-visual-fingerprint.after.json` |
| — | Safe Mode protected paths | `npm run seo:diff-guard` |
| — | Visible-body fixture hash | `npm run seo:visible-baseline:check` |
| — | Image alt sanitization (Phase 10) | `@mccoy/cms-schema` `image-alt.test.ts` |
| — | IndexNow allowlist / fail-open | `@mccoy/database` `indexnow.test.ts` |
| — | Footer / link hash preservation | `footer.test.ts`, `links.test.ts` |

## Visual fingerprint policy

- **Phase 0 baseline (historical):** [`baselines/public-visual-fingerprint.before.json`](./baselines/public-visual-fingerprint.before.json)
- **Current expected (after intentional Phase 6-10 SEO edits):** [`baselines/public-visual-fingerprint.after.json`](./baselines/public-visual-fingerprint.after.json)
- The check validates structural classNames / H1 tags / route files against **after**, not pixel screenshots.
- When intentional SEO work changes structural markers (e.g. Phase 7 services SSR), update **after** with a documented `phaseNotes` reason — do not silently loosen the gate.

## Out of scope for this gate

- Live HTTP against `https://www.mccoy.nl` (flaky / deploy-coupled — Phase 12 ops)
- Visual redesign / new service landings
- MG5 apply / MR kickoff