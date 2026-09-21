# Aanvragen cross-customer contamination — scope measurement

**Date:** 2026-09-21
**Type:** Read-only forensic scoping. No data was read, modified, or exported by this document.
**Status:** **BLOCKED — no numbers produced.** Supabase access was denied by a local hook (see
"Access blocked" below). This document contains the schema-verified detection queries so an
operator with database access can produce the figures.

---

## Access blocked

Both tool paths needed to reach the database were unavailable in this session:

| Attempt | Result |
|---|---|
| `plugin-supabase-supabase` → `list_projects` | `Permission denied: MCP tool execution was blocked by a hook: unknown or unapproved MCP server 'supabase'` |
| `plugin-supabase-supabase` → `list_organizations` (re-check to confirm the block is server-level, not tool-level) | same message |
| Shell (`git`, any command) | `Terminal unavailable: this machine cannot enforce the 'workspace_readwrite' sandbox policy` — so `psql` / `supabase` CLI were also unavailable |

Consequences:

- The correct Supabase project was **not identified** (`list_projects` / `get_project` never ran).
- The live schema was **not confirmed** (`list_tables` never ran). Every column name below comes
  from the migrations in `supabase/migrations/`, not from the running database.
- **No count in this report is measured.** All quantities are TODO.

No workaround was attempted, per instruction.

### Before running anything

1. Confirm the project is the McCoy **production** project (`list_projects` → `get_project`).
2. Confirm `public.website_request_mail_messages` exists and has the columns used below
   (`list_tables --verbose`, or `Q0`). Migration `20260806160000_website_request_mail_messages.sql`
   and `20260819200000_website_request_mail_message_attachments.sql` must both be applied;
   if `attachments` is missing, skip `Q8`.
3. Run everything as read-only (`set transaction read only;` or a read-only role). Every query
   below is a bare `select` — no DDL, no DML.

---

## Schema the detection relies on (verified against migrations)

`public.website_requests` — `id`, `number` (`WR-YYYY-NNNNN`), `kind`
(`inquiry|glass_washing|furniture_cleaning|job_application|newsletter`), `status`,
`inquiry_status`, `submitter_email` (defaults to `''`, not null), `subject`
(per-kind constant — the field the buggy matcher trusted), `created_at`, `last_replied_at`,
`root_internet_message_id`, `root_graph_message_id`, `graph_conversation_id`, `last_message_at`.

`public.website_request_mail_messages` — `id`, `request_id`, `direction` (`inbound|outbound`),
`provider` (`microsoft_graph|imap|website_form|smtp`), `mailbox` (stored lower-cased by the
upsert RPC), `graph_message_id`, `internet_message_id`, `conversation_id`, `in_reply_to`,
`references_header`, `sender_address`, `recipient_addresses text[]`, `subject`, `body_text`,
`occurred_at`, `is_read`, `attachments jsonb` (array of Graph file metadata).

`public.website_request_replies` — `id`, `request_id`, `sent_at`, `sent_by`, `to_email`,
`provider_message_id` (RFC Message-ID of the staff reply; app type calls it `resendId`).

`public.website_request_unmatched_mail` — post-fix deny-by-default landing table
(`20260921120000`). Useful as a control, not as incident evidence.

### Definition of a "foreign" message

A mail row attached to request `R` is **foreign** when its `sender_address` is neither
`R.submitter_email` nor a McCoy address (the row's own `mailbox`, or any `@mccoy.nl` sender —
`noreply@`, `info@`, whatever `FORM_FROM_EMAIL` / `GRAPH_MAILBOX` resolve to in production).
Every query below builds that set in a `own_addresses` CTE so the domain list can be corrected
in one place if production uses a second sending domain.

Note the contamination has **two shapes**, and only the first is in the brief:

1. **Foreign inbound** — another customer's own reply persisted as `direction = 'inbound'`
   on the wrong request. This is what staff saw as a `KLANT` bubble.
2. **Foreign outbound** — a staff Sent-Items reply addressed to a *different* customer,
   persisted as `direction = 'outbound'` on this request (`classifyGraphThreadDirection`
   returns `admin` for any `info@mccoy.nl` sender). Its quoted body contains the other
   customer's message, so it is equally a disclosure to whoever viewed the request.
   `Q3b` measures it; do not omit it from the incident log.

---

## Detection queries

### Q0 — schema presence / applied-migration check

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'website_requests',
    'website_request_mail_messages',
    'website_request_replies',
    'website_request_unmatched_mail'
  )
order by table_name, ordinal_position;
```

### Q1 — denominators

```sql
select
  (select count(*) from public.website_requests) as total_requests,
  (select count(distinct request_id) from public.website_request_mail_messages)
    as requests_with_mail_rows,
  (select count(*) from public.website_request_mail_messages) as mail_rows_total,
  (select count(*) from public.website_request_mail_messages where direction = 'inbound')
    as mail_rows_inbound,
  (select count(*) from public.website_request_mail_messages where direction = 'outbound')
    as mail_rows_outbound,
  (select count(*) from public.website_requests where graph_conversation_id is not null)
    as requests_with_conversation_id;
```

### Q2 — reusable foreign-message view (all later queries reference this shape)

```sql
with own_addresses as (
  select array['info@mccoy.nl', 'noreply@mccoy.nl']::text[] as addrs
),
foreign_mail as (
  select
    m.id            as mail_id,
    m.request_id,
    r.number        as request_number,
    r.kind,
    r.created_at    as request_created_at,
    m.direction,
    m.provider,
    m.conversation_id,
    m.graph_message_id,
    m.internet_message_id,
    lower(m.sender_address)          as sender_lower,
    lower(nullif(r.submitter_email, '')) as submitter_lower,
    m.occurred_at,
    coalesce(jsonb_array_length(m.attachments), 0) as attachment_count
  from public.website_request_mail_messages m
  join public.website_requests r on r.id = m.request_id
  cross join own_addresses o
  where m.direction = 'inbound'
    and coalesce(m.sender_address, '') <> ''
    and lower(m.sender_address) is distinct from lower(nullif(r.submitter_email, ''))
    and lower(m.sender_address) <> lower(m.mailbox)
    and lower(m.sender_address) <> all (o.addrs)
    and lower(m.sender_address) not like '%@mccoy.nl'
)
select
  count(*)                                   as foreign_inbound_rows,
  count(distinct request_id)                 as contaminated_requests,
  count(distinct coalesce(internet_message_id, graph_message_id, mail_id::text))
                                             as distinct_foreign_messages,
  count(distinct sender_lower)               as distinct_foreign_senders,
  count(distinct submitter_lower)            as distinct_recipients_shown_foreign_content,
  count(*) filter (where attachment_count > 0) as foreign_rows_with_attachments,
  min(occurred_at)                           as first_foreign_message_at,
  max(occurred_at)                           as last_foreign_message_at
from foreign_mail;
```

> `distinct_foreign_senders` is the count of *whose* content leaked; `distinct_recipients_shown_foreign_content`
> is the count of customers whose Aanvraag displayed someone else's mail. Both are address-level
> counts, so one person using two addresses inflates them slightly.

### Q3a — contaminated requests by form kind and month

```sql
with own_addresses as (select array['info@mccoy.nl', 'noreply@mccoy.nl']::text[] as addrs),
foreign_mail as (
  select m.request_id, r.kind, m.occurred_at
  from public.website_request_mail_messages m
  join public.website_requests r on r.id = m.request_id
  cross join own_addresses o
  where m.direction = 'inbound'
    and coalesce(m.sender_address, '') <> ''
    and lower(m.sender_address) is distinct from lower(nullif(r.submitter_email, ''))
    and lower(m.sender_address) <> lower(m.mailbox)
    and lower(m.sender_address) <> all (o.addrs)
    and lower(m.sender_address) not like '%@mccoy.nl'
)
select
  kind,
  date_trunc('month', occurred_at) as month,
  count(distinct request_id)       as contaminated_requests,
  count(*)                         as foreign_rows
from foreign_mail
group by rollup (kind, date_trunc('month', occurred_at))
order by kind nulls last, month nulls last;
```

### Q3b — second contamination shape: staff replies to a *different* customer stored on this request

```sql
select
  count(*)                   as foreign_outbound_rows,
  count(distinct m.request_id) as requests_with_foreign_outbound
from public.website_request_mail_messages m
join public.website_requests r on r.id = m.request_id
where m.direction = 'outbound'
  and nullif(r.submitter_email, '') is not null
  and not exists (
    select 1
    from unnest(m.recipient_addresses) as addr
    where lower(addr) = lower(r.submitter_email)
  )
  and array_length(m.recipient_addresses, 1) > 0;
```

### Q4 — poisoned thread identity: conversation ids shared by more than one request

```sql
-- 4a: conversation ids on mail rows spanning multiple requests
select
  count(*)                     as shared_conversation_ids,
  sum(request_count)           as request_rows_involved,
  max(request_count)           as max_requests_on_one_conversation
from (
  select conversation_id, count(distinct request_id) as request_count
  from public.website_request_mail_messages
  where coalesce(conversation_id, '') <> ''
  group by conversation_id
  having count(distinct request_id) > 1
) s;

-- 4b: the same at request level (the id stamped onto website_requests)
select
  count(*) as shared_request_conversation_ids
from (
  select graph_conversation_id
  from public.website_requests
  where coalesce(graph_conversation_id, '') <> ''
  group by graph_conversation_id
  having count(*) > 1
) s;

-- 4c: duplicated root ids (a foreign message became a request's "root")
select 'root_graph_message_id' as column_name, count(*) as duplicated_values from (
  select root_graph_message_id from public.website_requests
  where coalesce(root_graph_message_id, '') <> ''
  group by root_graph_message_id having count(*) > 1) a
union all
select 'root_internet_message_id', count(*) from (
  select root_internet_message_id from public.website_requests
  where coalesce(root_internet_message_id, '') <> ''
  group by root_internet_message_id having count(*) > 1) b;
```

### Q5 — ONWARD DISCLOSURE (the GDPR-relevant subset)

A staff reply carried another customer's content outward only if **all** of these hold:

1. the reply went out through Graph `createReply` (`provider = 'microsoft_graph'`), because only
   that path inherits the parent's quoted body and inline attachments — an SMTP/`sendMail`
   reply composes a fresh body and does **not** inherit;
2. it was addressed to *this* request's submitter (so a third party received it);
3. a foreign inbound row on the same request existed **before** it and shares its
   `conversation_id` — `createReply` keeps the parent's conversation, so an outbound row sitting
   in a foreign conversation is the fingerprint of a foreign reply parent.

```sql
with own_addresses as (select array['info@mccoy.nl', 'noreply@mccoy.nl']::text[] as addrs),
foreign_inbound as (
  select m.id, m.request_id, m.conversation_id, m.occurred_at,
         coalesce(jsonb_array_length(m.attachments), 0) as attachment_count
  from public.website_request_mail_messages m
  join public.website_requests r on r.id = m.request_id
  cross join own_addresses o
  where m.direction = 'inbound'
    and coalesce(m.sender_address, '') <> ''
    and lower(m.sender_address) is distinct from lower(nullif(r.submitter_email, ''))
    and lower(m.sender_address) <> lower(m.mailbox)
    and lower(m.sender_address) <> all (o.addrs)
    and lower(m.sender_address) not like '%@mccoy.nl'
),
sent_replies as (
  select m.id, m.request_id, r.number as request_number, r.kind,
         m.conversation_id, m.occurred_at, m.internet_message_id
  from public.website_request_mail_messages m
  join public.website_requests r on r.id = m.request_id
  where m.direction = 'outbound'
    and m.provider = 'microsoft_graph'
    and nullif(r.submitter_email, '') is not null
    and exists (
      select 1 from unnest(m.recipient_addresses) as addr
      where lower(addr) = lower(r.submitter_email)
    )
)
select
  s.request_number,
  s.kind,
  s.id                        as outbound_mail_id,
  s.occurred_at               as reply_sent_at,
  count(f.id)                 as foreign_parents_in_same_conversation,
  max(f.attachment_count)     as max_foreign_attachment_count,
  exists (
    select 1 from public.website_request_replies w
    where w.request_id = s.request_id
      and w.provider_message_id is not null
      and lower(w.provider_message_id) = lower(s.internet_message_id)
  )                           as confirmed_staff_reply_row
from sent_replies s
join foreign_inbound f
  on f.request_id = s.request_id
 and coalesce(f.conversation_id, '') <> ''
 and f.conversation_id = s.conversation_id
 and f.occurred_at < s.occurred_at
group by s.request_number, s.kind, s.id, s.occurred_at, s.request_id, s.internet_message_id
order by s.occurred_at desc;
```

Headline number for the breach decision:

```sql
-- wrap Q5 as `onward` and count
select count(*) as onward_disclosure_replies,
       count(distinct request_number) as affected_requests
from ( /* Q5 body */ ) onward;
```

### Q6 — weaker onward-disclosure signal (use only if Q5 returns nothing)

If `conversation_id` was not captured on outbound rows (the pre-fix `sendMail` path often
returned no identity), fall back to ordering alone: a Graph reply sent on a request *after* a
foreign inbound row arrived, where that foreign row was the latest inbound row at send time —
which is exactly the parent the pre-fix code picked.

```sql
with own_addresses as (select array['info@mccoy.nl', 'noreply@mccoy.nl']::text[] as addrs),
inbound as (
  select m.id, m.request_id, m.occurred_at,
         (lower(m.sender_address) is distinct from lower(nullif(r.submitter_email, ''))
          and lower(m.sender_address) <> lower(m.mailbox)
          and lower(m.sender_address) not like '%@mccoy.nl') as is_foreign
  from public.website_request_mail_messages m
  join public.website_requests r on r.id = m.request_id
  cross join own_addresses o
  where m.direction = 'inbound'
    and coalesce(m.sender_address, '') <> ''
    and coalesce(m.graph_message_id, '') <> ''
),
outbound as (
  select m.id, m.request_id, r.number as request_number, m.occurred_at
  from public.website_request_mail_messages m
  join public.website_requests r on r.id = m.request_id
  where m.direction = 'outbound' and m.provider = 'microsoft_graph'
)
select o.request_number, o.id as outbound_mail_id, o.occurred_at
from outbound o
join lateral (
  select i.is_foreign
  from inbound i
  where i.request_id = o.request_id and i.occurred_at < o.occurred_at
  order by i.occurred_at desc
  limit 1
) latest on true
where latest.is_foreign
order by o.occurred_at desc;
```

### Q7 — control: post-fix deny-by-default queue

```sql
select reason, count(*) as rows, min(received_at) as first_seen, max(received_at) as last_seen
from public.website_request_unmatched_mail
group by reason;
```

### Q8 — attachment exposure (skip if the `attachments` column is absent)

```sql
with own_addresses as (select array['info@mccoy.nl', 'noreply@mccoy.nl']::text[] as addrs)
select
  count(*) filter (where jsonb_array_length(m.attachments) > 0) as foreign_rows_with_attachments,
  sum(jsonb_array_length(m.attachments))                        as foreign_attachment_items
from public.website_request_mail_messages m
join public.website_requests r on r.id = m.request_id
cross join own_addresses o
where m.direction = 'inbound'
  and coalesce(m.sender_address, '') <> ''
  and lower(m.sender_address) is distinct from lower(nullif(r.submitter_email, ''))
  and lower(m.sender_address) <> lower(m.mailbox)
  and lower(m.sender_address) <> all (o.addrs)
  and lower(m.sender_address) not like '%@mccoy.nl';
```

---

## Results table — to be filled by the operator

| # | Figure | Query | Value | Confidence |
|---|---|---|---|---|
| 1 | Total website requests | Q1 | TODO | High — direct count |
| 2 | Requests with any mail rows | Q1 | TODO | High |
| 3 | Contaminated requests (≥1 foreign inbound) | Q2 | TODO | Medium-high — see caveats 1–3 |
| 4 | …by form kind / month | Q3a | TODO | Same as 3 |
| 5 | Requests with foreign *outbound* rows | Q3b | TODO | Medium — see caveat 4 |
| 6 | Distinct foreign messages | Q2 | TODO | High once the row set is agreed |
| 7 | Customers whose content was exposed | Q2 | TODO | Medium — address-level proxy |
| 8 | Customers shown foreign content | Q2 | TODO | Medium — address-level proxy |
| 9 | Conversation ids on >1 request | Q4a/4b | TODO | High |
| 10 | **Onward-disclosure replies sent** | Q5 | TODO | **Medium — see caveat 5** |
| 11 | Foreign rows carrying attachments | Q8 | TODO | High |
| 12 | Incident window (first/last foreign row) | Q2 | TODO | Medium — `occurred_at` is mail time, not ingest time |

---

## Caveats — what this data cannot tell you

1. **`submitter_email` may be empty.** The column defaults to `''` (e.g. newsletter submissions).
   Rows on such requests are excluded by `nullif(...)`, so contamination on them is invisible to
   Q2. Count them first: `select count(*) from public.website_requests where submitter_email = '';`
2. **One customer, several addresses.** A customer legitimately replying from a personal address
   instead of the form address will be scored as foreign — a false positive. Conversely, two
   different customers sharing a company mailbox can hide a real leak. Both are expected to be
   small but must be hand-checked before any figure goes into a breach notification.
3. **Mailbox is the source of truth, the database is not.** `website_request_mail_messages` only
   holds mail the sync actually persisted. Foreign mail that was displayed transiently in the
   inbox list, or was cleaned up, or arrived while sync was failing, leaves no row. **Q2 is a
   lower bound on exposure, never an upper bound.**
4. **Q3b is noisy by construction.** Staff legitimately CC/BCC colleagues, and the pre-fix reply
   path did not always populate `recipient_addresses`. Treat it as a review queue, not a count.
5. **Onward disclosure is inferred, not recorded.** Nothing in the schema stores *which* Graph
   message was used as the `createReply` parent: the outbound row's `in_reply_to` is set from
   `message.messageId` of the list row the staff member opened, not from the parent the code
   actually chose (`apps/admin/src/lib/api/admin-requests.functions.ts`, the reply handler).
   Q5 therefore infers the parent from the inherited `conversation_id`. It is right when the
   Sent-Items identity was resolved and stored, and blind when it was not — the doc's own
   "Remaining limitations" note that standalone `sendMail` identity resolution was added late.
   **Confirm every Q5 hit against the actual Sent Items message in the mailbox before treating it
   as a disclosure.** The sent message's quoted body is the only authoritative evidence.
6. **Timestamps are mail timestamps.** `occurred_at` is Graph `receivedDateTime`, so the window
   in row 12 is when the mail existed, not when the bug attached it. The attach time is closer to
   `created_at` on the mail row — report both.
7. **Deletes cascade.** `website_request_mail_messages.request_id` is `on delete cascade`; any
   request deleted since the bug took its evidence with it.

## Handling rules for whoever runs this

- Run read-only. No `insert`/`update`/`delete`/`alter`, no migration, no branch, no cleanup —
  the remediation plan in `docs/refactoring/inquiries-thread-correlation-repair.md` is explicitly
  not authorised to run yet.
- Export results to the privacy incident log only. Identify records by `number`
  (`WR-YYYY-NNNNN`) and row `id`; do not copy `body_text`, `sender_address`, `submitter_email`,
  or attachment bytes into tickets, chat, or this document.
- Q5 output drives a legal decision (breach notification). Escalate it with the mailbox
  verification attached, not on the SQL alone.
