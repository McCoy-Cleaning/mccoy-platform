# Phase 5 — Sitemap ↔ indexability consistency

Production crawl surfaces: dynamic `/sitemap.xml` and env-gated `/robots.txt`.

## Invariant

Every URL emitted by the sitemap (`<loc>` and `xhtml:link` hrefs) must:

| Check | Source |
|-------|--------|
| Published HTTP 200 (policy) | `resolvePublicCmsRequest` → `snapshot` |
| Indexable / not `noindex` | resolved head robots (`robotsIndicateNoindex`) |
| Self-referencing www canonical | `buildCmsHeadFromSnapshot` / `absoluteCanonicalUrl` |
| Correct locale | URL `/en…` ↔ snapshot locale `en` |
| Not redirect / 404 / 410 | resolve kind + Phase 2 legacy map |

Conversely, these must **never** appear in the sitemap:

- Phase 2 legacy paths (`/cleaning`, `/ultrasoon`, `/actie`, …)
- Identity aliases (`/producten`, `/jobs`, …)
- CMS preview/sync (`/cms-preview`, `/cms-sync`)
- Unpublished EN
- Phase 3 Dutch-bleed noindex legal EN (`/en/terms`, `/en/privacy` without EN overlays)

## Implementation

| Module | Role |
|--------|------|
| `packages/database/src/cms/resolve.ts` → `buildPublishedSitemapEntries` | Emits only published **+ indexable** NL/EN locs on `https://www.mccoy.nl`; filters excluded paths |
| `packages/database/src/cms/sitemap-eligibility.ts` | Legacy / alias / preview exclusion |
| `packages/database/src/cms/sitemap-consistency.ts` → `assertSitemapIndexabilityConsistency` | Cross-system invariant (sitemap ↔ resolve ↔ head ↔ legacy) |
| `packages/security/src/indexing.ts` → `storefrontRobotsTxt` | Prod: Allow `/` + Disallow preview paths + Sitemap; non-prod: Disallow `/` (CSS/JS not blocked) |
| `apps/storefront/src/routes/robots[.]txt.ts` | Sitemap line always `https://www.mccoy.nl/sitemap.xml` |

## Tests

```bash
npm run test:seo
# or targeted:
npm run test -w @mccoy/database -- src/cms/sitemap-seo.test.ts
npm run test -w @mccoy/security -- src/indexing.test.ts
```

`sitemap-seo.test.ts` asserts the **relationship** (not only builder XML shape): seeded URLs pass the consistency report; legacy/alias forbidden; published Dutch-bleed EN legal stays out while indexable EN home is included.

## Out of scope (later phases)

- Phase 6 titles / H1 / meta copy — see [`phase6-onpage-meta.md`](./phase6-onpage-meta.md)
- Phase 7+ services SSR / internal links
