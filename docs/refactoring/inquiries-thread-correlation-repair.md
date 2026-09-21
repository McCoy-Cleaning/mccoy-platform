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
5. Exact request number in subject/body plus the request's exact submitter address → `appended`
6. Else → do **not** create a second form inquiry from a reply; leave as non-list mail (or future unmatched review)

The shared form subject never forces a merge. The request-number fallback requires
both a per-request number and the stored submitter address.

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
- The global routing scan covers the most recent 80 Inbox messages. Older
  unmatched mail is not backfilled automatically and remains available in the
  Microsoft 365 mailbox.
- **Mitigation (2026-08-06):** opening a `req:` Aanvraag runs `syncWebsiteRequestGraphThread`, which lists Graph messages for known conversation ids and appends inbound applicant mail into `website_request_mail_messages` (Gesprek). Also recovers conversation id from staff `resendId` / internetMessageId when mail rows lack Graph ids. Outbound persist uses `getGraphMailConfig().mailbox` so identity lookup matches ingest. Standalone Graph `sendMail` now resolves Sent Items identity.
- Notification event `inquiry.applicant_replied` is not registered yet (avoid inventing staff UX); unread uses request status/`last_message_at`.
- Full E2E Playwright journey for Graph threading requires a live mailbox.

## Cross-customer leak regression (2026-09-21)

### Symptom

Opening the Aanvraag of one customer showed another customer's inbound email
(their body, address and inline signature attachment) as a `KLANT` bubble in
Gesprek, and counted it as "Laatste bericht van klant".

### Confirmed cause

`messageBelongsToWebsiteRequest` accepted **subject overlap** as evidence:

- `website_requests.subject` is `FORM_SUBJECTS[kind]`
  (`packages/database/src/website-requests/supabase-store.ts`, `p_subject`), i.e.
  the *same* string — "Offerte meubelreiniging" — for every request of that kind.
- The detail-sync recent scan reads the whole mailbox via `/users/{mailbox}/messages`
  (`listRecentGraphSyncMessages`), which includes **Sent Items**. Every staff reply
  to any furniture request is therefore `from = info@mccoy.nl` (sender gate passes)
  with a subject repeating that shared string (subject gate passes).
- On a match the scan added the message's `conversationId` to the **same Set** it
  uses as `knownConversationIds`, so the rest of that foreign conversation —
  including the other customer's inbound reply — short-circuited the top-of-function
  conversation check and was persisted as `inbound` on the wrong request.
- The admin reply then picked "latest inbound Graph message" as the `createReply`
  parent, so the outgoing mail inherited the foreign message's quoted body and
  inline attachment and sent them to the wrong customer.

### Fix

| Area | Change |
|------|--------|
| Matching | `messageBelongsToWebsiteRequest` → `websiteRequestMailEvidence`, returning `conversation_id` / `known_message_id` / `request_number` or `null`. Subject overlap removed; `requestSubject` input deleted |
| Identity widening | Recent scan widens `conversationIds` only on per-request proof, never on a guessed conversation; thread identity now also tracks known RFC Message-IDs (mail rows + staff `resendId`) |
| Deny by default | Only request-specific proof may attach mail. Request-aware failures can be retained as metadata-only diagnostics; ordinary shared-mailbox mail is ignored by Aanvragen |
| Complete Inbox routing | The scan uses `/mailFolders/inbox/messages` and evaluates known provider identities or an exact WR number without treating unrelated mailbox mail as a request |
| Participant ownership | The stored submitter must be From/To, unless an alternate sender has a verified exact Graph parent belonging to the request |
| Legacy containment | Existing foreign Graph rows are hidden from the inquiry thread and cannot be used for attachment download or mailbox deletion; no historical row is destructively removed |
| Admin surface | The user-facing `Niet-gekoppeld` route, badge and global polling were removed; internal diagnostics are not a second mailbox |
| Reply parent | `replyAdminFormInboxMessage` only replies to an inbound message whose `sender_address` is this request's submitter, else the form-notification root |
| Attachment scoping | `findMailThreadItemIndex` no longer matches bubbles by body/timestamp lookalike; `getWebsiteRequestFormInboxAttachment` no longer searches other messages of the thread for a matching filename |
| Migrations | `20260921120000_website_request_unmatched_mail.sql` adds metadata-only diagnostics; `20260921122315_harden_website_request_mail_identity.sql` binds provider identity to one request and restricts the upsert RPC to `service_role` |

### Proposed data cleanup — NOT RUN

Detect (read-only): inbound `microsoft_graph` rows whose sender is neither the
request's submitter nor the mailbox, and which share a `conversation_id` with a
different request.

```sql
select m.request_id, r.number, m.id, m.sender_address, m.occurred_at, m.conversation_id
from public.website_request_mail_messages m
join public.website_requests r on r.id = m.request_id
where m.direction = 'inbound'
  and m.provider = 'microsoft_graph'
  and lower(coalesce(m.sender_address, '')) not in (lower(r.submitter_email), lower(m.mailbox))
order by m.occurred_at desc;
```

Proposed remediation, in order, after staff review of the detection output:

1. Export the detection rows for the record (privacy incident log).
2. Move each confirmed foreign row to `website_request_unmatched_mail` (metadata)
   and delete the `website_request_mail_messages` row — the mail itself stays in
   the mailbox, so no customer data is lost.
3. Clear `website_requests.graph_conversation_id` / `root_*` ids that were stamped
   from a foreign message, then recompute `last_message_at` from the remaining rows.
4. Re-open affected requests for staff follow-up where a reply was sent with
   inherited foreign content, and assess breach-notification duties with the
   client (legal decision, not an engineering one).

No destructive step is scripted here on purpose.

### Exposure boundary

The contaminated conversation is consumed only by the MFA-gated Admin
Aanvragen server functions. Storefront and customer-portal code do not read
`website_request_mail_messages`, so another customer cannot view the misplaced
message directly. The customer-facing risk is indirect: a staff member could
read it in the wrong inquiry or use the wrong Graph message as a reply parent.
The participant and reply-parent checks above close those paths.

## Older client-reply recovery and UI status (2026-09-21)

- Opening an Aanvraag first follows known Graph conversation ids, then performs
  a bounded `/messages` lookup for the exact submitter from the request creation
  timestamp. This recovers replies that are outside the shared mailbox's latest
  200-message window, including mail moved out of Inbox.
- A message returned by that query is still persisted only when it has
  request-specific evidence (`conversationId`, known RFC message id, or the exact
  WR number) and the submitter is a participant.
- The broad shared-mailbox scan is now a fallback for missing identity/provider
  failures instead of the normal path, reducing Graph latency and contamination
  exposure.
- The Admin Gesprek panel shows separate Klant/McCoy counts, explicit sync
  progress, a recoverable error, and a manual Bijwerken action. Background
  polling is de-duplicated so repeated nine-second refreshes cannot pile up.

## Verified alternate-sender replies (2026-09-21)

A real reply may come from an alias or forwarded mailbox instead of the address
entered on the form. Sender equality alone therefore cannot be the only valid
path, but a WR number alone remains too weak to attach mail safely.

An alternate sender is accepted only when Microsoft Graph proves all of the
following:

1. The inbound message has an exact `In-Reply-To` RFC Message-ID.
2. That parent exists in the configured McCoy mailbox and was sent by McCoy.
3. The parent was addressed to the form's stored submitter address.
4. Parent and reply share the same non-empty Graph `conversationId`.
5. Parent and reply both cite the exact request number.
6. The reply is addressed to the configured McCoy mailbox.

The trusted parent is persisted before the reply. The renderer repeats the RFC
parent + conversation + request-number proof before exposing the alternate-
sender row. A successfully linked row resolves any matching internal diagnostic
record.

Form-notification and staff-response messages can have different Graph
conversation ids. Staff reply RFC identities are therefore resolved even when a
form-root conversation already exists. The broad bounded scan runs when known
conversations produce no request-owned message; merely possessing a stale or
form-only conversation id no longer suppresses discovery.

## Final request-mail boundary (2026-09-21)

The shared mailbox is not an Aanvragen inbox. A live aggregate audit found 192
unresolved diagnostic rows: 191 contained no WR reference, while the only
WR-bearing row referred to a deleted request. None represented an active request
reply stranded outside Aanvragen.

The final routing contract is therefore:

1. Exact stored Graph/RFC identity or unique conversation identity is preferred.
2. If bounded identity history has no hit, an exact WR number may locate the
   request only when the stored submitter participates in the message.
3. An alternate sender requires the independently verified Graph parent proof
   documented above.
4. Closed requests reopen atomically on a new verified inbound message.
5. Deleted/spam requests never receive a new mail row and are never reopened.
6. Mail without request evidence remains in Outlook and is ignored by Aanvragen.
7. Provider identities are database-bound to one request; an attempted reuse for
   another request returns a conflict without updating either thread.

The internal diagnostic table remains metadata-only and service-role-written for
incident analysis. It is not a second mailbox, is not exposed in admin navigation,
and stores neither message bodies nor attachment bytes.
