# Commerce migration upgrade qualification

Permanent harness for **Phase 1 → Phase 2** database upgrade validation.

## Recommended operator flow (local Supabase only)

```bash
# 1. Reset local DB to last migration before Phase 2 customer portal
supabase db reset --version 20260821220000

# 2. Seed representative Phase 1 commerce data + apply Phase 2 migrations
node scripts/commerce/qualify-phase1-to-phase2-upgrade-after-reset.mjs

# 3. Run automated validation
npm run test:qualification:upgrade -w @mccoy/database
```

## Files

| File | Purpose |
| --- | --- |
| `phase1_representative_seed.sql` | Owner/member roles, companies, users, guest, order, payment |
| `phase2_downgrade_for_qual.sql` | Reverts Phase 2 on isolated clone (advanced) |
| `qualify-phase1-to-phase2-upgrade-after-reset.mjs` | Seed + Phase 2 migrations after Phase-1-only reset |
| `qualify-phase1-to-phase2-upgrade.mjs` | Experimental isolated DB clone (may fail with active connections) |

## Validations (automated test)

- `owner` → `account_admin`, `member` → `account_user`
- Company/user/order/payment IDs and money fields unchanged
- `company_users.status` active for seeded memberships
- `commerce_legacy_service_clients` table exists post-upgrade

## Conflict behavior (migration preflight)

Phase 2 migration `20260822120000` refuses multiple `owner` rows per company before role rename.

Test manually on Phase-1-only DB:

```sql
-- Should cause migration failure if two owners exist for one company
```

Do not run destructive qualification against production.

## Customer portal Playwright qualification

Requires local Supabase (`supabase start`) and Mailpit at `http://127.0.0.1:54324` with SMTP on `127.0.0.1:54325` (`[local_smtp]` in `config.toml`; restart Supabase after changes).

```bash
npm run test:e2e:customer-portal:install   # once: download Chromium for Playwright
npm run test:e2e:customer-portal
```

If port 5183/5184 is already in use, stop other dev servers or run:

```bash
# PowerShell
$env:E2E_REUSE_SERVER="1"; npm run test:e2e:customer-portal
```

The `[cms] primary CMS store failed cms upsertPage` webserver warnings are unrelated to customer-portal qualification and can be ignored.

Suites: `e2e/customer-portal/*.spec.ts` (auth, security, users, email/Mailpit, password reset, rate limits, cron, ABC Facility, staff transfer). Uses storefront `:5183` and admin `:5184` by default.
