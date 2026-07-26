# Platform interaction / notification programme — delivery report

Status: Stages A–E complete. This report documents what shipped, the
security/DB impact, the checks run, and known limitations.

## 1. What changed, by stage

### Stage A — Buttons, dialogs, toasts (native dialogs replaced)
- All destructive/confirming admin flows route through the shared
  `appConfirm` dialog (`apps/admin/src/lib/app-dialogs.tsx`, a Radix
  `AlertDialog`) instead of `window.confirm` / `window.alert`.
- Toast feedback is centralized (`notify-toast`) instead of ad hoc `alert()`.

### Stage B — `@mccoy/notifications` package + durable delivery
- New package `@mccoy/notifications` owns the canonical notification
  **registry**: type, severity, category, recipient resolver, default
  channels, dedupe strategy, and (for active types) a strict Zod metadata
  schema. Nothing outside this package may invent a notification shape.
- Migration `supabase/migrations/20260725120000_platform_notifications.sql`
  adds `notifications`, `notification_recipients`, `notification_preferences`,
  and `notification_outbox`, all with RLS enabled and explicit per-operation
  policies (a user can only ever see/mutate their own recipient rows and
  their own preference rows).
- `packages/database/src/notifications/*` implements the durable
  outbox → worker → recipient-fanout pipeline (`outbox.ts`, `worker.ts`,
  `queries.ts`), so notification creation is decoupled from the triggering
  transaction (outbox pattern) and is safe to retry.

### Stage C — Website requests
- `website_requests` moved to Postgres as the source of truth; form
  submission enqueues a `website_request.received` outbox event fanned out
  to `active_staff`; email notification is unaffected (kept as a parallel,
  independent side effect, not a dependency of the in-app notification).
- The Aanvragen (admin requests) UI uses the shared `ConfirmationDialog`
  for destructive actions instead of a native dialog.

### Stage D — CMS publish failures, mailbox connection health
- `cms.publish_failed` (actor-only, error severity) and
  `mailbox.connection_failed` / `mailbox.connection_restored`
  (active-staff, warning/info) are wired into their respective hooks and
  enqueue through the same outbox path as Stage B/C.

### Stage E — Registry completeness, preferences UI, engine tests

**1. Future notification types confirmed present, without unfinished UI.**
`packages/notifications/src/registry.ts` already declares 10 inactive
placeholder types spanning the product roadmap:
`user.registered`, `user.approval_required`, `company.registered`,
`product.low_stock`, `product.out_of_stock`, `order.created`,
`order.cancelled`, `payment.completed`, `payment.failed`,
`invoice.created`, `invoice.overdue`. Each has `active: false`, a
`recipientResolver` in the `future_role_set` / `future_inventory_staff` /
`future_finance_staff` family, and a sensible default channel set — but
**no** metadata schema (`packages/notifications/src/metadata.ts` only
builds `ACTIVE_NOTIFICATION_METADATA_SCHEMAS` for `active: true` types) and
**no** admin product UI. `assertNotificationRegistryComplete()` guards that
every declared `NotificationType` has a matching registry row. The worker
(`resolveRecipientUserIds` in `packages/database/src/notifications/worker.ts`)
explicitly throws (caught and recorded as a failed outbox row, not a crash)
for any `future_*` resolver, so a future type can never silently deliver to
the wrong audience if it's accidentally enqueued today. This task required
no new code — it was verified against the existing implementation.

**2. Preferences UI shell in admin settings**, scoped to implemented types
only (`website_request.received`, `website_request.reply_failed`,
`cms.publish_failed`, `cms.publish_succeeded`, `mailbox.connection_failed`,
`mailbox.connection_restored`, `system.warning`):
- `packages/database/src/notifications/preferences.ts` (new):
  `listNotificationPreferencesForUser` returns one row per active type,
  merging any stored `notification_preferences` override over the
  registry's `defaultChannels` (rows are created lazily on first toggle,
  not proactively seeded). `setNotificationPreference` does a read-modify-write
  upsert scoped to `(user_id, notification_type)` so toggling one channel
  never clobbers the other, and it **rejects any inactive/unknown type**
  server-side — the client cannot toggle a placeholder domain that has no
  worker or metadata schema.
- `packages/validation/src/schemas.ts`: `notificationPreferenceUpdateSchema`
  restricts `type` to `ACTIVE_NOTIFICATION_TYPES` via `z.enum(...)` — a
  request naming a future/placeholder type fails validation before it
  reaches the database layer.
- `apps/admin/src/lib/api/notifications.functions.ts`: new server functions
  `listAdminNotificationPreferences` / `updateAdminNotificationPreference`,
  authorized the same way as the rest of the notification API
  (`requireNotifiableStaffSession`), never trusting a client-supplied user id.
- `apps/admin/src/routes/admin.settings.tsx`: new "Notificaties" settings
  card with one row per implemented type, each with independent in-app and
  browser-notification `Switch` toggles (Dutch copy, loading/error/disabled
  states, optimistic toggle with rollback on failure).

**3. Fixture unit/integration tests for the engine:**
- `packages/notifications/src/registry.test.ts` (pre-existing, still green):
  registry completeness, dedupe-key presence, active/inactive partitioning.
- `packages/database/src/notifications/notification-test-fixtures.ts` (new):
  a minimal fake Supabase query-builder (no live DB / network) that scripts
  per-table responses and records every call, used only by the tests below.
- `packages/database/src/notifications/worker.test.ts` (new, 6 tests):
  happy-path outbox → notification → recipient fan-out; deduplication via
  `dedupe_key`; a `future_*` resolver failing the outbox row instead of
  throwing out of the batch; strict metadata-allowlist rejection (unknown
  key `stackTrace`); zero-recipient handling; a simulated resolver DB error
  surfaced as a failed row rather than crashing the worker loop.
- `packages/database/src/notifications/preferences.test.ts` (new, 5 tests):
  default-channel fallback when no preference row exists; selective
  single-channel updates that don't disturb the other stored channel;
  rejection of inactive/unknown types.

## 2. Security impact

- **No new client-trusted inputs.** Preference updates are constrained to
  `(activeType, "in_app" | "browser", boolean)` via a `z.enum` schema;
  severity, category, recipient set, and dedupe key are always looked up
  server-side from the registry — never accepted from the client.
- **Authorization unchanged, verified.** Preference and notification list
  reads/writes resolve `userId` from the authenticated staff session
  (`requireNotifiableStaffSession`), never from a client-supplied id.
- **RLS unchanged from Stage B**, re-confirmed present in the migration:
  `notification_preferences` and `notification_recipients` policies scope
  every row to `auth.uid()`; no policy grants cross-user visibility.
- **Future notification types cannot leak.** Both the metadata-schema
  allowlist and the preferences validator reject anything outside
  `ACTIVE_NOTIFICATION_TYPES`, so a bug that names a placeholder type (e.g.
  `order.created`) fails closed (rejected/logged), not open.
- **Native dialogs**: confirmed the Stage A replacement is real, not just
  visual — see the new Playwright guard in section 3.

## 3. Database / migration impact

**No new migration was needed for Stage E.** The `notification_preferences`
table, its RLS policies, and its `(user_id, notification_type)` unique
constraint already existed from the Stage B migration
(`20260725120000_platform_notifications.sql`); Stage E only added an
application-layer read/write module and UI on top of it. No schema changes,
no backfills.

## 4. Tests run and results

All commands below were run in this session, from the repo root.

| Command | Result |
|---|---|
| `npm run typecheck -w @mccoy/notifications -w @mccoy/database -w @mccoy/validation` | ✅ pass, no errors |
| `npm run typecheck -w @mccoy/admin` | ✅ pass, no errors |
| `npm run typecheck -w @mccoy/storefront` | ✅ pass, no errors (not touched by Stage E; confirmed no regression) |
| `npm run build -w @mccoy/admin` | ✅ pass (client + SSR bundles built) |
| `npm run test -w @mccoy/notifications` (vitest) | ✅ 1 file, 8 tests passed (`registry.test.ts`) |
| `npm run test -w @mccoy/database` (vitest) | ✅ 12 files, 60 tests passed, including the 6 new `worker.test.ts` and 5 new `preferences.test.ts` cases |

A new Playwright spec was authored,
`e2e/notification-programme-verify.spec.ts`, which drives the CMS discard
flow (add a section → attempt discard) and asserts:
- a global `page.on("dialog", ...)` listener never fires (i.e. no native
  `window.confirm`/`alert` is used anywhere in the flow), and
- the destructive action instead surfaces a `role="alertdialog"` element
  (the custom `ConfirmationDialog`) with the expected Dutch copy, which
  must be explicitly confirmed before the draft is actually discarded.

**Known limitation — this spec could not be executed in this session.**
The Playwright suite's `webServer` config builds production bundles of
both the storefront and admin apps before any test runs (up to a 600s
timeout per app). In this sandboxed session that build reliably stalled —
once from a PowerShell stderr-as-terminating-error quirk when a `npm warn`
line was piped through `*>` redirection, and once with the whole process
tree silently exiting mid-build with no error surfaced. Both were
environment/tooling artifacts of this sandbox (no code under test was
implicated — the same admin `vite build` succeeded in ~15s when run
directly, and vitest/typecheck all passed cleanly). Recommended follow-up:
run `npx playwright test e2e/notification-programme-verify.spec.ts` in CI
or a normal local shell (or with `E2E_USE_DEV=1` once the vite `dev` code
path proves faster) to get a real pass/fail signal before merging.

## 5. Known limitations (by design or by scope)

- **No Web Push / native OS notifications.** "Browser" channel today means
  an in-app browser-tab notification (toast/badge) while the admin app is
  open; there is no Service Worker, no Push API subscription, and no
  delivery while the browser/tab is closed. Do not present this as "push
  notifications" to users.
- **No sound.** No audio cue is played on notification arrival.
- **"Closed-app" delivery is not claimed anywhere.** Delivery is
  in-app/Realtime only; if the admin isn't looking at the app, the
  notification waits in `notification_recipients` until they next open it.
- **No email channel wired to the preferences UI yet.** The database rows
  and registry already carry an `email` channel/`emailEnabled` field for
  future use, but the Stage E preferences UI intentionally exposes only
  `in_app` and `browser` — email notification delivery is out of scope for
  this programme.
- **Future notification types (`user.*`, `company.*`, `product.*`,
  `order.*`, `payment.*`, `invoice.*`) remain intentionally inert.** They
  exist only as registry placeholders (resolver + category), with no
  metadata schema, no worker wiring beyond the "reject cleanly" path, and
  no admin UI. They must not be enqueued until their owning domain
  (inventory, orders, payments, invoicing) is actually implemented.
- **No dual-write path remains** for website request notifications — the
  outbox → worker → recipient pipeline is the single path; the existing
  email notification for the same event is an independent, non-blocking
  side effect (email failure cannot roll back or duplicate the in-app
  notification, per the outbox/background-job pattern in the engineering
  rules).
- **E2E coverage gap**: the new destructive-confirm-dialog guard spec is
  authored but unexecuted in this session (see §4). Existing
  `e2e/forms-aanvragen.spec.ts` does exercise the Stage C form-submit →
  admin-request-appears path with fixtures, which partially covers the
  requested "form submit → notification path" scenario, but does not by
  itself assert in-app notification delivery end-to-end (Supabase is
  deliberately stripped from the E2E server env, so live notification rows
  are not part of that flow either).
