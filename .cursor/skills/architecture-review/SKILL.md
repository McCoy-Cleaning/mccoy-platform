---
name: architecture-review
description: >-
  Report-only McCoy architecture review for package boundaries, CMS ownership,
  server/browser leaks, and circular dependencies. Use when running R8
  architecture-review, qualifying refactors, or checking storefront/admin/CMS
  import direction.
disable-model-invocation: true
---

# Architecture review (report-only)

## PURPOSE

Detect package-boundary, CMS ownership, and layering defects with evidence.

## SCOPE

`apps/storefront`, `apps/admin`, `packages/cms-*`, `packages/domain`, `packages/ui`, related docs under `docs/refactoring/`.

## INPUTS

- `docs/refactoring/frontend-component-architecture.md`
- `docs/refactoring/frontend-component-audit.md`
- R5–R7 / M5 / MG5 closeouts when relevant
- Deterministic runner: `npm run review:r8 -- --review architecture`

## OUT OF SCOPE

Redesign, LOC shaming, MR legacy retirement, MG5 apply, silent rewrites.

## REQUIRED EVIDENCE

Concrete import paths, command output, or contract-test failures. No invented lines.

## REVIEW PROCEDURE

1. Read architecture docs (A–F layers).
2. Check expected direction:
   - storefront → cms-renderer → cms-schema → domain
   - admin → cms-editor → cms-renderer → cms-schema
3. Flag prohibited imports: storefront→cms-editor/admin; renderer→cms-editor/storefront; schema→React apps/storefront; cms-editor→apps/admin.
4. Check circular deps, barrel cycles, server/browser leaks, duplicate canonical implementations, mega-module responsibility mixes.
5. CMS: RegisteredBlockView orchestration-only; shared renderer; explicit fixed compatibility; R6 one store; drafts not second server truth.
6. Emit findings per [finding-contract.md](../_shared/finding-contract.md).
7. Write `docs/reviews/r8-architecture-review.md` when this is an R8 run.

## SEVERITY RULES

- blocker/high: dependency violation or dual source of truth affecting publish/authz
- medium: ownership confusion without active violation
- low/info: size/organization suggestions

Do not fail on mere file size.

## FALSE-POSITIVE RULES

Allowed app router cycles documented in Guardian. Presentation dual-read adapters retained until MR are not architecture failures.

## OUTPUT FORMAT

Use the common finding contract. Dedupe on `ruleId+path+symbol`.

## NO-AUTO-FIX POLICY

Report only. Do not rewrite imports or move modules unless the user explicitly requests remediation.

## EXAMPLES

- Finding: storefront imports `@mccoy/cms-editor` → severity high, ruleId `arch.forbid.storefront-cms-editor`
- Non-finding: large `PageLayoutRenderer` that only orchestrates fixed vs block
