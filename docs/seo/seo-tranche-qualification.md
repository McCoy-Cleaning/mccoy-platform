# SEO Safe Mode — Tranche qualification report

Date: 2026-08-08  
Branch: `development`  
Scope: Safe Mode governance + SEO-0 baselines + non-visual infrastructure (robots/sitemap/canonical/metadata resolver/JSON-LD/IndexNow/CI)

## Invariant flags

| Flag | Value |
|------|-------|
| `SECTION_LOGIC_CHANGED` | `false` |
| `VISIBLE_COPY_CHANGED` | `false` |
| `VISIBLE_BODY_CHANGED` | `false` |
| `EN/NL_FIELDS_CHANGED` | `false` |
| `VISUAL_STYLING_CHANGED` | `false` |
| `PRODUCTEN/AANVRAGEN/AUTH_CHANGED` | `false` |
| `MG5_EXECUTED` | `false` |
| `MR_STARTED` | `false` |
| `HEAD_TECHNICAL_OUTPUT_CHANGED` | absolute www canonicals; og:url absolute; NL marketing routes use CMS head plumbing with **frozen deployed** titles/descriptions; BreadcrumbList added to CMS JSON-LD `@graph` when path has segments; city/JobPosting `sameAs`/`url` absolute; admin robots `Disallow: /`; static sitemaps removed after dynamic sitemap proof; IndexNow post-publish hook (fail-open); apex→www + trailing-slash 301 helpers |

## Commands run

```text
npm run test:seo
→ seo:diff-guard OK (protectedHits: 0)
→ seo:visible-baseline:check → VISIBLE_BODY_CHANGED=false
→ @mccoy/security indexing + host-canonical: 16 passed
→ @mccoy/cms-schema resolve-seo: 4 passed
→ @mccoy/database indexnow + sitemap-seo + conformance: 9 passed

npm run test -w @mccoy/cms-schema -- src/resolve.test.ts → 7 passed

npm run typecheck -w @mccoy/security → pass
npm run typecheck -w @mccoy/cms-schema → pass
npm run typecheck -w @mccoy/database → pass
npm run typecheck -w @mccoy/storefront → pass
```

## Diff guard

`scripts/seo/safe-mode-diff-guard.mjs` compared against `origin/development`. No protected CMS composition / migration / translation / Aanvragen / auth paths in the SEO tranche.

## Visible body

Baselines: `docs/seo/baselines/visible-body.before.json` / `visible-body.after.json`  
Fingerprint sources: CMS MG5 fixtures for home, products, offerte, about, privacy (+ optional contact/vacatures).

## SEO-7 ≠ SEO-8

- `resolveSeoMetadata` does not invent keyword titles/descriptions.
- Proposed copy queue: `docs/seo/proposed-metadata.md` (`PENDING_APPROVAL`).
- NL routes switched to CMS head plumbing preserve previously hardcoded titles via `frozen-deployed-seo.ts`.

## Canonical redirects

Unit-tested before middleware wiring:

- `http://mccoy.nl/path?utm` → `https://www.mccoy.nl/path?utm` (one hop)
- `https://mccoy.nl/path` → www
- trailing slash strip on www
- no localhost/admin loops

Also: `apps/storefront/vercel.json` apex host redirect; storefront middleware uses 301 for canonical host redirects.

## IndexNow

- Allowlist: `https://www.mccoy.nl` only
- Fail-open: notify errors do not throw from publish hook
- Env: `INDEXNOW_KEY` (document in ops checklist; server-only)
- Key file: `https://www.mccoy.nl/{key}.txt` (operator deploy)

## Dynamic sitemap proof

`sitemap-seo.test.ts` + `conformance.test.ts`: www locs, no draft/admin/preview/localhost; valid XML wrapper. Static `public/sitemap.xml` removed from storefront and admin after proof.

## Explicit non-execution

- MG5 apply: not run
- MR: not started
- No push to remote (2026-08-08 local closeout)

## Development deployment qualification (follow-up)

See [`seo-dev-deployment-qualification.md`](./seo-dev-deployment-qualification.md).

2026-08-09 attempt: local re-qualify PASS; `git push origin development` **FAIL** (`Permission denied (publickey)` for `id_ed25519_mccoy`). Classification **SEO_DEV_BLOCKED**. Remote `origin/development` remains `d213d83`.
