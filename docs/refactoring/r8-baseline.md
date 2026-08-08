# R8 — Phase 1 baseline

**Date:** 2026-08-08  
**Branch:** `development`  
**HEAD:** `1da669f872471c6453adb2e6c395305bcc5d7a80`  
**Working tree at start:** clean (unrelated WIP isolated in stashes only)

## Prerequisites

| ID | Status | Evidence |
|----|--------|----------|
| R5 | COMPLETE | `0ba08fd` · `a9d7882` · `9dfa92a` · closeout `6ff6b3f` |
| M5 | COMPLETE | `packages/cms-schema/src/e2e-inventory.ts` + `e2e/cms-loading-inventory.spec.ts` |
| R6 | COMPLETE | `4c47a0d` |
| R7 | ACCEPTED | `eb82322`…`a5acd36` (+ `3637321`, `2f1a664`) |
| MG5 | QUALIFIED (fixture) | `209a0fe`…`32897b2` · see `mg5-migration-closeout.md` |

## Core gates

| Command | Exit | Totals / notes |
|---------|-----:|----------------|
| `npm run typecheck` | 0 | all workspaces |
| `npm run lint` | 0 | cms-renderer typecheck alias |
| `npm run test:contract` | 0 | 68 files / 629 tests (`@mccoy/cms-schema`) |
| `npm run test:ci` | 0 | 20 files / 138 tests (`@mccoy/cms-renderer`) |
| `npm run test -w @mccoy/cms-schema` | 0 | 629 tests |
| `npm run test -w @mccoy/cms-editor` | 0 | 15 files / 76 tests (jsdom navigation noise only) |
| `npm run test -w @mccoy/cms-renderer` | 0 | 138 tests |
| `npm run test -w @mccoy/security` | 0 | 4 files / 23 tests |
| `npm run test -w @mccoy/database` | 0 | 19 files / 111 tests |
| `npm run test -w @mccoy/admin` | 0 | 16 files / 82 tests |
| `npm run test -w @mccoy/storefront` | 0 | 6 files / 29 tests |
| `npm run build -w @mccoy/admin` | 0 | ~7.4s |
| `npm run build -w @mccoy/storefront` | 0 | ~5.9s |
| `npm run test:mg5` | 0 | 6 files / 42 tests |
| `npm run cms:migrate-fixed-blocks:dry-run-fixtures` | 0 | pagesScanned=5 changed=5 blocked=0 failed=0 |
| `git diff --check` | 0 | clean |

## Playwright (Chromium)

Environment: `E2E_USE_DEV=1`, origins `http://localhost:5273` / `5274`, data dir `.data/e2e-cms-r8`.  
First attempt on default 5173 failed with **port already in use** (environmental — not a product regression). Rerun used alternate ports.

| Command | Exit | Result |
|---------|-----:|--------|
| `npm run test:e2e:forms` | 0 | **4 passed** |
| `npm run test:e2e:coverage` | 0 | **7 passed** |
| `npm run test:e2e:inventory` | 0 | **14 passed** |
| `npm run test:e2e:locale` | 1 | Public smoke **3/3** passed. EN publish custom-page test fails via global `failureSink` on pre-existing Admin `Maximum update depth exceeded` console spam (same classification as R7). |

## MG5 environment verify (non-mutating)

```text
npm run cms:migrate-fixed-blocks:verify-env -- --environment staging
→ exit 2 / mg5.env.missing_mccoy_environment
targetVerified=false
```

Staging persisted-data qualification remains **PENDING** (operations hold). No apply attempted.

## Baseline conclusion

Core typecheck/lint/tests/builds/MG5 fixture path are green. Required Playwright suites green except known locale EN-publish console flake (deferred, not baseline product blocker for R8 skills phase).
