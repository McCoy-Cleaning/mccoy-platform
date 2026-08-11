# McCoy SEO Program Index

Canonical host: `https://www.mccoy.nl`.

Safe Mode: [`SEO-SAFE-MODE.md`](./SEO-SAFE-MODE.md).

**Program status (2026-08-11):** SEO Migration Hardening Phases 0–12 are **complete locally** (code + docs + `npm run test:seo`). **Production deploy is not claimed** — see operator actions in [`mccoy-seo-final-report.md`](./mccoy-seo-final-report.md).

## Status map (SEO-0 … SEO-32)

| ID | Topic | Status |
|----|-------|--------|
| SEO-0 | Baseline docs + visible-body fixtures | **done** |
| SEO-1 | Search Console / Bing / Places setup | **ops** — [`search-console-post-deploy.md`](./search-console-post-deploy.md), [`bing-post-deploy.md`](./bing-post-deploy.md) |
| SEO-2 | Sitemap hardening | **done** Phase 5 |
| SEO-3 | robots.txt hardening | **done** Phase 5 |
| SEO-4 | Canonical host + trailing-slash redirects | **done** |
| SEO-5 | IndexNow post-publish | **done** (fail-open) |
| SEO-6 | JSON-LD fact-only consistency | **done** Phase 9 NAP |
| SEO-7 | Metadata architecture / absolute head | **done** |
| SEO-8 | Keyword metadata copy | **DEPLOYED** Phase 6 → `proposed-metadata.md` |
| SEO-9…11 | NAP consistency / citations | **code done** Phase 9; **ops** citations → [`mccoy-local-citation-cleanup.md`](./mccoy-local-citation-cleanup.md) |
| SEO-12 | Keyword map | **done** → [`mccoy-keyword-map.md`](./mccoy-keyword-map.md) |
| SEO-13…14 | Content briefs (locations/services) | **planning** + Phase 12 proposals → [`mccoy-content-improvement-proposals.md`](./mccoy-content-improvement-proposals.md) |
| SEO-18 | Internal link plan + integrity gate | **done** Phase 8 |
| SEO-25 | SEO regression CI (`test:seo`) | **done** Phase 11 → [`seo-regression-gate.md`](./seo-regression-gate.md) |
| SEO-26 | Admin SEO diagnostics UI | deferred |
| SEO-30 | Content change request template | **planning** |
| SEO-31…32 | Later master-plan phases | deferred / approval-gated |
| Phase 10 | Image alts + perf report | **done** → [`performance-seo-report.md`](./performance-seo-report.md) |
| Phase 12 | Final report + ops docs | **done locally** → [`mccoy-seo-final-report.md`](./mccoy-seo-final-report.md) |

## Key paths

| Path | Role |
|------|------|
| [`mccoy-seo-final-report.md`](./mccoy-seo-final-report.md) | Phase 12 program closeout |
| `docs/seo/baselines/` | Visible-body + visual fingerprint fixtures |
| `scripts/seo/safe-mode-diff-guard.mjs` | Protected-path guard |
| `packages/security/src/indexing.ts` | Indexability / robots |
| `packages/security/src/host.ts` | Host + canonical redirects |
| `packages/security/src/legacy-redirects.ts` | Phase 2 301/410 |
| `packages/database/src/cms/sitemap-consistency.ts` | Sitemap ↔ indexability invariant |
| `packages/cms-schema/src/business-nap.ts` | Canonical NAP + CleaningService / city / JobPosting JSON-LD |
| `docs/seo/mccoy-local-citation-cleanup.md` | Off-site citation checklist + JobPosting decision |
| `docs/seo/product-seo-roadmap.md` | Future ecommerce Offer + JobPosting note |
| `docs/seo/mccoy-backlink-opportunities.md` | Authentic link opportunities |
| `apps/storefront/src/routes/robots[.]txt.ts` | Dynamic robots |
| `apps/storefront/src/routes/sitemap[.]xml.ts` | Dynamic sitemap |
| `packages/database/src/cms/indexnow.ts` | IndexNow adapter |

## Commands

```bash
npm run test:seo
npm run seo:diff-guard
npm run seo:visible-baseline:check
npm run seo:visual-fingerprint:check
```

Gate map: [seo-regression-gate.md](./seo-regression-gate.md).
