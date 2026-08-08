# R8 common finding contract

All McCoy review skills under `.cursor/skills/*-review/` MUST emit findings that match this contract. Skills are **report-only by default** — they inspect, cite evidence, and recommend; they do not rewrite production code unless the human explicitly asks for remediation.

## TypeScript shape (semantic)

```ts
type ReviewFinding = {
  id: string;
  ruleId: string;
  review:
    | "architecture"
    | "ui-ux"
    | "accessibility"
    | "seo"
    | "security"
    | "bug-risk"
    | "performance"
    | "platform";
  severity: "blocker" | "high" | "medium" | "low" | "info";
  confidence: "high" | "medium" | "low";
  package?: string;
  path: string;
  symbol?: string;
  lineStart?: number;
  lineEnd?: number;
  title: string;
  evidence: string[];
  impact: string;
  recommendation: string;
  verification?: string[];
  relatedFindings?: string[];
  status:
    | "open"
    | "fixed"
    | "accepted-risk"
    | "deferred"
    | "false-positive";
};
```

## Markdown / JSON

Findings may be written as Markdown sections or JSON arrays. Semantics must match the shape above.

### Required for blocker / high

- concrete `path`
- `symbol` or line evidence when available
- explanation of actual failure/risk (`impact`)
- reproduction/test evidence when applicable (`evidence`, `verification`)
- `recommendation`
- `confidence`

### Deduplication key

Collapse duplicates on:

`ruleId` + `path` + `symbol` (when present)

Cross-link related findings from other reviewers instead of inflating counts.

### Severity guide

| Severity | Use when |
|----------|----------|
| blocker | Protected invariant broken; production/security/data integrity fail |
| high | Concrete production/security/a11y/data risk without accepted rationale |
| medium | Material defect; invariant not broken |
| low | Quality improvement |
| info | Observation / operations hold / context |

Subjective design taste is never blocker/high.

### Status guide

| Status | Meaning |
|--------|---------|
| open | Unresolved |
| fixed | Remediated in R8 with verification |
| accepted-risk | Explicit rationale; not a silent ignore |
| deferred | Documented follow-up; not production-blocking |
| false-positive | Evidence shows no real defect |

### No-auto-fix policy

Skills MUST NOT:

- rewrite files
- move architecture
- install dependencies
- change APIs or schema
- modify persisted CMS content
- remove legacy fixed-section compatibility
- redesign UI

The R8 orchestrating phase may remediate verified blocker/high findings under the R8 remediation policy (deterministic bug, boundary violation, confirmed security/a11y/SEO defect, etc.).
