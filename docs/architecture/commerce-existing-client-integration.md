# Commerce existing McCoy service-client integration

**Status (2026-08-29):** `EXISTING_CLIENT_SOURCE = OPERATOR_MANAGED_FILE_IMPORT`

Former Outcome C (`PRODUCTION_EXISTING_CLIENT_SOURCE_UNAVAILABLE`) is **retired** as the architecture decision. There is no ERP/API feed to discover for Phase 2.3.

Production operational label until a McCoy-approved file is proven in the target environment:

`PRODUCTION_EXISTING_CLIENT_FILE_IMPORT_NOT_YET_QUALIFIED`

## Frozen rules

```text
EXISTING_CLIENT_SOURCE = OPERATOR_MANAGED_FILE_IMPORT
NEW_CUSTOMERS          = FUTURE_SELF_REGISTRATION
```

- **Existing** service customers: operator CSV/XLSX → mirror → sync → companies → staff portal invite.
- **New** companies: future self-registration (not this phase). Do not use legacy import for new signups.

## Architecture

```text
CSV / XLSX (operator-managed)
            │
            ▼
    parse → normalize → validate → preview → confirm
            │
            ▼
commerce_legacy_service_clients   ← mirror (anti-corruption)
            ▼
LegacyMirrorExistingCustomerProvider
            ▼
syncExistingServiceClients()
            ▼
public.companies (service_client, external_customer_id)
            ▼
Staff /customers → portal onboarding
```

**Do not** call external APIs from portal request paths.

**Do not** bypass the mirror and write import rows straight into `companies`.

**Do not** create Auth users from import.

## Identity

- Authoritative key: `external_customer_id` (Klantnummer / Debiteurnummer / explicit aliases / operator map).
- No fuzzy name/email/address matching.
- Missing stable ID → INVALID (never synthesize from company name).
- **Klantsoort** (`party_type`): `bedrijf` / `company` vs `particulier` / `private_person`. Required for correct existing-customer classification; omitted column defaults to `company`. Invalid values → INVALID.
- Operator CSV template: `e2e/fixtures/service-clients-import-template.csv` (also downloadable from admin import dialog).

## Sync rules (implemented)

- Upsert by `external_customer_id` only
- Idempotent repeated import/sync
- Non-destructive: missing mirror row does not delete companies
- Source-owned company fields may update; portal memberships/invitations/passwords do not

## Code entry points

| Component | Role |
| --- | --- |
| `existing-customer-import-parse.ts` | CSV / XLSX parsers |
| `existing-customer-import.ts` | Normalize, classify, preview, commit |
| `importAdminExistingServiceClients` | Staff server fn (preview + reparse on commit) |
| `/customers` → Serviceklanten importeren | Admin UX |

## Cron

Separate Phase 2.3-B blocker: `COMMERCE_CRON_SECRET_CONFIGURATION_REQUIRED`.

## Future Phase 3

Self-registration must not duplicate an imported `external_customer_id` / company — claim flow only. Not implemented now.
