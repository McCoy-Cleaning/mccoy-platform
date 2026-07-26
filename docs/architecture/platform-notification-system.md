# Platform notification system

Durable, multi-recipient, Realtime-capable notifications for McCoy Admin (customers later).

## Separation of concerns

| State | Meaning |
|-------|---------|
| Domain | Order pending, request new, etc. |
| Workflow | Staff has / has not processed |
| Provider | Graph/IMAP unread |
| Notification | This user has not opened the in-app notice |
| Delivery | Browser/email channel emitted |

Do **not** use notification read state to mutate domain workflow.

## Tables (public + RLS)

- `notifications` — type, category, severity, entity ref, safe title/body, destination_path, metadata, dedupe_key
- `notification_recipients` — per-user seen/read/opened/dismissed + channel timestamps (**no shared is_read**)
- `notification_preferences` — per user + type channel toggles
- `notification_outbox` — transactional event queue (service-role only)

Writes: service role only. Clients update only own recipient state fields.

## Allowlisted types (registry)

Active now / Stage C–D:

- `website_request.received`
- `website_request.reply_failed`
- `cms.publish_failed`
- `mailbox.connection_failed`
- `mailbox.connection_restored`
- `system.warning`

Registered for future domains (no unfinished UI): users, companies, products, orders, payments, invoices.

## Flow

```text
Domain action (tx)
  → domain row
  → notification_outbox (dedupe_key unique)
Worker
  → validate type + metadata
  → resolve recipients (server)
  → insert notification + recipient rows
Realtime INSERT on notification_recipients
  → NotificationService refresh/merge
  → toast (if appropriate) + badge + centre
```

First integrated event: **`website_request.received`** from form submit (own backend), not Graph mail arrival. Graph/IMAP may emit `mail.received:{internetMessageId}` only when not correlatable to an existing WR.

## Recipients (today)

Resolver `active_staff`: all `public.users` with account_kind=staff, status=active, staff_role in (super_admin, admin).

Future resolvers: role sets, company users — registered but unused until domains exist.

## Frontend

- Single `NotificationService` (loadInitial, refresh, markRead, markAllRead, dismiss, open, subscribe).
- Realtime on `notification_recipients` for `user_id=eq.{auth.uid}`; **always refetch on reconnect / visibility**.
- Notification centre (bell) in admin shell.
- Aanvragen badge = unread notifications category `requests` (not Graph unread count).
- Browser notifications: opt-in; only when tab hidden; BroadcastChannel so one tab emits.

## Dedupe keys

- `website_request.received:{requestId}`
- `mail.received:{internetMessageId}`
- `cms.publish_failed:{pageId}:{attemptId}`
- Future: `order.created:{orderId}`, etc.

## Privacy

Metadata schemas are allowlists. No message bodies, tokens, full addresses, or order line dumps in notifications or toasts. destination_path allowlisted internal routes only.

## Non-goals (this programme)

- Web Push / closed-app delivery
- Notification sounds
- Inventing product/order admin UIs
