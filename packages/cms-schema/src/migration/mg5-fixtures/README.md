# MG5 offline fixture cohort

Builtin page payloads for `npm run cms:migrate-fixed-blocks -- --dry-run --environment test --fixture-dir packages/cms-schema/src/migration/mg5-fixtures`.

- Read-only persistence (CLI refuses apply against this directory).
- Covers dual-read family pages: home, about, products, offerte, privacy.
- Regenerate via `scripts/mg5-write-fixtures.mts` when seed shapes change.
