# R8 — Bug-risk review

**HEAD:** `1da669f872471c6453adb2e6c395305bcc5d7a80`  
**Date:** 2026-08-08  
**Skill:** `.cursor/skills/bug-risk-review/SKILL.md`  
**Mode:** report-only

## Scope

CMS save/publish races, Aanvragen forms path, locale EN publish console loop, MG5 idempotency tests.

## Evidence

| Area | Result |
|------|--------|
| Forms → Aanvragen E2E | 4 passed |
| CMS inventory / coverage | 14 + 7 passed |
| MG5 unit/operator/idempotency | 42 passed |
| Locale EN publish E2E | fails `failureSink` on `Maximum update depth exceeded` (pre-existing; tracked since R7) |

## Findings

### BR-001 — Admin CMS editor update-depth loop during custom-page EN publish

| Field | Value |
|-------|-------|
| id | `BR-001` |
| ruleId | `bug.cms.editor-update-depth` |
| severity | medium |
| confidence | high |
| path | `e2e/cms-locale-en-publish.spec.ts` (symptom); editor modules under Admin CMS |
| status | deferred |
| evidence | Playwright exit 1; global failureSink reports 186–230 `Maximum update depth exceeded` console errors while durable save asserts can still succeed (R7 classification) |
| impact | Noisy/unstable EN publish E2E; potential editor jank under EN field editing |
| recommendation | Isolate setState cycle in EN/custom-page editor path; keep durable `savePage` fixtures; do not treat as MG5/MR work |
| verification | `npm run test:e2e:locale` |

Not promoted to R8 blocker: publish durability already hardened; public locale smoke green; documented follow-up remains.

## Verdict

**PASS with deferred BR-001** (not production data-integrity blocker).
