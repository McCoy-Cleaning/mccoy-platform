# MCCOY — COMMERCE FOUNDATION PHASE 2.3
## PRODUCTION EXISTING-CUSTOMER IMPORT & CRON ACTIVATION

**Copy everything below this line into a new Cursor agent session.**

---

You are continuing McCoy Commerce Foundation **Phase 2.3**.

Frozen rules:

```text
EXISTING_CLIENT_SOURCE = OPERATOR_MANAGED_FILE_IMPORT
NEW_CUSTOMERS          = FUTURE_SELF_REGISTRATION
```

Do **not** search for an ERP/API feed. Do **not** implement self-registration / KvK / catalogue / Mollie.

Authoritative docs:

- `docs/architecture/commerce-foundation-phase2.3.md`
- `docs/architecture/commerce-existing-client-integration.md`
- `docs/architecture/commerce-foundation-phase2.md`

### 2.3-A

CSV/XLSX → shared normalize/validate/classify → preview → confirm → `commerce_legacy_service_clients` → `syncExistingServiceClients()` → companies.

Identity = `external_customer_id` only. No Auth users from import.

### 2.3-B

Configure/prove `COMMERCE_CRON_SECRET` on deployed admin `/api/commerce-portal-jobs` if authorized; otherwise leave `COMMERCE_CRON_SECRET_CONFIGURATION_REQUIRED` with operator steps.

Final status must distinguish local import qualification vs production file import vs production cron vs overall Phase 2 acceptance. Do not lower the production gate.
