# Aanvragen performance & delete repair

**Date:** 2026-08-06  
**Scope:** Admin → Aanvragen (`/admin/inquiries`) only

## Verified root causes

| Symptom | Cause |
|---------|--------|
| Visible list flash / blank on refresh | `loadList` sets `listState` to `"loading"`; `InquiriesList` replaces rows with `InlineLoader` whenever `listState === "loading"`, even when `items` still hold data |
| Full panel refresh after delete | `applyListDeleteSuccess` / detail `onDeleted` always call `void loadList()`, re-entering the loading UI path |
| Slow list load | Graph list pages up to `LIST_MAX_PAGES` (4×50) before filtering; often more pages than needed for `limit` |
| Slow / unreliable multi-delete | Bulk delete loops `deleteFormInboxMessage` sequentially; each Graph delete first calls `getGraphFormInboxMessage` (full body + headers) — N+1 expensive GETs |
| No Graph `$batch` | Bulk path never used JSON batching; one HTTP delete (plus confirm GET) per ID |
| Stale refresh can restore deleted rows | Post-delete `loadList` / concurrent Vernieuwen can finish after optimistic removal with a pre-delete snapshot and `setItems(result.items)` restores deleted IDs |
| Partial failures awkward | Server returns `deletedIds` + `failures`, but UI still refetches; no tombstones; no deterministic restore-only-failed |

## Design after repair

- **initialLoading** vs **refreshing** — spinner only when no successful items yet; refresh keeps rows + shows “Vernieuwen…”
- **Optimistic delete** with snapshot + per-ID Graph results; **no** full list reload on success
- **deletionTombstones** + **requestGeneration** — stale list responses cannot restore deleted IDs
- **Graph `$batch`** (chunks of 20) for Graph IDs; IMAP/request IDs remain sequential
- List Graph `$select` unchanged (already list fields only); stop paging early once enough form candidates collected
- Detail load unchanged (body only on open); detail delete uses optimistic path without `loadList`

## Deterministic active-detail rule after delete

If `activeId` is among deleted IDs → close detail (`selectedId = null`). Do not auto-select a neighbour (avoids surprise navigation).

## List request (before → after)

**Before**

- `$select`: id, subject, bodyPreview, receivedDateTime, isRead, hasAttachments, internetMessageId, conversationId, from, replyTo, toRecipients (no HTML body — already correct)
- Up to 4 pages × 50 messages, always exhausted unless end of mailbox
- Single Graph delete: full `getGraphFormInboxMessage` (body) before move/delete
- Bulk: sequential single deletes (N Graph round-trips + N body GETs)

**After**

- Same list `$select` (list-view fields only)
- Early-stop paging when enough form candidates for `limit` (`stopWhen` in `listRecentMessages`)
- `InboxLoadMetrics`: `graphRequestCount`, `returnedItemCount`, `listDurationMs`, `detailRequestCount: 0` on list
- Single Graph delete: `assertGraphFormInboxMessageDeletable` (lightweight `$select`, no body)
- Bulk Graph: `$batch` move→Deleted Items (fallback DELETE batch), `GRAPH_BATCH_SIZE = 20`, per-subresponse mapping, bounded retry on 429/503/504

## State model (admin)

```text
items / selectedIds / activeId (selectedId)
initialLoading | refreshing | listState
deletingIds
listError (non-destructive when items exist) | listDeleteError | listDeleteStatus
requestGeneration + deletionTombstones
lastSuccessfulLoadAt
```

Optimistic helpers: `beginOptimisticDelete`, `rollbackDeleteFailures`, `filterTombstonedItems`, `pruneTombstonesAfterRefresh`.

## Per-ID delete contract

Server `bulkDeleteAdminFormInboxMessages` / `bulkDeleteFormInboxMessages` always return `results[]` with `deleted | already_absent | failed` for every unique requested ID.

## Remaining limitations

- IMAP bulk delete remains sequential (no IMAP batch API)
- Manual Graph acceptance against a non-prod mailbox must be run by operators (see Phase 14 checklist below)
- `adminInboxBulkDeleteSchema` max remains 50 IDs per request
- Measured wall-clock Graph timings require a seeded non-prod mailbox (not fabricated here)

## Delete semantics (2026-08-06 repair)

Aanvragen delete is **request-authoritative**:

1. `req:` / `e2e:` → set `website_requests.status = closed`, best-effort Graph copy removal
2. `graph:` → close correlated website request (mail_messages / root id / WR- from subject), then mailbox move/delete
3. List merge suppresses mailbox rows whose WR- number is closed or spam (`hiddenRequestNumbers`)
4. Graph mailbox permission failures after a successful request close still count as deleted for Aanvragen UI

Without (3), Vernieuwen resurrected leftover Graph form copies as new `graph:` rows after a successful `req:` close — which felt like “delete does nothing”.

## Phase 14 — Manual Graph acceptance (operator)

Use a non-production Microsoft 365 mailbox with ≥30 test messages:

1. Initial list appears without loading every body
2. Delete 1 → only that row goes; no panel remount/refetch flash
3. Delete 3 → all three removed
4. Delete >20 → all processed across multiple batches
5. Simulate one failed subrequest → only failed row returns + honest error
6. Refresh during/after delete → deleted IDs do not reappear
7. Full page reload → successful deletes stay gone
8. Graph/IMAP config errors still surface correctly

## Recommended next Stage 3 extraction

Extract `InquiryInboxStore` (list + tombstones + optimistic delete) behind a thin feature boundary once CMS Stage 3 work starts — do **not** fold this into cms-editor/registry/storefront in the same slice.
