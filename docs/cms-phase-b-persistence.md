# Phase B — Published CMS persistence (design)

> Status: **implemented** (B1–B5). See also `docs/cms-i18n-runtime.md`.
> Schema foundation (Phase A) lives in `@mccoy/cms-schema` v6.
> Media library (Supabase Storage) lives in `docs/cms-media-storage.md`.

## Context

| Today | Target |
|-------|--------|
| `localStorage` key `mccoy_cms_v1` in admin + storefront `store.ts` | Server-readable Postgres (Supabase) |
| No `supabase/` migrations in repo | Versioned SQL under `supabase/migrations/` |
| `@mccoy/database` JSON adapter for website requests only | Extend with CMS repositories |
| CamelCase domain types | `snake_case` DB columns; map in repository layer |

### localStorage touch points (to remove in B5)

- `apps/admin/src/lib/cms/store.ts` — `read()` / `write()`
- `apps/storefront/src/lib/cms/store.ts` — duplicate
- Event: `mccoy-cms-change`
- Preview snapshots already session-only (keep out of DB or store separately as drafts)

---

## Site / tenant model

Single-site McCoy for v1; still include `site_id` for ownership constraints.

```text
cms_sites
  id uuid PK
  slug text unique          -- e.g. mccoy
  origin text               -- https://www.mccoy.nl
  config_version int        -- bumps invalidate caches
  created_at timestamptz
  updated_at timestamptz
```

---

## Core tables

### `cms_pages`

Stable page identity (not locale-specific).

```text
cms_pages
  id uuid PK
  site_id uuid NOT NULL REFERENCES cms_sites(id)
  stable_key text NULL      -- page_home, page_about, … for builtins
  kind text NOT NULL CHECK (kind IN ('builtin','custom'))
  page_key text NULL        -- BuiltinPageKey
  in_nav boolean NOT NULL DEFAULT false
  is_draft_only boolean NOT NULL DEFAULT false
  draft_revision_number int NOT NULL DEFAULT 1  -- optimistic concurrency
  active_published_revision_id uuid NULL REFERENCES cms_page_revisions(id)
  created_at timestamptz NOT NULL DEFAULT now()
  updated_at timestamptz NOT NULL DEFAULT now()
  UNIQUE (site_id, stable_key) WHERE stable_key IS NOT NULL
```

### `cms_page_revisions`

Immutable published snapshots + mutable drafts.

```text
cms_page_revisions
  id uuid PK
  site_id uuid NOT NULL REFERENCES cms_sites(id)
  page_id uuid NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE
  revision_number int NOT NULL
  status text NOT NULL CHECK (status IN ('draft','review','published','superseded','archived'))
  payload jsonb NOT NULL    -- full CmsPage snapshot (Localized bags, layout, blocks, sectionContent)
  created_at timestamptz NOT NULL DEFAULT now()
  created_by uuid NULL      -- admin user
  published_at timestamptz NULL
  UNIQUE (page_id, revision_number)
```

**Immutability:** trigger or RLS forbids UPDATE/DELETE when `status = 'published'` (or `superseded`). Only status transition draft→published / published→superseded via controlled RPC.

### `cms_page_locale_states`

Denormalized publication + freshness for queries (also inside payload).

```text
cms_page_locale_states
  page_id uuid NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE
  site_id uuid NOT NULL REFERENCES cms_sites(id)
  locale text NOT NULL CHECK (locale IN ('nl','en'))
  publication_state text NOT NULL
    CHECK (publication_state IN ('missing','draft','review','approved','published','archived'))
  freshness text NOT NULL
    CHECK (freshness IN ('current','stale','unknown'))
  path text NOT NULL        -- normalized path WITHOUT /en prefix for identity; public EN uses normalizeCmsPath
  public_path text NOT NULL -- stored normalized public path (/services or /en/services)
  PRIMARY KEY (page_id, locale)
  UNIQUE (site_id, locale, public_path)  -- one published path per locale — enforced with partial index:
```

**Partial unique index (published only):**

```sql
CREATE UNIQUE INDEX cms_page_locale_published_path_uq
  ON cms_page_locale_states (site_id, locale, public_path)
  WHERE publication_state = 'published';
```

### `cms_redirects`

```text
cms_redirects
  id uuid PK
  site_id uuid NOT NULL REFERENCES cms_sites(id)
  page_id uuid NULL REFERENCES cms_pages(id) ON DELETE SET NULL
  locale text NOT NULL CHECK (locale IN ('nl','en'))
  from_path text NOT NULL   -- normalized public path
  to_path text NOT NULL
  status_code int NOT NULL CHECK (status_code IN (301, 308))
  created_at timestamptz NOT NULL DEFAULT now()
  retired_at timestamptz NULL
  UNIQUE (site_id, locale, from_path)
  CHECK (from_path <> to_path)
```

### `cms_outbox` (publication events)

```text
cms_outbox
  id uuid PK                  -- event_id
  site_id uuid NOT NULL
  event_type text NOT NULL DEFAULT 'cms.page.published'
  payload jsonb NOT NULL      -- CmsPagePublishedEvent
  created_at timestamptz NOT NULL DEFAULT now()
  processed_at timestamptz NULL
  attempts int NOT NULL DEFAULT 0
```

`CmsPagePublishedEvent` shape (app):

```ts
{
  eventId: string;
  siteId: string;
  pageId: string;
  revisionId: string;
  publishedLocales: Locale[];
  changedPaths: string[];
  occurredAt: string;
}
```

**Atomic publish:** single transaction:

1. Insert/update draft revision → `published`
2. Mark previous published revision `superseded`
3. Set `cms_pages.active_published_revision_id`
4. Upsert `cms_page_locale_states`
5. Insert `cms_outbox` row
6. COMMIT

Consumers (async): invalidate page/meta/nav/sitemap/redirects/JSON-LD/search/recrawl caches.

---

## Optimistic concurrency

```ts
interface DraftUpdateCommand {
  pageId: string;
  expectedRevisionNumber: number; // cms_pages.draft_revision_number
  changes: CmsDraftChanges;
}
```

SQL pattern:

```sql
UPDATE cms_pages
SET draft_revision_number = draft_revision_number + 1, updated_at = now()
WHERE id = $pageId AND draft_revision_number = $expected
RETURNING draft_revision_number;
-- 0 rows → conflict (409)
```

---

## One active published revision

```sql
-- Enforced by active_published_revision_id FK + app RPC;
-- plus partial unique if storing flag on revisions:
CREATE UNIQUE INDEX cms_page_one_published_revision
  ON cms_page_revisions (page_id)
  WHERE status = 'published';
```

---

## Ownership

Every row carries `site_id`. CHECK/triggers ensure `cms_page_revisions.site_id = cms_pages.site_id`, same for locale_states and redirects.

---

## RLS (when Supabase Auth is wired)

- **Anon / public role:** SELECT only published revisions + published locale paths + active redirects (or expose via server-only service role in TanStack Start — prefer **service role in SSR**, no public table grants for CMS writes).
- **Admin:** write via service role after admin session check (existing admin cookie auth), not broad authenticated RLS until staff model exists.

Recommended for McCoy: **no direct browser→Postgres CMS access**; repositories run in server functions with service role.

---

## Cache keys (post B5)

`pageId + locale + publishedRevisionId + siteConfigVersion + seoBuilderVersion`

Invalidate on outbox `cms.page.published` — not time-only TTL.

---

## Migration strategy from localStorage

1. Export `mccoy_cms_v1` → `migrateAndValidate` (v6) in a one-shot admin tool.
2. Insert `cms_sites` row for McCoy.
3. For each page: insert `cms_pages` + draft revision + if currently “saved”, also publish NL (`publication_state=published`); EN remains `missing`.
4. Dual-read period optional: server prefers DB; fall back empty → not localStorage for public.
5. B5: remove `localStorage` writes from public/storefront path; admin editor talks to server fns only.

---

## Implementation order (next passes)

1. **B1** Create tables (SQL below stub)
2. **B2** Repositories in `@mccoy/database` + constraints
3. **B3** Publish / rollback / optimistic concurrency RPCs
4. **B4** Outbox insert in publish transaction + worker stub
5. **B5** Remove public localStorage dependence

---

## Compatibility with Phase A schema

`payload jsonb` stores the full v6 `CmsPage` including:

- `paths`, `localeContent`, `localeStates`, `translationMeta`, `redirects`
- legacy mirrors `slug` / `title` / `description`

Resolver (Phase C) maps DB row → `ResolvedPublishedCmsPage` using `getPublishedLocaleAlternates` from `@mccoy/cms-schema`.
