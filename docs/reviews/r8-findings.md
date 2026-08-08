# R8 — Master findings register

**HEAD:** `1da669f872471c6453adb2e6c395305bcc5d7a80`  
**Date:** 2026-08-08  
**Schema:** `.cursor/skills/_shared/finding-contract.md`  
**Deterministic JSON:** `docs/reviews/r8-deterministic-findings.json` (0 production hits)

## Summary counts (deduplicated)

| Severity | Count |
|----------|------:|
| BLOCKER | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 0 |
| INFO | 1 |
| **Total** | **2** |

| Status | Count |
|--------|------:|
| open | 0 |
| fixed | 0 |
| accepted-risk | 0 |
| deferred | 2 |
| false-positive | 0 |

## Deduplicated findings

### BR-001 — Admin CMS editor update-depth loop (EN publish)

- review: bug-risk
- severity: medium
- confidence: high
- path: `e2e/cms-locale-en-publish.spec.ts` (symptom)
- status: **deferred**
- evidence: Playwright `test:e2e:locale` exit 1 via failureSink on `Maximum update depth exceeded`
- recommendation: isolate editor setState cycle; keep durable save fixtures
- see: `r8-bug-risk-review.md`

### PL-001 — MG5 staging identity operations hold

- review: platform
- severity: info
- confidence: high
- path: `docs/refactoring/mg5-migration-closeout.md`
- status: **deferred**
- evidence: `cms:migrate-fixed-blocks:verify-env -- --environment staging` → exit 2 / `mg5.env.missing_mccoy_environment`
- recommendation: configure separate safe staging Supabase identity; do not weaken fail-closed guards
- see: `r8-platform-review.md`

## Blocker / high resolution

No unresolved blocker/high production defects. No R8 remediations required under auto-eligible policy.

## Self-test fixtures (not production findings)

`npm run review:r8:self-test` detects:

1. storefront → `@mccoy/cms-editor` (blocker)
2. Admin `persistSession: true` (blocker)
3. `window.confirm` in cms-editor (high)

Fixtures live under `scripts/r8-review/fixtures/` and are never imported by apps.
