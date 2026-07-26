# Provider strategy — email / Aanvragen (Phase 16)

## Standard E2E (CI + local default)

| Concern | Strategy |
|---------|----------|
| Form submit | **Real** `submitWebsiteForm` → `sendWebsiteFormEmail` → JSON `website-requests` store |
| SMTP notification | Optional; persistence succeeds without SMTP (`notificationState: failed` if unset) |
| Admin Aanvragen list/detail | **Deterministic adapter** when `MCCOY_E2E=1`: maps JSON requests → FormInbox contracts (`e2e:website-requests:{id}`) |
| Admin reply | `MCCOY_E2E=1` short-circuits send (no Graph/SMTP); returns success |
| CMS publish / preview / public render | **Never mocked** |

Env for standard suite (set by `playwright.config.ts` webServers + globalSetup):

- `MCCOY_E2E=1`
- `ADMIN_LEGACY_AUTH=true`
- Isolated `MCCOY_DATA_DIR` / `E2E_MCCOY_DATA_DIR`
- Supabase vars cleared for legacy auth

## Contract tests (unit / package)

- `@mccoy/email` inbox id encode/decode (imap / graph / e2e)
- Form subject classification, scope markers
- Filter/facet helpers

Run: `npm run test:unit:email`

## Real-provider integration (opt-in, not CI default)

Requires secrets (never commit):

- **Microsoft 365 (recommended for McCoy):** Graph — `TENANT_ID` / `CLIENT_ID`|`APPLICATION_ID` / `CLIENT_SECRET` + `GRAPH_MAILBOX`, with `FORM_INBOX_PROVIDER=graph` (or `auto`). Application permissions `Mail.Read` (+ `Mail.Send` if sending via Graph) + admin consent + mailbox access policy.
- **Gmail App Password style:** IMAP — `FORM_INBOX_*` / `SMTP_*`, with `FORM_INBOX_PROVIDER=imap`
- Do **not** use `FORM_INBOX_PROVIDER=imap` against `outlook.office365.com` — M365 blocks IMAP basic auth (fail-fast). SMTP outbound can still use `SMTP_*` separately.

Suggested invocation (manual / protected workflow only):

```bash
# Do NOT set MCCOY_E2E — exercise live mailbox
E2E_REAL_INBOX=1 npm run test:e2e -- e2e/providers/real-inbox.integration.spec.ts
```

`e2e/providers/real-inbox.integration.spec.ts` should `test.skip(!process.env.E2E_REAL_INBOX)` and never run against production mailboxes.

## Limits

- E2E adapter does not store attachment binaries; attachment download tests stay Graph/IMAP-only.
- Reply threading against a real mailbox is out of standard suite scope.
- Do not enable `MCCOY_E2E` in staging/production hosts.
