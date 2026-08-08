# R8 — Architecture review

**HEAD:** `1da669f872471c6453adb2e6c395305bcc5d7a80`  
**Date:** 2026-08-08  
**Skill:** `.cursor/skills/architecture-review/SKILL.md`  
**Mode:** report-only (+ deterministic runner)

## Scope

Package boundaries for storefront/admin/cms-*; CMS ownership (R5–R7); Guardian zone policy; composition contracts.

## Packages / areas inspected

- `apps/storefront`, `apps/admin`
- `packages/cms-schema`, `cms-renderer`, `cms-editor`, `domain`, `ui`
- `docs/refactoring/frontend-component-architecture.md`
- `.cursor/guardian/policy/architecture.json` (R8 zones added)
- `apps/storefront/src/components/site/site-composition.test.ts`

## Deterministic commands

| Command | Result |
|---------|--------|
| `npm run review:r8 -- --review architecture` | 0 production findings |
| `npm run review:r8:self-test` | fixture detects storefront→cms-editor |
| `npm run test -w @mccoy/storefront -- src/components/site/site-composition.test.ts` | covered in baseline storefront suite |
| `npm run guardian:verify` | decision `qualified` |

## Findings

None open at blocker/high for production sources.

Deterministic scan found **zero** `storefront→cms-editor`, `renderer→cms-editor`, or `schema→react` imports in production trees.

## Verdict

**PASS** — Layer direction intact; R7 composition ownership preserved; fixed compatibility remains explicit (MR not started).
