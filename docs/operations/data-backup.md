# McCoy data backup (free, local)

Paid Supabase Dashboard backups / PITR are **not** required. This operator job dumps Postgres and Storage to a directory you own.

Production data is personal and commercial. **Do not** send dumps to GitHub Artifacts, public buckets, or a new SaaS (that would add a personal-data processor). Default destination: `MCCOY_BACKUP_DIR`, or `<repo>/.data/backups` (gitignored).

Never commit dumps, service-role keys, or `.env`.

## What is copied

1. **Postgres** — schemas `public`, `private`, `auth`, and `storage` when the dump role allows it.
   - Prefers local `pg_dump` (custom format → `database.dump`).
   - Falls back to `npx supabase db dump` (SQL → `database.sql` + `database-data.sql`). That CLI path runs `pg_dump` in Docker and **excludes `auth` / `storage` unless `--schema` is passed** (the script passes them).
   - `auth.users` is included **only** if the dump URL can read Auth. Use the database password from Dashboard → **Project Settings → Database** (URI, session or direct **port 5432**, not the transaction pooler on 6543). Free tier still allows this connection.
2. **Storage objects** — buckets from migrations (`cms-media`, `website-request-attachments`) plus any other buckets the service role can list. Paths are preserved under `storage/<bucket>/...`.
3. **`manifest.json`** — timestamp, project URL **host only**, file counts. No secrets.

Each run creates `$MCCOY_BACKUP_DIR/YYYY-MM-DDTHHMMSS/`. Older complete folders are deleted after `MCCOY_BACKUP_RETAIN` (default **14**). Incomplete runs are removed.

RLS stays enabled. The script is server-side only (`SUPABASE_SECRET_KEY` + dump URL). It never runs in the browser.

## Environment

Set these in the monorepo root `.env`. Add the same empty placeholders to `.env.example` if they are not there yet (no real values):

| Variable | Required | Notes |
|----------|----------|--------|
| `SUPABASE_URL` | yes | Project API URL (host is recorded in the manifest) |
| `SUPABASE_SECRET_KEY` | yes | Service role; server only |
| `SUPABASE_DB_URL` | yes | Postgres URI for `pg_dump` / `supabase db dump` |
| `MCCOY_BACKUP_DIR` | no | Operator-owned folder. Unset → `<repo>/.data/backups` |
| `MCCOY_BACKUP_RETAIN` | no | Keep last N complete backups (default `14`) |

`DATABASE_URL` is accepted as an alias for `SUPABASE_DB_URL`. `SUPABASE_SERVICE_ROLE_KEY` is accepted as an alias for `SUPABASE_SECRET_KEY`.

Install **PostgreSQL client tools** (`pg_dump`) on the backup machine. Otherwise install **Docker** so `npx supabase db dump` can run.

## Run once

From the repo root:

```bash
npm run backup:mccoy
```

or `node --env-file=.env scripts/backup/backup-mccoy.mjs`. Missing `SUPABASE_SECRET_KEY` or `SUPABASE_DB_URL` exits non-zero with a clear error. Logs are JSON lines with secrets redacted.

## Enable the daily Windows task (free)

The backup PC must be on (or wake) around the scheduled time. Task Scheduler will run a missed job after the next login/wake (`-StartWhenAvailable`).

```powershell
cd C:\Users\Ra\Desktop\mccoy_code
powershell -ExecutionPolicy Bypass -File scripts\backup\schedule-windows.ps1
# optional: -At 03:15 -TaskName McCoy-Backup
```

This registers **McCoy-Backup** for the current user (no GitHub, no cloud). Confirm with Task Scheduler → Task Scheduler Library → **McCoy-Backup**. A text log is appended to `<repo>\.data\backups\scheduler.log`.

Remove: `Unregister-ScheduledTask -TaskName McCoy-Backup -Confirm:$false`.

Optional GitHub Actions workflow (`.github/workflows/mccoy-backup.yml`) is **self-hosted only**, `workflow_dispatch` + cron, and **skips unless `MCCOY_BACKUP_DIR` is set on that runner**. It must not upload artifacts.

## Restore

This replaces paid Dashboard backups as the operator-owned copy. It does **not** use `supabase db push` — that only applies migration files, not dump data.

Point the app at a **new** free Supabase project or local `npx supabase start`, then restore.

**Database one-liner** (custom dump):

```bash
pg_restore --no-owner --no-acl --dbname "$NEW_SUPABASE_DB_URL" "$MCCOY_BACKUP_DIR/<stamp>/database.dump"
```

SQL fallback:

```bash
psql "$NEW_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$MCCOY_BACKUP_DIR/<stamp>/database.sql"
psql "$NEW_SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$MCCOY_BACKUP_DIR/<stamp>/database-data.sql"
```

Before schema restore into an existing Supabase project, revoke inherited default grants if you need to preserve dumped privileges (see [Supabase db dump](https://supabase.com/docs/reference/cli/supabase-db-dump)).

**Storage:** re-upload each file under `storage/<bucket>/...` to the same path (service role `storage.from(bucket).upload`). Then set `SUPABASE_URL` / keys in app env to the new project.

### Auth caveats

Restoring `auth.users` into a different project can disagree with GoTrue identities, sessions, and the new project's JWT secret. Prefer restore into a project that uses the same JWT secret, or re-invite users after a schema/data restore that omitted `auth`. Confirm `authIncluded` in `manifest.json`.

### Limitations

- The Windows task only runs when that machine is available.
- Dump URL must use a role that can read the schemas you care about.
- `supabase db dump` without this script's `--schema` flags would omit Auth.
- Object versions / soft-deleted Storage rows are not snapshotted beyond what the list+download API returns.
- Remote object storage (S3, R2, Backblaze) is out of scope unless added later as an explicit processor decision.
