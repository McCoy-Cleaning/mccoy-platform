# Commerce security invariants (locked)

These rules are regression requirements for all commerce phases.

1. `auth.users` owns authentication identity.
2. `public.users` owns McCoy application profile.
3. `company_users` owns company membership.
4. `companies` owns company identity.
5. Pending invitations do not create fake company memberships.
6. One company has exactly one active Account Admin (DB-enforced).
7. A company may have many Account Users.
8. Account Admin may create only Account Users.
9. Only McCoy staff may replace Account Admin.
10. Customer passwords are chosen only by the customer.
11. Customer 2FA is not mandatory.
12. Invitation links are single-use.
13. Invitation links expire.
14. Invitation secrets are never stored raw.
15. Replacing an invitation invalidates the old invitation.
16. Customer company identity is derived server-side.
17. Browser-provided company identity is never trusted.
18. Company A cannot access Company B.
19. Customer authorization requires active membership.
20. Company suspension denies customer portal access.
21. Membership suspension takes effect immediately.
22. Customer JWT/session credentials are not persisted in browser storage.
23. Staff and customer authorization domains remain separate.
24. Service-role credentials never reach the browser.
25. Sensitive account mutations are audited.

## Qualification matrix (isolated local Supabase, 2026-08-22 Phase 2.1)

| Area | Evidence |
| --- | --- |
| Private schema | Anon/authenticated PostgREST denied on `private.customer_invitations` / `commerce_email_outbox` |
| RLS tenancy | Company A JWT cannot read Company B `companies`, `company_users`, `orders` |
| Account User | Domain `accountAdminInviteUser` / `suspendCompanyMembership` denied without admin role |
| Account Admin | Cannot invite `account_admin`; parallel staff admin invites → exactly one pending (replace or reject) |
| Activation race | Dual parallel activation → one success, one failure, single user row |
| Transfer race | Parallel transfers → exactly one active `account_admin` |
| Token hygiene | DB stores SHA-256 hash only; consumed/revoked/invalid tokens rejected |
| Mirror sync | ABC Facility upsert idempotent; upstream row removal does not delete company |
| Reminders | Expired invite → one replacement; second processor pass → no duplicate reminder |
| Password reset + suspension | Password update succeeds; `resolveCustomerMembership` null while suspended |
| Portal pagination | Filtered `portalStatus` totals match filtered set |
| Phase 1→2 upgrade | Isolated `mccoy_p1_upgrade_test`: owner→`account_admin`, member→`account_user`, money/status preserved |
| Email outbox | Invitation enqueues outbox; processor marks row processed (`dev-skip` when no SMTP) |
| Cron auth | Bearer gate logic + no `VITE_*`/`PUBLIC_*` cron secret in admin route source |

**Production blockers (Phase 2.3):** `PRODUCTION_EXISTING_CLIENT_FILE_IMPORT_NOT_YET_QUALIFIED` (operator CSV/XLSX source is frozen; production file proof pending); `COMMERCE_CRON_SECRET_CONFIGURATION_REQUIRED`. Local email (Mailpit) and browser security E2E are QUALIFIED — see `commerce-foundation-phase2.md`.
