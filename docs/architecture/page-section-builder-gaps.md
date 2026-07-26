# Page-section builder — remaining gaps

Status after conversion-block production delivery (2026-07).

## Delivered

- Edit canvas vs Preview pane naming; per-section Live preview removed; section summaries only.
- `StructuredLinkField` with one Pagina picker (grouped builtin + custom) + externe / e-mail / tel / geen.
- `pageBlockPolicies` for `page_vacatures.jobs` (`minInstances: 1`, `maxInstances: 1`, `removable: false`).
- Jobs block dataVersion 2, normalize/migrate, featured sort + badge, vacancy reorder/duplicate.
- Application form submits `vacancyId` + `vacancyTitleSnapshot`; server validates against published jobs block.
- Publish UI: Opslaan & publiceren / Wijzigingen verwerpen / **Concept opslaan** (soft draft via `adminSaveCmsDraft` → `CmsStore.saveDraft`; no publish validation).
- Atomic publish path: client `savePage` validates then durable publish; server `adminPublishCmsPage` validates-all-then-write via `validatePublishableCmsPage` before upsert/publish.
- **Editor framework**: `BlockEditorDefinition` with `EditorQuality` (`dedicated` | `typed-composed` | `unsupported`), `supportedPaths`, registry helpers.
- Typed editors for all **publishable** block types, including conversion blocks.
- **Conversion blocks (publishable)**:
  - `newsletter` — typed editor; storefront signup; server `kind: "newsletter"` → website request + staff email; rate-limited; consent when configured.
  - `contactForm` — typed editor; reuses inquiry / Aanvragen pipeline; recipient is server `FORM_TO_EMAIL` (legacy `recipient` ignored).
  - `popup` — typed-composed title/body/CTA editor; dismissible modal; sessionStorage per block id; prefers-reduced-motion via `motion-safe:` classes.
- Spacer sizes `xs|sm|md|lg|xl` with normalize from legacy tokens/pixels.
- `fullImage.link?`, video title + `resolveSafeVideoEmbed`, before/after both images + optional labels.
- Form page chrome renders optional `content.image` on the storefront (parity with `FormPageChromeView`).
- Vacature detail route: `/vacatures/$slug` (slug from vacancy or title slugify).
- Legacy vacancy fallback gated behind `MCCOY_ALLOW_LEGACY_VACANCY_FALLBACK=1` (or `VITE_…`); default seeds use `ensureVacaturesJobsBlock`.
- Vacatures jobs **listing** starts hidden on the public page (v3 migration); vacancy data still powers the solliciteer form and detail routes. Admins can unhide the section in the page builder if they want the card list.
- Contact page fixed sections: `contact.main` (intro), `contact.info` (info cards), `contact.form` (inquiry form — **required**, hideable only).
- Offerte page fixed sections: `offerte.main` (intro), `offerte.info` (info cards), `offerte.form` (quote forms — **required**, hideable only).

## latestPosts / portfolio

Catalog documents these as **manual card editors**. Keep editing items in page JSON via the typed inspectors.

**Do not invent a posts CMS feed** — no automatic blog/portfolio data source in this phase.

## Legacy vacancy fallback — removal checklist

Fallback to `t.jobs.roles` runs only when **no** jobs block exists on `page_vacatures` **and** `MCCOY_ALLOW_LEGACY_VACANCY_FALLBACK` is enabled (see `allowLegacyVacancyFallback` / `warnLegacyVacancyFallback`).

Remove the helper and env gate when all are true:

1. Every environment (local, staging, production) has a seeded/migrated jobs block on vacatures.
2. One production publish cycle completed with exactly-one jobs policy enforced.
3. Form submissions use vacancy ids successfully in production.

Then delete:

- `warnLegacyVacancyFallback`, `allowLegacyVacancyFallback`, and call sites
- any comments referencing temporary fallback

**Status:** in-repo defaults seed jobs via `ensureVacaturesJobsBlock`; production/staging still need the env gate until checklist item 2–3 are confirmed.

## Known limitations (still out of scope)

- Fixed storefront sections (About/Services/Products) already prefer CMS `sectionContent` when present — not rebuilt in this pass.
- Dedicated `blockViewRegistry` currently registers `jobs` only; newsletter/contactForm/popup render via `RegisteredBlockView` switch (+ form adapters context).
- Localization repair is out of scope; vacancy IDs are preserved so future translation matching can work.
- No CMS-driven posts or portfolio feed — manual cards only.
- Soft-draft hydrate-on-reload from server draft is not wired end-to-end (concept is durable; editor still primarily local until publish).

## Validation codes

Publish block errors return `{ code, path, message? }` from `validatePageBlocksForPublish`. Admin maps codes → NL. Pipeline attaches the same codes onto `ValidateIssue`.

New conversion codes: `NEWSLETTER_*`, `CONTACT_FORM_*`, `POPUP_TITLE_REQUIRED`.

## Tests run

See package scripts: `@mccoy/cms-schema`, `@mccoy/cms-editor`, `@mccoy/cms-renderer`, plus typecheck on schema/editor/admin/storefront.
