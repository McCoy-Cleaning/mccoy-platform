# Platform interaction & notification audit

Audit date: 2026-07-25  
Scope: Admin + storefront monorepo before implementing the platform interaction and durable notification foundation.

## Applications

| Surface | Path | Role |
|---------|------|------|
| Admin | `apps/admin` | CMS, Aanvragen, settings, staff Auth/MFA |
| Storefront | `apps/storefront` | Public CMS, NL/EN, forms |
| Packages | `packages/*` | Domain, database, email, security, UI |

## Auth and roles

- `public.users`: `account_kind` staff|customer; `staff_role` super_admin|admin only.
- Gate: `requireAdminSession()` — active staff + aal2; service-role DB access.
- Helpers: `private.current_user_is_active_staff()`, `private.current_user_is_super_admin()`.
- No company membership / finer staff roles yet.

## Persistence

| Domain | Storage | Notes |
|--------|---------|-------|
| CMS | Postgres `cms_*` + `cms_outbox` | Atomic publish outbox |
| Staff | `public.users`, `private.staff_invitations`, `private.audit_logs` | |
| Website requests | **JSON file** `.data/website-requests.json` | No Postgres table |
| Aanvragen list | Graph / IMAP / E2E adapter | Mailbox-first |
| Platform notifications | **None** | Greenfield |

Form submit cannot atomically create a durable in-app notification until website requests are in Postgres.

## Existing outbox / Realtime

- Only `public.cms_outbox` (CMS publish); processed inline via `processCmsOutbox`.
- No Supabase Realtime channels in admin or packages.

## UI primitives (reusable)

Located under `apps/admin/src/components/ui/`:

- `button.tsx` — variants default/destructive/outline/secondary/ghost/link; **no loading**
- `dialog.tsx`, `alert-dialog.tsx`, `badge.tsx`, `tooltip.tsx`
- `sonner.tsx` — **defined, not mounted**, no `toast()` call sites

Aanvragen (`admin.inquiries.tsx`) uses raw `<button>` elements and a double-click reply confirm (not `window.confirm`).

## Native browser dialog inventory (admin)

| File | Usage | Replacement target |
|------|-------|--------------------|
| `cms/PageEditor.tsx` | `confirm` delete section | DestructiveConfirmationDialog |
| `cms/ExtraBlocksEditor.tsx` | `confirm` delete section | DestructiveConfirmationDialog |
| `cms/BuiltinLayoutEditor.tsx` | `confirm` remove; `alert` errors | Dialog + toast |
| `cms/LocalePublishPanel.tsx` | `confirm` rollback | ConfirmationDialog |
| `cms/NavigationEditor.tsx` | `confirm` discard | ConfirmationDialog |
| `cms/InlineEdit.tsx` | `alert` upload fail | toast error |
| `routes/admin.website.$pageId.tsx` | many alert/confirm save/publish/leave | toast + ConfirmationDialog |
| `routes/admin.website.index.tsx` | confirm/alert delete page | DestructiveConfirmationDialog + toast |
| `routes/admin.website.media.tsx` | `prompt` archive/hard-delete reason | FormDialog |
| `routes/admin.settings.tsx` | `confirm` remove staff | DestructiveConfirmationDialog |
| `lib/cms/edit-context.tsx` | `alert` prepared reason | toast |
| `lib/cms/store.ts` | `alert` write fail | toast / callback |

## Event sources today

| Source | Mechanism | Durable in-app? |
|--------|-----------|-----------------|
| Form submit | JSON + SMTP | No |
| Aanvragen open | Graph/IMAP mark-read | No |
| CMS publish | cms_outbox stub | No |

## Limitations / risks

1. JSON website requests block transactional outbox.
2. Staff roles too coarse for future recipient resolvers (sales/inventory).
3. Realtime is net-new infrastructure.
4. Do not confuse `WebsiteRequest.notificationState` (SMTP) with in-app notifications.
5. Graph unread ≠ notification unread — keep separate.

## Recommended next steps

See `platform-interaction-system.md` and `platform-notification-system.md`.
