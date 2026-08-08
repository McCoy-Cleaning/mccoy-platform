# MG5 — Closeout

**Classification:** `MG5_QUALIFIED` (staging qualification **NO-GO** — not `MG5_STAGING_COMPLETE`)  
**Date:** 2026-08-08  
**Migration version:** `fixed-block/v1`  
**Branch:** `mg5-fixed-blocks-migration`  
**HEAD (pre-identity commit):** `7774e807bbe30e643ad37a43c8c1e83644417ca6`  
**Commits:** `209a0fe`… + MG5 environment-identity commit on `mg5-fixed-blocks-migration`  
**Apply decision:** **NO-GO** for staging apply and production apply  
**Staging GO/NO-GO (2026-08-08 re-run):** **NO-GO** — fail-closed identity gate; no DB dry-run/apply

## Delivered

1. M5-backed migration matrix (`mg5-matrix.ts` + docs).
2. Pure deterministic pipeline (`migrateFixedToBlocks`) wrapping existing family resolvers (home-hero, about, products, offerte, legal) + optional full-mode wholesale apply.
3. Machine-readable dry-run / apply / rollback reports.
4. Fail-closed operator CLI with backup, CAS revision, post-write verify, production confirm phrase.
5. Deterministic unit tests (matrix, pipeline, operator, form identity) + Gate 4 dry-run tests.
6. Offline fixture cohort + CLI dry-run evidence (no DB).
7. Audit, matrix, runbook, closeout documentation.
8. Architecture / audit roadmap IDs updated for MG5.
9. **Explicit deployment identity** — `verifyMg5DeploymentTarget` + CLI `--verify-environment`; branch/env/project allowlist fail-closed (no `--force`/`--skip`/`--ignore`).

## Not delivered (explicit)

- Staging / production-like cohort dry-run against live credentials
- Production canary / production cohort apply
- Dual-read modules for remaining **unqualified** fixed keys (partners/stats/gallery, services, contact.*, vacatures.*, offerte.info)
- R8 review skills
- MR legacy retirement

## Classification rationale

| Label | Status |
|-------|--------|
| `MG5_CODE_COMPLETE` | Yes — machinery, docs, CLI, tests |
| `MG5_QUALIFIED` | **Yes (fixture + dry-run)** — offline cohort dry-run green; unit/operator gates green |
| `MG5_STAGING_COMPLETE` | **No** — staging positively identified? **No** → fail-closed; dry-run/apply not run |
| `MG5_PRODUCTION_*` | **No** — no approved production run |
| `BLOCKED` | Remaining matrix rows stay `unqualified` for production apply; staging cohort pending identity |

## Staging qualification re-run (2026-08-08 — identity gate)

### Authoritative deployment mapping (now enforced in code)

| Target | `MCCOY_ENVIRONMENT` | Branch | Allowlist |
|--------|---------------------|--------|-----------|
| Staging | `staging` | `development` \| `dev` | `MCCOY_STAGING_SUPABASE_PROJECT_ID` |
| Production | `production` | `main` | `MCCOY_PRODUCTION_SUPABASE_PROJECT_ID` |

Vercel: development/preview → staging env + staging Supabase; `main` → production env + production Supabase. Shared staging=production project IDs → **STOP**.

### Environment identity (safe diagnostics)

| Field | Recorded value |
|-------|----------------|
| `MCCOY_ENVIRONMENT` | **MISSING** |
| Branch | `mg5-fixed-blocks-migration` (not `development`/`dev`) |
| Supabase project ref (redacted) | `bwrk…ecmv` (from `SUPABASE_URL`) |
| `MCCOY_STAGING_SUPABASE_PROJECT_ID` | **MISSING** |
| `MCCOY_PRODUCTION_SUPABASE_PROJECT_ID` | **MISSING** |
| `targetVerified` | **false** |
| Verify command | `npm run cms:migrate-fixed-blocks:verify-env -- --environment staging` → exit 2 / `mg5.env.missing_mccoy_environment` |
| Staging dry-run attempt | Refused by identity gate before any CMS I/O (exit 2) |

### Backup mechanism (no CMS mutation)

| Check | Result |
|-------|--------|
| Backup destination | `.data/mg5-backups/` (gitignored) |
| Directory writable | Yes (probe write/delete; no CMS calls) |
| Staging backups / cohort hashes | **Not collected** (DB dry-run blocked) |

### Staging dry-run / matrix / GO

| Step | Status |
|------|--------|
| verify environment | **FAILED** (missing declared env + allowlists; wrong branch) |
| backup mechanism verification | PASS (local writable) |
| full staging dry-run | **NOT RUN** (fail-closed) |
| second deterministic dry-run | **NOT RUN** |
| report review | N/A |
| Staging apply | **NOT RUN** |
| R8 / MR | **NOT STARTED** |
| Production migration | **NOT STARTED** / **NO-GO** |

### MG5 STAGING APPLY GO/NO-GO

```
MG5 STAGING APPLY GO/NO-GO

Environment: unverified (MCCOY_ENVIRONMENT missing)
Branch: mg5-fixed-blocks-migration
supabaseProjectRef: bwrk…ecmv
targetVerified: false
Migration version: fixed-block/v1
Qualified dry-run: NOT RUN
Pages scanned: N/A
Pages eligible: N/A
Pages to change: N/A
Conflicts: N/A
Blocked pages: N/A
Backup dir operational: YES
Rollback tested (staging): NO
dryRunWritesObserved: N/A

Decision: NO-GO

Blockers (exact missing / mismatched config):
1. Set MCCOY_ENVIRONMENT=staging
2. Set MCCOY_STAGING_SUPABASE_PROJECT_ID=<staging ref> (distinct from production)
3. Set MCCOY_PRODUCTION_SUPABASE_PROJECT_ID=<production ref>
4. Point SUPABASE_URL at the staging project ref
5. Run operator from git branch development|dev
6. Re-run: verify-env → backup probe → dry-run ×2 → GO report (still no --apply until explicit)
```

### What unblocks staging qualification

1. Configure the five identity items above with a **real separate staging Supabase project**.
2. Re-run verify → dry-run → second dry-run → GO report (apply remains a separate explicit step).
3. Only after `MG5_STAGING_COMPLETE` merge MG5 to `main`. Production apply stays a separate NO-GO.

## 33-point final report

| # | Requirement | Result |
|---|-------------|--------|
| 1 | R5/M5/R6/R7 complete before MG5 | PASS |
| 2 | No R8 / MR started | PASS |
| 3 | M5 inventory fully covered by matrix | PASS (20 keys / 23 role rows) |
| 4 | Eligible mappings deterministic (uuidV5) | PASS |
| 5 | Wraps existing resolve-time family modules (no parallel transforms) | PASS |
| 6 | Content preserved on fixture family pages | PASS |
| 7 | Deleted optional sections stay absent (`strictAbsence`) | PASS |
| 8 | No duplicate canonical blocks | PASS |
| 9 | Dual conflicts detected / fail-closed | PASS |
| 10 | NL content mapped via family modules | PASS |
| 11 | EN field paths remapped | PASS (family + fixture dry-run ops) |
| 12 | Form identities stable (aliases, not block UUID) | PASS (unit) |
| 13 | Block IDs deterministic across reruns | PASS |
| 14 | Idempotent migrate | PASS |
| 15 | Dry-run writes nothing to CMS | PASS |
| 16 | Apply requires qualified dry-run | PASS |
| 17 | Production apply requires confirm phrase | PASS |
| 18 | Stale qualification (hash/revision) blocked | PASS |
| 19 | Backup before mutation | PASS (in-memory + CLI path) |
| 20 | Rollback path tested | PASS (in-memory) |
| 21 | Post-write re-read verify | PASS (in-memory) |
| 22 | Canary by pageKey / pageId | PASS (CLI) |
| 23 | Machine-readable reports | PASS |
| 24 | Compatibility / dual-read retained (no MR) | PASS |
| 25 | `CMS_SCHEMA_VERSION` not arbitrarily bumped (stays 6) | PASS |
| 26 | No migrate-on-startup | PASS |
| 27 | Unqualified matrix rows blocked for production | PASS (docs + matrix) |
| 28 | Fixture cohort dry-run green | PASS (`pagesScanned=5`, `blocked=0`, `failed=0`) |
| 29 | Staging/production-like dataset dry-run | **NO-GO** — identity gate fail-closed (`missing_mccoy_environment` + missing allowlists + non-staging branch) |
| 30 | Production canary apply | NOT EXECUTED — **NO-GO** |
| 31 | Docs (audit/matrix/runbook/closeout + apps-and-hosts + deploy mapping) | PASS |
| 32 | `npm run test:mg5` + cms-schema typecheck | PASS (42 tests incl. env identity; tsc clean) |
| 33 | Honest classification (no false PRODUCTION_COMPLETE) | PASS → **MG5_QUALIFIED** |

## Commands / results (this closeout)

| Command | Result |
|---------|--------|
| `npm run test:mg5` | PASS (42 tests) |
| `npm run typecheck -w @mccoy/cms-schema` | PASS |
| `npm run cms:migrate-fixed-blocks:verify-env -- --environment staging` | FAIL exit 2 — `mg5.env.missing_mccoy_environment` |
| `npm run cms:migrate-fixed-blocks -- --dry-run --environment staging` | REFUSED by identity gate (no CMS I/O) |
| Offline fixture dry-run (prior) | PASS — runId `mg5_e14b5b2f-…`, changed=5, blocked=0, failed=0 |
| Staging / production apply | **NOT EXECUTED** |
| Merge MG5 → main | **NOT DONE** (blocked on `MG5_STAGING_COMPLETE`) |

## Prerequisites for R8 / MR

1. Keep **MG5_QUALIFIED** until staging is positively identified and `MG5_STAGING_COMPLETE` is earned.
2. Do not start **MR** until R8 reviews MG5 evidence and unqualified rows are dual-read or full-mode staging-proven.
3. Unqualified matrix rows remain blocked for production apply.
4. Do not start **R8** until after merge policy allows (post-`MG5_STAGING_COMPLETE`); this closeout does not start R8.

## Confirmations

- **MR was NOT started.**
- **R8 was NOT started.**
- **No staging CMS dry-run or apply** — identity gate refused before DB access.
- **No production migration** and **no silent production CMS mutation**.
- Production safety gates (confirm phrase, qualification, CAS, backup) unchanged / not weakened.
- Unrelated local WIP (`apps/admin/.../vercel-web-analytics.server.ts`) left uncommitted / outside MG5 commits.
