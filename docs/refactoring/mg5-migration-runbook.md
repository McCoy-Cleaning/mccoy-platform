# MG5 — Migration runbook

**Migration version:** `fixed-block/v1`  
**CLI:** `npm run cms:migrate-fixed-blocks -- …`  
**Backups:** `.data/mg5-backups/` (gitignored — never commit production CMS backups)

## Prerequisites

1. Privileged Supabase service credentials loaded via monorepo env (`SUPABASE_SECRET_KEY` / service role).
2. Environment positively identified and **verified** (see below) — not guessed from localhost origins.
3. Cohort selected (`--page-id` and/or `--page-key`).
4. Typecheck / MG5 tests green on the deploy SHA.
5. Operator has read the GO/NO-GO checklist (below).

## Deployment model (authoritative)

| Target | `MCCOY_ENVIRONMENT` | Git branch | Supabase allowlist |
|--------|---------------------|------------|--------------------|
| Staging | `staging` | `development` or `dev` | `MCCOY_STAGING_SUPABASE_PROJECT_ID` |
| Production | `production` | `main` | `MCCOY_PRODUCTION_SUPABASE_PROJECT_ID` |
| Local / offline | `development` (optional) | any | N/A — use `--environment test\|local` / `--fixture-dir` |

Vercel follows the same model:

- `development` / preview deployments → staging env vars + staging Supabase project
- `main` → production env vars + production Supabase project

Staging and production **must** use distinct Supabase project refs. If they are identical, staging qualification **STOPS** (shared prod DB is not staging).

Required operator / deploy env (placeholders in `.env.example`):

```text
MCCOY_ENVIRONMENT=staging|production|development
MCCOY_STAGING_SUPABASE_PROJECT_ID=<ref>
MCCOY_PRODUCTION_SUPABASE_PROJECT_ID=<ref>
SUPABASE_URL=https://<ref>.supabase.co
```

Current project ref is derived from `SUPABASE_URL` (or `VITE_SUPABASE_URL`) and compared to the allowlist. There is **no** `--force` / `--skip` / `--ignore` bypass.

## Environment verification

Before any staging/production dry-run or apply, the CLI verifies **all** of:

1. Explicit `MCCOY_ENVIRONMENT`
2. Current git branch
3. Supabase target identity (project ref from URL)
4. Expected environment ↔ branch ↔ project mapping

```powershell
npm run typecheck -w @mccoy/cms-schema
npm run test:mg5

# Safe diagnostics only (environment, branch, redacted project ref, targetVerified)
npm run cms:migrate-fixed-blocks:verify-env -- --environment staging
# or:
npm run cms:migrate-fixed-blocks -- --verify-environment --environment staging
```

Fail-closed examples (non-exhaustive): missing/invalid `MCCOY_ENVIRONMENT`, CLI `--environment` ≠ declared env, wrong branch, missing allowlist IDs, unresolvable URL ref, allowlist mismatch, staging==production project IDs.

`test` / `local` / `--fixture-dir` skip deploy allowlist binding (offline sandbox only).

Never run apply from CI, preview builds, or application startup.

## Dry-run (mandatory)

```powershell
npm run cms:migrate-fixed-blocks -- --dry-run --environment staging --page-key products
# or canary page:
npm run cms:migrate-fixed-blocks -- --dry-run --environment staging --page-id page_products
```

Outputs (under `.data/mg5-backups/`):

- `<runId>.report.json` — machine-readable report
- `<runId>.qualification.json` — hash + draft revision lock for apply

Dry-run **must not** call `saveDraft`.

### Offline fixture dry-run (no DB)

Committed cohort:

```powershell
npm run cms:migrate-fixed-blocks:dry-run-fixtures
# equivalent:
npm run cms:migrate-fixed-blocks -- --dry-run --environment test --fixture-dir packages/cms-schema/src/migration/mg5-fixtures
```

Regenerate fixtures after seed-shape changes:

```powershell
npm run cms:migrate-fixed-blocks:fixtures
```

## Report review

Check:

- `pagesBlocked` / conflicts (`ambiguous`, `content_conflict`)
- `pagesFailed` / validation issues
- Form pages: source keys unchanged in matrix
- Producten: content hashes / deterministic IDs

Unresolved conflicts ⇒ **STOP**. Do not apply.

## Backup

Apply generates backup **before** any write:

- `.data/mg5-backups/<runId>.backup.json`

If backup write fails, apply aborts with zero CMS mutations.

## Apply (fail-closed)

Staging:

```powershell
npm run cms:migrate-fixed-blocks -- `
  --apply `
  --environment staging `
  --qualified-run <runId> `
  --page-key products
```

Production (stronger gate):

```powershell
npm run cms:migrate-fixed-blocks -- `
  --apply `
  --environment production `
  --qualified-run <runId> `
  --page-id page_products `
  --confirm-production "MIGRATE PRODUCTION CMS"
```

Refuses when:

- qualification missing / version mismatch / environment mismatch
- source hash or `draftRevisionNumber` changed since dry-run
- unresolved conflicts
- backup failure
- post-write re-read hash mismatch

There is **no** `--force` bypass.

## Canary sequence

1. Dry-run one low-risk page (`--page-id`).
2. Review report.
3. Apply that page only.
4. Verify Admin + preview + public + NL/EN + forms.
5. Re-run dry-run on same page ⇒ `pagesChanged = 0`.
6. Expand cohort manually — never auto-promote.

## Post-write verification

Per page after apply:

1. Re-read draft from store
2. `pageContentHash(live) === expected afterHash`
3. Canonical validate

Browser checks:

- Admin editor open
- Preview iframe
- Public storefront
- NL + EN
- Contact / Offerte / Vacatures submit → Aanvragen identity

## Rollback

```powershell
npm run cms:migrate-fixed-blocks -- `
  --rollback `
  --environment staging `
  --qualified-run <runId>
```

Uses backup artifact + optional apply-report after-hashes.  
Refuses automatic rollback if live page diverged after migration (editor edit).

## Conflict resolution

| Conflict | Action |
|----------|--------|
| equivalent | Safe — skip create |
| target_already_exists | Safe — keep block |
| content_conflict / ambiguous | Manual resolve in Admin, new dry-run |

## Incident procedure

1. Stop further apply cohorts.
2. Capture runId, report JSON, backup path (no secrets in tickets).
3. If verify failed mid-batch: report lists per-page status; retry is idempotent for successful pages.
4. Rollback only pages that still match migrated after-hash.
5. Escalate divergent pages for manual restore from backup artifact / revision history.

## Production GO / NO-GO template

```
MG5 PRODUCTION GO/NO-GO

Environment:
Migration version: fixed-block/v1
Qualified dry-run:
Pages scanned:
Pages eligible:
Pages to change:
Conflicts:
Blocked pages:
Backup:
Rollback tested:
Form identity:
NL/EN:
Producten:
Admin parity:
Preview parity:
Storefront parity:
Canary scope:

Decision: GO | NO-GO
```

Do **not** auto-execute GO. Operator must run apply explicitly.
