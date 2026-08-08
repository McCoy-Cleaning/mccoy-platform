---
name: performance-review
description: >-
  Report-only McCoy performance review using measured build/chunk and request
  evidence for Admin, storefront, CMS preview, and Aanvragen. Use for R8
  performance-review — not speculative useMemo advice.
disable-model-invocation: true
---

# Performance review (report-only)

## PURPOSE

Identify measurable performance regressions and duplicate-request hotspots.

## SCOPE

Admin/storefront bundles; CMS preview messaging; Aanvragen list/detail; notifications Realtime/polling; public SSR cost where measurable.

## INPUTS

Build outputs; prior R7 bundle notes; `npm run review:r8 -- --review performance`; network evidence when available.

## OUT OF SCOPE

Generic “add useMemo everywhere”; lazy-loading everything without measurement; redesign.

## REQUIRED EVIDENCE

Chunk sizes, duplicate request traces, profiler notes, or comparable baseline deltas.

## REVIEW PROCEDURE

1. Record admin/storefront build chunk sizes and warnings.
2. Inspect duplicate/N+1 requests; oversized route chunks; unnecessary client-only rendering; preview message storms.
3. Unbounded listeners/timers; repeated localStorage writes; image sizing; Realtime reconnect storms.
4. Emit findings per [finding-contract.md](../_shared/finding-contract.md) → `docs/reviews/r8-performance-review.md`.

## SEVERITY RULES

- blocker/high: proven production-breaking perf or unbounded growth under normal use
- medium: measurable regression vs baseline
- low/info: optimization opportunities

## FALSE-POSITIVE RULES

Do not emit high severity for missing useMemo without evidence. Deferred home chunks that match intentional design are not regressions.

## OUTPUT FORMAT

Include measurement tables in the report; findings use the common contract.

## NO-AUTO-FIX POLICY

Report only by default.

## EXAMPLES

- Finding: CMS preview posts full document on every keystroke without debounce → medium/high with trace
- Non-finding: “wrap in useCallback” with no rerender evidence → ignore
