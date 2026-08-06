# Aanvragen thread correlation repair

**Date:** 2026-08-06  
**Scope:** Admin → Aanvragen reply delivery + inbound applicant reply correlation

## Verified root causes

### 1. Admin reply uses Graph `sendMail`, not a reply operation

`sendAdminReplyEmail` (`packages/email/src/send-reply.ts`) explicitly **avoids** `/messages/{id}/reply` and calls `sendGraphAdminReply` without `inReplyToGraphId`.

That path uses `POST .../sendMail`, which:

- starts a **new** Graph `conversationId` in practice (code comment in `admin-requests.functions.ts` already notes this);
- cannot set RFC `In-Reply-To` / `References` via Graph `internetMessageHeaders` (Graph only accepts `x-*` extension headers), so the applicant client often does not thread correctly;
- returns `{ ok: true }` without persisting Graph immutable ID / `internetMessageId` / `conversationId` of the Sent Items copy.

`sendGraphAdminReply` already supports `inReplyToGraphId` → `/messages/{id}/reply` with a `message` override (including `toRecipients`), but Aanvragen never passes it.

### 2. List identity is “mailbox message ≈ Aanvraag”, not “website request ≈ Aanvraag”

`listFormInboxMessages` merges Graph/IMAP form candidates with `website_requests` by WR- number. Each Graph message that passes `looksLikeFormCandidate` can become a list row (or replace the WR- keyed row).

Applicant replies are **not** appended as durable inbound messages on the request. Only staff outbound replies are stored in `website_request_replies`.

### 3. Reply/forward subject detection is narrower than classification stripping

| Helper | Prefixes |
|--------|----------|
| `isReplyOrForwardSubject` (list gate) | `re`, `fw`, `fwd` only |
| `stripReplyForwardPrefixes` (domain) | also `AW`, `WG` (Dutch/German Outlook) |

So subjects like `AW: Algemene aanvraag — … (WR-…)` pass the list gate.

### 4. Quoted form footer false-positive

`looksLikeFormCandidate` calls `isMcCoyWebsiteFormNotificationGraph`, which treats **body footer** (`Verstuurd via het McCoy websiteformulier`) as sufficient. Applicant replies commonly quote that footer in `bodyPreview`, so with an `AW:` subject they are classified as form candidates → **second list row** or WR-merge that **replaces** the original form notification with the reply message.

### 5. No durable thread index / ImmutableId preference

- No table of known `internetMessageId` / Graph IDs / `conversationId` per request for correlation.
- Graph requests do not send `Prefer: IdType="ImmutableId"`.
- Inbound correlation helper (`mail-received-correlation.ts`) only matches WR- number for notification dedupe — it does not append replies to the inquiry timeline.

### 6. Thread UI depends on Graph `conversationId`

`getGraphFormInboxThread` filters by `conversationId`. After `sendMail`, the admin reply and applicant reply live in a **different** conversation than the form notification, so the Gesprek panel on the original message stays empty / incomplete even when mail exists in the mailbox.

## Required behaviour after repair

1. One website form submission → one stable `website_requests` inquiry.
2. Admin reply uses Graph **reply** (createReply/send or `/reply` with recipient override) against the correct Graph message when a Graph id exists.
3. Outbound identity (immutable Graph id, internetMessageId, conversationId) is persisted.
4. Applicant replies are correlated (exact id → In-Reply-To/References → conversationId) and **appended** — never a new inquiry list row.
5. List row remains the inquiry; timeline shows form + admin + customer messages.
6. Repeated sync is idempotent.

## Matching hierarchy (incoming)

1. mailbox + Graph immutable id already known → `already_processed`
2. mailbox + internetMessageId already known → `already_processed`
3. In-Reply-To / References hit known ids for one inquiry → `appended`
4. mailbox + conversationId uniquely maps to one inquiry → `appended`
5. WR- number in subject/body as **supporting** evidence only with a strong id match (not alone for auto-merge of unrelated mail)
6. Else → do **not** create a second form inquiry from a reply; leave as non-list mail (or future unmatched review)

Sender + subject alone must never force a merge.

## Deterministic reply parent

Reply targets the **latest inbound** Graph message in the inquiry thread when known; otherwise the original form notification Graph message. Never an arbitrary first outbound-only id.

## Active-detail / list rules

- Inquiry list key = website request id when present; Graph message id only for mailbox-only orphans.
- Appending a reply updates the existing row (unread / last activity) without full inbox remount.
- Deleting a Graph message does not delete the website request unless the product already defines that (current delete closes request for `req:` ids; Graph delete moves mail only).

## Implementation status (2026-08-06)

### Done in this slice

| Area | Change |
|------|--------|
| Reply Graph path | `sendAdminReplyEmail` passes `inReplyToGraphId` → `createReply` → PATCH recipients/body → send; Sent Items identity resolved with bounded retry |
| List false positives | `isReplyOrForwardSubject` aligned with AW/WG; list candidates require McCoy **sender**, not quoted footer |
| Dedupe / merge | Prefer non-reply mailbox rows; prefer `req:` id as stable inquiry list key |
| Durable identity | Migration `20260806160000_website_request_mail_messages.sql` + RPC upsert; root Graph ids on `website_requests` |
| Correlation | Pure `correlateInboundGraphMessage` hierarchy + ingest during Graph list |
| Timeline | Request detail merges `website_request_replies` + mail_messages (customer/admin) |
| Repair | Dry-run report helpers (`inquiry-thread-repair.ts`) — no auto-destructive merge |
| ImmutableId | `Prefer: IdType="ImmutableId"` on Graph fetches |
| Module boundaries | `form-mail-subject` + `graph-inbox-sync` own side effects; `graph-mail` no longer imports ingest (breaks Guardian circular-deps finding) |

### Operator follow-ups

1. Apply migration `20260806160000_website_request_mail_messages.sql` to each environment.
2. Run Phase 14 real non-prod Graph acceptance (form → admin reply → applicant reply → one list row).
3. Review dry-run repair candidates before any historical merge.

### Remaining limitations

- IMAP-only still uses SMTP `In-Reply-To` (no createReply).
- List-time ingest of applicant replies still depends on reply-shaped subjects in the already-fetched Graph pages + known conversation/RFC ids.
- **Mitigation (2026-08-06):** opening a `req:` Aanvraag runs `syncWebsiteRequestGraphThread`, which lists Graph messages for known conversation ids and appends inbound applicant mail into `website_request_mail_messages` (Gesprek). Also recovers conversation id from staff `resendId` / internetMessageId when mail rows lack Graph ids. Outbound persist uses `getGraphMailConfig().mailbox` so identity lookup matches ingest. Standalone Graph `sendMail` now resolves Sent Items identity.
- Notification event `inquiry.applicant_replied` is not registered yet (avoid inventing staff UX); unread uses request status/`last_message_at`.
- Full E2E Playwright journey for Graph threading requires a live mailbox.
