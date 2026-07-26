# Platform interaction system

Design for buttons, dialogs, confirmations, and transient toasts across McCoy Admin (and later storefront where needed).

## Principles

- One design-system Button; no ad-hoc action chrome on feature pages.
- Native `alert` / `confirm` / `prompt` are forbidden in completed workflows.
- Toasts are transient feedback only — never the source of truth for durable events.
- One primary action per dialog surface; destructive uses destructive variant.
- Accessible by default: focus trap, restoration, `aria-*`, keyboard, ~44px targets where practical.

## Buttons

Extend `apps/admin/src/components/ui/button.tsx`:

| Variant | Maps to / meaning |
|---------|-------------------|
| `primary` | Alias of `default` — main CTA |
| `secondary` | Alias of `secondary` |
| `outline` | Secondary chrome |
| `ghost` | Low emphasis |
| `destructive` | Irreversible / delete |
| `link` | Textual |

Sizes: `sm` | `md` (alias of default) | `lg` | `icon`.

Props: `loading?: boolean`, `loadingLabel?: string` → `aria-busy`, disable activation, preserve width.

Icon-only buttons require accessible name (+ tooltip).

## Dialogs

Compose on existing Radix Dialog / AlertDialog:

| Component | Use |
|-----------|-----|
| `AppDialog` | General modal content |
| `ConfirmationDialog` | Non-destructive confirm |
| `DestructiveConfirmationDialog` | Delete / irreversible (`tone="destructive"`, optional `requireText`) |
| `FormDialog` | Replaces `prompt()` with labelled input |

Confirmation copy must name the object and consequence (never vague “Weet je het zeker?” alone).

## Toasts

- Mount Sonner once in admin shell.
- API: `notifyToast({ kind, title, description?, dedupeKey?, action? })`.
- Success auto-dismiss; errors linger or require dismiss.
- No full email bodies / tokens / PII dumps.

## Platform event bus (transient)

```ts
type PlatformEvent =
  | { type: "notification-received"; notificationId: string }
  | { type: "notification-read"; notificationId: string }
  | { type: "notification-refresh-failed"; errorCode: string }
  | { type: "notification-connection-restored" }
  | { type: "ui-toast"; kind: "success" | "info" | "warning" | "error"; title: string; description?: string; dedupeKey?: string };
```

Used only for UI effects. Durable state lives in Supabase (see notification system doc).

## UX states

- Initial load: skeletons.
- Background refresh: keep content; subtle status.
- Empty / error: Dutch copy + retry; never wipe loaded data on background failure.
- Offline: “Verbinding tijdelijk verbroken…”.

## Migration of native dialogs

See inventory in `platform-interaction-notification-audit.md`. Each call site maps to toast, ConfirmationDialog, DestructiveConfirmationDialog, or FormDialog.
