# McCoy SEO Program Index

Canonical host: `https://www.mccoy.nl`.

Safe Mode: [`SEO-SAFE-MODE.md`](./SEO-SAFE-MODE.md).

## Status map (SEO-0 … SEO-32)

| ID | Topic | Status |
|----|-------|--------|
| SEO-0 | Baseline docs + visible-body fixtures | **infra/docs** (this kickoff) |
| SEO-1 | Search Console / Bing / Places setup | **ops** checklist |
| SEO-2 | Sitemap hardening | **infra** |
| SEO-3 | robots.txt hardening | **infra** |
| SEO-4 | Canonical host + trailing-slash redirects | **infra** |
| SEO-5 | IndexNow post-publish | **infra** (fail-open) |
| SEO-6 | JSON-LD fact-only consistency | **infra** |
| SEO-7 | Metadata architecture / absolute head | **infra** (no copy rewrites) |
| SEO-8 | Keyword metadata copy | **approval-gated** → `proposed-metadata.md` |
| SEO-9…11 | NAP consistency / citations | **ops** docs |
| SEO-12 | Keyword map | **planning** |
| SEO-13…14 | Content briefs (locations/services) | **planning** (no pages) |
| SEO-18 | Internal link plan | **planning** |
| SEO-25 | SEO regression CI (`test:seo`) | **infra** |
| SEO-26 | Admin SEO diagnostics UI | deferred |
| SEO-30 | Content change request template | **planning** |
| SEO-31…32 | Later master-plan phases | deferred / approval-gated |

## Key paths

| Path | Role |
|------|------|
| `docs/seo/baselines/` | Visible-body BEFORE/AFTER fixtures |
| `scripts/seo/safe-mode-diff-guard.mjs` | Protected-path guard |
| `packages/security/src/indexing.ts` | Indexability / robots |
| `packages/security/src/host.ts` | Host + canonical redirects |
| `packages/cms-schema/src/resolve-seo.ts` | `resolveSeoMetadata` |
| `apps/storefront/src/routes/robots[.]txt.ts` | Dynamic robots |
| `apps/storefront/src/routes/sitemap[.]xml.ts` | Dynamic sitemap |
| `packages/database/src/cms/indexnow.ts` | IndexNow adapter |

## Commands

```bash
npm run test:seo
npm run seo:diff-guard
npm run seo:visible-baseline:check
```
