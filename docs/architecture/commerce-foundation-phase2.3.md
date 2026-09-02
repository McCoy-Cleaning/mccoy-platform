# Commerce Foundation Phase 2.3 — Production Existing-Customer Import & Cron Activation

**Status:** Local import implementation **QUALIFIED** (2026-08-29); production file + cron still pending  
**Parent:** Commerce Foundation Phase 2 (locally `QUALIFIED`; overall `PHASE_2_NOT_ACCEPTED`)  
**Updated:** 2026-08-29

This tranche closes the final production-operational dependencies. It is **not** Phase 3.

```text
LOCAL_PHASE_2_QUALIFICATION          = QUALIFIED
PRODUCTION_OPERATIONAL_QUALIFICATION = NOT_QUALIFIED
FINAL_PHASE_2_STATUS                 = PHASE_2_NOT_ACCEPTED
```

---

## Frozen business rules

```text
EXISTING_CLIENT_SOURCE = OPERATOR_MANAGED_FILE_IMPORT
NEW_CUSTOMERS          = FUTURE_SELF_REGISTRATION
```

**Authoritative sentence:** Existing McCoy service customers are provisioned through an operator-managed CSV/XLSX import. New companies do not enter through that import; they will register themselves through the customer self-registration workflow (future phase — **not** implemented here).

There is **no** production ERP/CRM/API feed required for this phase. Do not classify the source as unavailable merely because there is no API.

Former blocker `PRODUCTION_EXISTING_CLIENT_SOURCE_UNAVAILABLE` is retired as the architecture classification.

Current import qualification labels:

| Label | Meaning |
| --- | --- |
| `PRODUCTION_EXISTING_CLIENT_FILE_IMPORT_NOT_YET_QUALIFIED` | Code may be local-qualified; production McCoy file proof not done |
| `PRODUCTION_EXISTING_CLIENT_FILE_IMPORT_QUALIFIED` | Only after approved production file evidence |

---

## Scope

| Workstream | Goal |
| --- | --- |
| **2.3-A** | CSV/XLSX → normalize → validate → preview → `commerce_legacy_service_clients` → sync → companies |
| **2.3-B** | `COMMERCE_CRON_SECRET` on target Vercel + deployed `/api/commerce-portal-jobs` proof |

Out of scope: KvK/self-registration, catalogue, checkout, Mollie, favorites, lists.

---

## Import architecture (2.3-A)

```text
CSV / XLSX
    ↓
file parser (format-only difference)
    ↓
NormalizedExistingCustomerRow
    ↓
validation + classification (NEW|UPDATE|UNCHANGED|INVALID|CONFLICT)
    ↓
operator preview (no mutation)
    ↓
confirmed import (server re-parses; never trusts client classifications)
    ↓
commerce_legacy_service_clients
    ↓
LegacyMirrorExistingCustomerProvider
    ↓
syncExistingServiceClients()
    ↓
companies (service_client) → portal onboarding (registration_required)
```

**Identity:** `external_customer_id` from Klantnummer / Debiteurnummer / explicit aliases or operator column map. Never name/email/address fuzzy match. Missing ID → INVALID.

**Deletion:** Absent from a later file does **not** delete companies.

**Auth:** Import never creates `auth.users`, `public.users`, or `company_users`.

**Field ownership:** see `EXISTING_CUSTOMER_FIELD_OWNERSHIP` in `packages/database/src/customer-portal/existing-customer-import.ts`.

Admin UI: `/customers` → **Serviceklanten importeren** (preview → import valid rows). CRM invite CSV remains separate (**CRM importeren**).

---

## Cron (2.3-B)

- Route: `apps/admin/src/routes/api.commerce-portal-jobs.ts`
- Schedule: `apps/admin/vercel.json` hourly
- Secret: server-only `COMMERCE_CRON_SECRET` (never `VITE_` / `NEXT_PUBLIC_` / `PUBLIC_`)

Local cron auth is covered by customer-portal E2E + `cron-auth.test.ts`. Production remains `COMMERCE_CRON_SECRET_CONFIGURATION_REQUIRED` until operator evidence exists.

### Operator steps (production / staging)

1. In Vercel → admin project → Environment Variables → add `COMMERCE_CRON_SECRET` (high-entropy, server-only) for Production (and Staging if used).
2. Redeploy admin so the env is live **and** confirm `/api/commerce-portal-jobs` is present on that deployment (not a SPA 404).
3. Prove:
   - `GET /api/commerce-portal-jobs` without `Authorization` → denied (`401` or `503` if secret missing)
   - wrong `Bearer` → denied (`401`)
   - correct `Bearer $COMMERCE_CRON_SECRET` → `200` with job metrics
4. Confirm Vercel Cron invocations appear in deployment logs for `/api/commerce-portal-jobs`.
5. Do not print the secret in tickets or chat.

### Production operational probe (2026-08-29) — FAIL CLOSED

**No application code changes in this probe.**

| Prerequisite | Result |
| --- | --- |
| Approved McCoy CSV/XLSX in workspace / operator handoff | **Absent** — 0 `.csv`/`.xlsx` files; no approved production subset provided |
| Explicit import confirmation authorization | **Absent** |
| Vercel CLI / project link / write access for env vars | **Absent** (`vercel` not installed; no `apps/admin/.vercel`) |
| Deployed route reachability | **Not proven as cron API** |

Unauthenticated / wrong-Bearer probes (status only; no secret used):

| Target | No Authorization | Wrong Bearer |
| --- | --- | --- |
| `https://admin.mccoy.nl/api/commerce-portal-jobs` | `404` | `404` |
| `https://mccoy-platform-admin-git-development-mccoy1.vercel.app/api/commerce-portal-jobs` | `404` | `404` |

Expected for a live route with missing secret is `503`; with secret configured and bad/missing Bearer is `401`. Receiving HTML/SPA-style `404` means the cron handler is **not** evidenced as deployed on those hosts. Correct-Bearer acceptance and scheduled delivery were **not** attempted (no secret, route not reachable as API).

Client exposure (repo source): `COMMERCE_CRON_SECRET` only via `process.env` in `api.commerce-portal-jobs.ts` — **PASS** for forbidden `VITE_` / `NEXT_PUBLIC_` / `PUBLIC_` names (local unit guard remains green).

```text
LOCAL_PHASE_2_3_IMPORT_QUALIFICATION = QUALIFIED
PRODUCTION_FILE_IMPORT_QUALIFICATION = NOT_QUALIFIED
  reason: PRODUCTION_FILE_IMPORT_APPROVED_SOURCE_UNAVAILABLE
         + PRODUCTION_FILE_IMPORT_CONFIRMATION_REQUIRED
PRODUCTION_CRON_QUALIFICATION        = NOT_QUALIFIED
  reason: COMMERCE_CRON_SECRET_CONFIGURATION_REQUIRED
         + DEPLOYED_CRON_ROUTE_NOT_REACHABLE (404 on probed hosts)
PRODUCTION_OPERATIONAL_QUALIFICATION = NOT_QUALIFIED
FINAL_PHASE_2_STATUS                 = PHASE_2_NOT_ACCEPTED
```

### Local Phase 2.3 gate evidence (previously executed 2026-08-29 — not re-run this probe)

| Gate | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run test:ci` | 155 passed |
| `npm run test -w @mccoy/database` | 187 passed |
| `npm run test:qualification -w @mccoy/database` | 40 passed |
| `npm run test:e2e:customer-portal` | 31 passed |
| `node .cursor/guardian/cli.mjs verify` | qualified, blockers: [] |


---

## Future Phase 3 note (do not implement)

A company already created via CSV/XLSX import must not later be duplicated by self-registration. Future registration must detect existing company identity and route to a claim/onboarding flow.

---

## Kickoff prompt

`docs/architecture/commerce-foundation-phase2.3-cursor-prompt.md`
