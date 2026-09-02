# Commerce Foundation Phase 2 — Customer portal identity

See also `docs/architecture/commerce-security-invariants.md`.

## Identity ownership

| Layer | Owns |
| --- | --- |
| `auth.users` | Authentication ID, login email, verification, password |
| `public.users` | Profile (`full_name`, phone, `account_kind`, user status) |
| `company_users` | Company membership, `account_admin` / `account_user`, membership status |
| `companies` | Legal entity, commercial status, `external_customer_id` |
| `private.customer_invitations` | Pending invites (no fake memberships) |

Relationship: `auth.users` 1—1 `public.users` 1—N `company_users` N—1 `companies`.

## Roles

Only `account_admin` and `account_user`. Exactly one **active** `account_admin` per company (partial unique index).

Account Admin may invite only `account_user`. Staff assigns/replaces Account Admin.

## Portal vs company status

- **Company status** (`pending`, `active`, `blocked`) — operational/commercial.
- **Portal status** — derived by `resolveCustomerPortalStatus(companyId)`:
  `registration_required`, `invited`, `reminder_sent`, `invite_expired`, `active`, `suspended`.

Frontend must not reimplement portal status logic.

## Invitations

- 256-bit tokens; SHA-256 hash stored only.
- Single pending invite per `(company, email, role)` for account users.
- **One pending `account_admin` invite per company** (`customer_invitations_one_pending_admin_per_company_uq`).
- Staff cannot create a new Account Admin invite when an active admin exists (use transfer RPC).
- Resend revokes previous pending invite.
- TTL: `CUSTOMER_INVITE_TTL_HOURS` (default 72).
- Reminders: `CUSTOMER_INVITE_MAX_REMINDERS` (default 2), via `processExpiredCustomerInvitations`.

## Customer session

- HttpOnly cookies: `mccoy_customer_sb_access_token` / `mccoy_customer_sb_refresh_token` (separate from admin).
- No mandatory customer 2FA.
- Login requires active customer profile + active membership + active company.

## Existing service clients

- Mirror: `public.commerce_legacy_service_clients`
- Provider: `LegacyMirrorExistingCustomerProvider`
- Upsert: `syncExistingServiceClients()` keyed by `external_customer_id` (no fuzzy name merge)

## Transaction boundaries

| Operation | Boundary |
| --- | --- |
| Invitation replace | Revoke pending + insert invitation + outbox enqueue |
| Activation | Consume invitation (conditional) + membership upsert + auth/profile |
| Admin transfer | `public.transfer_company_account_admin` RPC |
| Reminder | Mark expired + insert replacement invitation + outbox |

## Password reset

- Forgot: `/account/forgot-password` → generic response → Supabase email.
- Reset completion: `/account/reset-password` (redirect target from `customerPasswordResetUrl()`).
- Server: `customerCompletePasswordReset` validates recovery session and customer profile, then updates password via service role. Portal access remains denied when membership or company is suspended (`resolveCustomerMembership` / sign-in gate).

## Phase 2 closure report (2026-08-28)

Three decisions are kept separate on purpose. Local engineering qualification does **not** equal production acceptance.

### LOCAL_PHASE_2_QUALIFICATION = QUALIFIED

| Dimension | Status | Evidence |
| --- | --- | --- |
| DATABASE_SECURITY | QUALIFIED | `npm run test:qualification -w @mccoy/database` — private schema denial, RLS isolation, privilege matrix |
| BROWSER_SECURITY | QUALIFIED | `npm run test:e2e:customer-portal` — **31/31** (cookies, storage hygiene, CSRF, rate limits, suspension kick) |
| AUTHENTICATION | QUALIFIED | Login / logout / password-reset browser + Mailpit; suspended membership still denies portal |
| TENANT_ISOLATION | QUALIFIED | Cross-company API denial; account-user management gate; Company A/B RLS |
| INVITATIONS | QUALIFIED | Token hygiene, parallel activation, pending-admin invariant, reminder replacement |
| LOCAL_EMAIL_FLOW | QUALIFIED | Mailpit invite + reminder + password-reset delivery under qualification SMTP |
| ACCOUNT_ADMIN_TRANSFER | QUALIFIED | Staff browser transfer + parallel transfer domain test |
| PHASE_1_REGRESSION | QUALIFIED | `phase1-integration-regression.test.ts` on post–Phase-2 qual DB (list/detail, profile/company update, block/unblock, guest→registered, CSV export/import preview, orders/items/payments minor units + separate statuses) |
| GUARDIAN | QUALIFIED | `node .cursor/guardian/cli.mjs verify` — `decision: "qualified"`, `blockers: []` |

**Environment:** local McCoy Supabase (`http://127.0.0.1:54321`, Postgres `127.0.0.1:54322`, Mailpit `http://127.0.0.1:54324`). Remote production Supabase is **not** used for attack/qualification tests.

**Migrations:** Full chain on main local `postgres` DB; Phase 1→2 upgrade evidenced on isolated clone `mccoy_p1_upgrade_test` via `scripts/commerce/qualify-phase1-to-phase2-upgrade.mjs`.

**Final local gates (2026-08-28):**

| Gate | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run test:ci` | **155 passed** (`@mccoy/cms-renderer`) |
| `npm run test -w @mccoy/database` | **174 passed** |
| `npm run test:qualification -w @mccoy/database` | **36 passed** (Phase 2 + Phase 1 regression + upgrade + cron + outbox) |
| `npm run test:e2e:customer-portal` | **31 passed** |
| `node .cursor/guardian/cli.mjs verify` | **qualified**, `blockers: []` |

**Phase 1→2 upgrade harness (permanent):**

| Artifact | Purpose |
| --- | --- |
| `supabase/qualification/phase1_representative_seed.sql` | Representative Phase 1 companies, users, orders, payments |
| `supabase/qualification/phase2_downgrade_for_qual.sql` | Revert Phase 2 on isolated clone only |
| `scripts/commerce/qualify-phase1-to-phase2-upgrade.mjs` | Isolated DB clone → downgrade → seed → apply Phase 2 migrations |
| `npm run test:qualification:upgrade -w @mccoy/database` | Role remap + preserved money/statuses |

### PRODUCTION_OPERATIONAL_QUALIFICATION = NOT_QUALIFIED

Remaining production blockers (evidence 2026-08-29):

1. **`PRODUCTION_EXISTING_CLIENT_FILE_IMPORT_NOT_YET_QUALIFIED`** — No approved McCoy CSV/XLSX (or safe subset) was available for staff preview/confirm. Architecture source remains `OPERATOR_MANAGED_FILE_IMPORT`; local import code is QUALIFIED. See `commerce-foundation-phase2.3.md`.
2. **`COMMERCE_CRON_SECRET_CONFIGURATION_REQUIRED`** — No Vercel write access in this session; secret not configured by the agent.
3. **`DEPLOYED_CRON_ROUTE_NOT_REACHABLE`** — Probed `admin.mccoy.nl` and the documented development admin host: `GET /api/commerce-portal-jobs` returned **404** for both missing and wrong Bearer (expected live gate is 401/503). Correct-Bearer and scheduled delivery not proven.

Local Phase 2.3 gates remain the previously executed green set (typecheck / test:ci 155 / database 187 / qualification 40 / e2e 31 / Guardian qualified). This production probe made **no application code changes** and did not re-run those suites.

### FINAL_PHASE_2_STATUS = PHASE_2_NOT_ACCEPTED

Local qualification is complete. Production operational qualification is not. Therefore Phase 2 remains **not accepted** for production go-live until the blockers above are closed by operators/integration work outside this local engineering tranche.

**`PHASE_2_NOT_ACCEPTED` means:** the implementation is locally qualified; two required production dependencies have not yet been proven — not that the Phase 2 code is unfinished.

**Next tranche:** [Commerce Foundation Phase 2.3 — Production Source & Cron Activation](./commerce-foundation-phase2.3.md) (cursor kickoff: [phase2.3-cursor-prompt](./commerce-foundation-phase2.3-cursor-prompt.md)). No catalogue / registration / checkout / Mollie work until Phase 2 is accepted.

## Staff UI (`/customers`)

- Tab **Serviceklanten (portaal)** lists `service_client` companies with resolved portal status.
- Detail: `/customers/company/:companyId` — users, invitations, invite admin, resend, transfer, suspend portal (company `blocked`).

## Reminder / email jobs

- Workers: `processExpiredCustomerInvitations`, `processCommerceEmailOutbox`.
- Vercel cron: `GET /api/commerce-portal-jobs` on admin app (hourly), secured with `COMMERCE_CRON_SECRET` bearer token.
- Manual: staff `processAdminCommerceJobs` server function.

Portal list with `portalStatus` filter resolves status before pagination (correct totals).

Out of scope for Phase 2: public KvK registration, ordering, Mollie, products, Aanvragen integration.
