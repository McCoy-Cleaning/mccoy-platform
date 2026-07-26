---
inclusion: always
---

# McCoy architecture rules

These rules apply whenever creating, moving, importing, or changing application
code, shared packages, database access, business models, server integrations,
or frontend components.

Before implementing a significant feature, inspect:

- the existing package that owns the capability;
- package exports;
- browser/server boundaries;
- database migrations and RLS;
- existing shared contracts;
- `docs/architecture/package-boundaries.md`.

Do not create a new package merely because a future feature is mentioned in the
roadmap. Create it when implementation begins and the capability has a clear,
independent responsibility.

## Architecture model

McCoy uses:

1. Deployable applications under `apps/`.
2. Cross-cutting platform packages under `packages/`.
3. Business-capability packages under `packages/`.
4. Supabase for Auth, Postgres, Storage, RLS, and trusted Edge Functions.
5. Explicit browser-safe and server-only package entry points.

Prefer business-capability boundaries over large technical-layer packages.

## Deployable applications

Expected applications include:

```text
apps/
├── storefront
└── admin