# MCCOY — COMMERCE FOUNDATION PHASE 2.1
## OPERATIONAL QUALIFICATION & PRODUCTION WIRING

**Copy everything below this line into a new Cursor agent session.**

---

You are continuing the existing McCoy Commerce Foundation implementation.

The codebase has completed most of **Commerce Foundation Phase 2** — Customer Identity, Company Access, Onboarding & Portal Authentication — but Phase 2 is **not yet accepted** because several operational and end-to-end qualification gates remain unresolved.

This task is **Phase 2.1**, a closure tranche.

**It is NOT Phase 3.**

### Objective chain

```text
CODE COMPLETE
      ↓
OPERATIONALLY PROVEN
      ↓
SECURITY QUALIFIED
      ↓
PHASE_2_ACCEPTED
```

Act simultaneously as:

- senior security engineer
- senior PostgreSQL/Supabase database architect
- senior full-stack engineer
- senior identity/authentication engineer
- senior QA automation engineer
- senior DevOps engineer
- senior systems architect
- senior project manager responsible for preventing technical debt and unsafe milestone promotion

**Rules:**

- Do not optimize for speed over correctness.
- Do not claim evidence you did not execute.
- Do not weaken acceptance criteria to close the phase.
- Do **not** change the customer architecture unless a remaining qualification test discovers a **real defect**.

---

## PRIORITY ORDER (execute in this order)

| Priority | Blocker | Type | Action |
| --- | --- | --- | --- |
| **P0** | Production existing-client source | Architecture / integration | **Solve first** — determine authoritative McCoy customer system and wire sync |
| **P0** | Phase 1 → Phase 2 migration upgrade test | Database safety | Permanent upgrade harness, not one-time manual |
| **P1** | Browser E2E security qualification | Security | Playwright: cookies, storage, CSRF, cross-tenant API attacks |
| **P1** | Live email/outbox qualification | Operational | Safe test mailbox / sandbox |
| **P1** | `COMMERCE_CRON_SECRET` deployment | Operations | Vercel config + endpoint auth proof |

The **16 isolated-database qualification tests** already proved structural properties (RLS, Account Admin uniqueness, invitation races, suspension, reminder idempotency, tenant boundaries). What remains is mostly **production wiring + browser-level evidence**.

---

## 1. CURRENT AUTHORITATIVE STATE

Commerce Foundation Phase 1 introduced:

`companies`, `company_users`, `guest_purchasers`, `orders`, `order_items`, `payments`

with money in minor units and separate order / payment / fulfilment status machines.

Identity architecture (do **not** redesign):

```text
auth.users
    ↓ 1:1
public.users
    ↓
company_users
    ↓
companies
```

- `auth.users` = authentication identity
- `public.users` = McCoy application profile
- `company_users` = company membership
- `companies` = company identity

Pending users = `private.customer_invitations` (not fake `company_users`).

---

## 2. CUSTOMER ROLE MODEL IS FROZEN

Only:

- `account_admin`
- `account_user`

Do **not** add owner, buyer, finance, manager, viewer, operator.

```text
McCoy Staff
     │
     ▼
Company
  ├── exactly one Account Admin
  ├── Account User
  └── Account User …
```

McCoy staff is a **separate** authorization domain. Do **not** make staff members of customer companies.

---

## 3. ROUTE ARCHITECTURE IS FROZEN

Do **not** introduce `/admin`.

Staff customer management: `/customers`

Relevant routes:

- `/customers`, `/customers/registered/:id`, `/customers/guest/:id`, `/customers/company/:companyId`
- `/account`, `/account/login`, `/account/activate`, `/account/forgot-password`, `/account/reset-password`, `/account/company`, `/account/company/users`

---

## 4. CURRENT PHASE 2 IMPLEMENTATION (preserve)

**Migrations:**

- `20260822120000_commerce_foundation_phase2_customer_portal.sql`
- `20260822130000_commerce_phase2_admin_invite_invariant.sql`

**Backend:** `packages/database/src/customer-portal/` — sessions, invitations, activation, reminders, transfer, sync, portal status, outbox, qualification harness.

**Customer cookies:** `mccoy_customer_sb_access_token`, `mccoy_customer_sb_refresh_token` (separate from staff `mccoy_sb_*`).

**No mandatory customer 2FA** — explicit business requirement.

---

## 5. CURRENT QUALIFICATION EVIDENCE (do not discard)

**Environment:** `QUALIFICATION_DB_AVAILABLE` — local isolated McCoy Supabase (`http://127.0.0.1:54321`, Postgres `127.0.0.1:54322`). **Never** qualify destructively against production.

**Suite:** `npm run test:qualification -w @mccoy/database` — ~16 integration tests in `packages/database/src/customer-portal/qualification/`.

**Already proven:** Account Admin unique invariant, pending admin invite invariant, private schema denial, Company A/B RLS, privilege matrix, invitation attacks, parallel activation/resend/transfer races, reminder idempotency, mirror sync idempotency, portal filter-before-pagination.

**Repository gates (must not regress):**

- `npm run typecheck` — pass
- `npm run test:ci` — 148 passed
- `npm run test -w @mccoy/database` — 154 passed
- `node .cursor/guardian/cli.mjs verify` — qualified, `blockers: []`

Guardian qualification ≠ Commerce Phase 2 acceptance.

**Current decision:** `PHASE_2_NOT_ACCEPTED`

---

## 6. STRICT NON-GOALS

Do **not** implement: KvK, new company registration, products, favorites, lists, quick order, cart, checkout, Mollie, invoice expansion, service-request portal, Aanvragen, private consumer checkout, external B2B API, CMS, SEO, public redesign.

**STOP after qualification.** Do not begin Phase 3.

---

# WORKSTREAM P2.1-A — EXISTING MCCOY CUSTOMER SOURCE (P0 — FIRST)

## Business requirement

Existing McCoy service clients must appear **automatically** in customer management — staff must not manually recreate known clients.

## Current state (works in qualification)

```text
commerce_legacy_service_clients
        ↓
LegacyMirrorExistingCustomerProvider
        ↓
companies
        ↓
/customers → portal onboarding
```

Qualification already proved: ABC Facility sync, idempotent re-sync, upstream row removal does **not** delete `companies`.

## Architectural question to resolve

**Something must populate `commerce_legacy_service_clients`.** The mirror is an **integration boundary**, not necessarily the source of truth.

Search comprehensively for: backoffice, service clients, customer numbers, ERP, CRM, invoice customers, accounting, inventory API, imports, legacy clients, env vars, scheduled jobs, connectors, migrations, docs.

## Target architecture (preferred)

```text
MCCOY EXISTING CUSTOMER SYSTEM
            │
            │ stable customer identifier (external_customer_id)
            ▼
sync worker / Customer source adapter
            ▼
commerce_legacy_service_clients   ← anti-corruption layer (keep if useful)
            ▼
LegacyMirrorExistingCustomerProvider
            ▼
companies
            ▼
Customer Portal
```

**Do not** couple portal directly to external system:

```text
customerPortal.ts → call BackOffice XYZ directly   ❌
```

**Do not** make the mirror a manually maintained customer database.

## Classify exactly one outcome

| Outcome | Action |
| --- | --- |
| **A** | Real automated production source exists → connect/reuse; preserve `external_customer_id` |
| **B** | Canonical source already in app/DB → use directly or populate mirror deterministically |
| **C** | No authoritative automated source → record `PRODUCTION_EXISTING_CLIENT_SOURCE_UNAVAILABLE`; do **not** fake with fixtures/CSV |

## Sync rules

- Identity: `external_customer_id` (never fuzzy name merge)
- Idempotent, restart-safe, non-destructive, observable
- Source outage must **not** DELETE companies, users, orders, invitations
- Optional: `last_synced_at`, `source_updated_at`, `sync_status`

---

# WORKSTREAM P2.1-B — PHASE 1 → PHASE 2 MIGRATION HARNESS (P0)

Fresh DB success does **not** prove production upgrade.

Create **permanent** infrastructure (not one-time manual):

```text
Database at exact Phase 1 state
        ↓
representative Phase 1 data
        ↓
apply 20260822120000_*
        ↓
apply 20260822130000_*
        ↓
validate
```

**Representative Phase 1 data:**

- `companies`: `product_customer`, `service_client`
- `company_users`: `owner`, `member`
- `public.users`, `guest_purchasers`, `orders`, `order_items`, `payments`
- Multiple companies, owner + members, guest, historic order/payment

**Verify:**

- `owner` → `account_admin`, `member` → `account_user`
- Company IDs, user IDs, orders, payments, guest purchasers, money minor units, statuses **unchanged** unless migration explicitly transforms

**Conflict tests:** multiple owners, duplicate `external_customer_id` → fail loudly or explicit remediation; never silent winner/delete.

Retain harness for future commerce migrations.

---

# WORKSTREAM P2.1-C — BROWSER SECURITY & CUSTOMER E2E (P1)

Reuse existing Playwright infrastructure. Extend with focused suites (follow repo naming):

- `customer-portal-auth` (conceptually)
- `customer-portal-security`
- `customer-portal-users`

### Must prove in browser

1. **Login E2E** — Peter → `/account/login` → `/account` → correct company
2. **Cookies** — inspect `mccoy_customer_sb_access_token`, `mccoy_customer_sb_refresh_token` (HttpOnly, Secure, SameSite, Path). Distinguish local HTTP vs production-like config.
3. **Staff/customer cookie isolation** — `mccoy_sb_*` and `mccoy_customer_sb_*` coexist; neither login destroys the other
4. **Browser storage** — after login: no access/refresh token / Supabase session in `localStorage`, `sessionStorage`, `IndexedDB`
5. **Account User** — UI hides management; **API calls as Account User** → `CUSTOMER_ADMIN_REQUIRED` (not just hidden buttons)
6. **Account Admin** — invite/resend/suspend/reactivate own `account_user`; denied: invite admin, promote, demote self, transfer, Company B
7. **Cross-tenant application attacks** — Admin/User A tamper Company B via URL, query, JSON, API, IDs → all denied (catches service-role-before-auth bugs)
8. **Service-role safety audit** — every customer-triggered service-role path: authenticate → authorize → derive company → operation
9. **Membership suspension E2E** — active session → suspend membership → protected action denied immediately (no JWT wait)
10. **Company suspension E2E** — company blocked → portal denied; staff can still manage
11. **CSRF/origin** — state-changing routes: valid origin, invalid/missing, cross-origin where practical
12. **Rate limits** — login, forgot password, activation, invite, resend → threshold + recovery; no email spam relay

---

# WORKSTREAM P2.1-D — PASSWORD RESET, EMAIL, OUTBOX & CRON (P1)

### Password reset E2E

```text
/account/forgot-password → generic response → test mailbox → /account/reset-password
→ new password → old fails → new succeeds
```

No tokens in browser storage.

**Suspended membership:** reset may succeed; auth may succeed; `/account` portal authorization **must fail** (authentication ≠ authorization).

### Email outbox E2E

```text
invitation → commerce_email_outbox → processor → test mailbox → valid activation URL
```

Reminder: expired invite → processor → new outbox → new email → old URL fails → new URL succeeds → second run → no duplicate reminder.

Use local Supabase mail catcher, sandbox, or controlled internal address — **never** uncontrolled real customers.

If no transport: `EMAIL_TRANSPORT_QUALIFICATION_UNAVAILABLE` (do not fake).

### Cron

- Endpoint: `apps/admin/src/routes/api.commerce-portal-jobs.ts`
- Scheduler: `apps/admin/vercel.json`
- Auth: no Bearer → denied; wrong Bearer → denied; correct secret → success
- `COMMERCE_CRON_SECRET` — server-only; never `VITE_*`, `NEXT_PUBLIC_*`, `PUBLIC_*`
- If Vercel env not accessible: `COMMERCE_CRON_SECRET_CONFIGURATION_REQUIRED` + operator steps
- Log job metrics; never log secrets or raw tokens

---

# WORKSTREAM P2.1-E — FULL REGRESSION & ACCEPTANCE

### Phase 1 regression (integration, not only unit)

Registered/guest listing & detail, profile/company updates, block/unblock, guest→registered, CSV import/export, fixtures, orders, order_items, payments, minor-unit money, status separation — against qualification DB where appropriate.

### Full ABC Facility scenario (every step needs evidence)

1. ABC in authoritative source → sync → one `companies` row
2. `/customers` shows ABC, portal status registration required
3. Staff invites Peter as Account Admin
4. Peter activation email → activate → password → login `/account`
5. Peter → `public.users` → `company_users` → ABC → `account_admin`
6. Peter invites Sophie → Sophie activates → `account_user`
7. Sophie cannot manage users; Peter can manage Sophie; neither accesses Company B

### Also execute

- Account Admin transfer E2E (Peter/Sophie swap, one admin, audit)
- Reminder full lifecycle E2E
- Duplicate user / staff collision cases
- Audit verification (no passwords/tokens in audit metadata)
- Portal filter pagination regression (filter **before** pagination — do not regress)
- Mobile viewport smoke (320/375/tablet/desktop) on login, activate, reset, users
- Accessibility basics on portal flows

### Permanent security harness

**Retain and extend** `packages/database/src/customer-portal/qualification/`. Future commerce tables must join Company A/B isolation matrix.

### Documentation

Update:

- `docs/architecture/commerce-foundation-phase2.md`
- `docs/architecture/commerce-security-invariants.md`

Include: migration upgrade evidence, browser security, cookies/storage, password reset, email/outbox, cron, existing-client decision, E2E results, deployment actions.

### Repository gates (after changes)

Run actual repo scripts:

- `npm run typecheck`
- `npm run test:ci`
- `npm run test -w @mccoy/database` (includes `test:qualification`)
- `node .cursor/guardian/cli.mjs verify`
- relevant admin/storefront tests + Playwright E2E

Guardian must remain: `decision: qualified`, `blockers: []`

---

## EXTERNAL BLOCKER CLASSIFICATION

Never fake completion. Use:

- `CODE_COMPLETE`
- `TEST_COMPLETE`
- `OPERATIONALLY_UNQUALIFIED`
- `EXTERNAL_DEPENDENCY_REQUIRED`

---

## FINAL REPORT FORMAT

Provide sections **A–P** as specified in the full acceptance checklist (qualification environment, existing-client source, migration upgrade, browser security, authentication, authorization, tenant isolation, invitations, reminder/cron, email/outbox, E2E, Phase 1 regression, repository gates, external requirements, code changes).

End with **exactly one**:

```text
PHASE_2_ACCEPTED
```

or:

```text
PHASE_2_NOT_ACCEPTED
```

followed by exact remaining blockers with evidence gaps.

**Do not** accept because code looks correct, Guardian is green, unit tests pass, or fresh migration alone succeeds.

**Do not** make unnecessary architectural changes while Phase 2 remains unaccepted.

---

## STOP CONDITION

After the Phase 2.1 report: **STOP.**

Do not begin Phase 3, KvK, products, favorites, lists, quick order, orders, checkout, Mollie, or service requests.

Wait for explicit authorization.

The purpose of this tranche is a **fully proven** customer identity, tenancy, Account Admin/User model, invitations, authentication, and operational onboarding foundation that later commerce can safely trust.

---

## FIRST ACTIONS FOR THE AGENT

1. Read `docs/architecture/commerce-foundation-phase2.md` and `commerce-security-invariants.md`.
2. Confirm local qualification Supabase is available (`supabase status`); do not attack production.
3. **P2.1-A:** Repository-wide search for existing McCoy customer source; document Outcome A/B/C with evidence.
4. **P2.1-B:** Implement permanent Phase 1 → Phase 2 upgrade harness.
5. **P2.1-C:** Extend Playwright for browser security E2E.
6. **P2.1-D:** Email + cron operational qualification.
7. **P2.1-E:** Full regression, ABC scenario, gates, docs, final report.
