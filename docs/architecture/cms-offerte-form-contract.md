# CMS Offerte form contract (E12)

## Principle

```
VISIBLE PRESENTATION  →  WYSIWYG editable (A/B)
INTERNAL BUSINESS CONTRACT  →  locked (C/D/E)
```

Offerte is a **system form**, not an arbitrary form builder.

## Forms discovered

| Form / tab | Backend `FormKind` | Purpose |
|------------|--------------------|---------|
| Glasbewassing tab | `glass_washing` | Window/facade quote → Aanvragen + email |
| Meubelreiniging tab | `furniture_cleaning` | Furniture/floor quote → Aanvragen + email |

Block type: `quoteRequestForm` (MG5 migrated from fixed `offerte.form`).

There are **no** dedicated backend field kinds such as `window_count`. Fields use the shared `FormFieldType` union (`phone`, `company`, `text`, `select`, `file`, `textarea`, …). The **tab.kind** is the privileged discriminator for routing/validation.

Built-in contact identity fields (`name`, `email`) are injected at render/submit via `resolveContactFormFields` and are never stored as editable custom rows for those types.

## Submission identity

Payload keys come from `formFieldPayloadKey(field)`.

**E12 invariant:** editable labels must not change submission keys.

Mechanism: optional `FormFieldItem.payloadKey` (frozen). `formFieldPayloadKey` prefers `payloadKey` after reserved type/id mappings. Quote seed fields ship with stable ids + explicit `payloadKey`s. Normalize freezes missing keys from the *current* derivation so existing published content keeps its keys until a draft rewrite persists them.

## A–E classification matrix

### Block chrome (`quoteRequestForm`)

| Path | Category | Allowed WYSIWYG | Forbidden |
|------|----------|-----------------|-----------|
| `heading` | A | edit text | — |
| `description` | A | edit text | — |
| `submitLabel` | A | edit text | change submit destination |
| `successMessage` | A | edit text | — |
| `defaultTabId` | E | Geavanceerd only | canvas |
| `tabs` structure | D/E | — | add/remove tabs on canvas; rewrite kinds |
| `enabledScopes` / `defaultScope` | E | legacy only | any canvas edit |

### Per tab

| Path | Category | Allowed | Forbidden |
|------|----------|---------|-----------|
| `tabs[i].id` | D | — | change / regenerate |
| `tabs[i].kind` | D | — | canvas change (`glass_washing` ↔ `furniture_cleaning`) |
| `tabs[i].tag` | A | edit | — |
| `tabs[i].title` | A | edit | — |
| `tabs[i].description` | A | edit | — |
| `tabs[i].icon` | E | Geavanceerd | canvas |
| `tabs[i].submitLabel` | A | edit (Geavanceerd / future canvas) | — |
| `tabs[i].successMessage` | A | edit | — |
| `tabs[i].scope` | D | — | any mutation of routing scope |
| `tabs[i].fields` order | E | locked on canvas | reorder until proven presentation-only |
| Tab add/remove | E | Geavanceerd (operator) | canvas builder UX |

### Glass tab fields (seed / typical)

| Stable id | Default label | Type | Submission key | Cat | Canvas allow | Forbidden |
|-----------|---------------|------|----------------|-----|--------------|-----------|
| `quote-glass-phone` | Telefoon | phone | `phone` | C+D | label, placeholder | type, id, key, delete |
| `quote-glass-company` | Bedrijfsnaam | company | `company` | C+D | label, placeholder | type, id, key, delete |
| `quote-glass-floors` | Aantal verdiepingen | text | `aantal_verdiepingen` | C+D | label, placeholder | type, id, key, delete |
| `quote-glass-windows` | Aantal ramen (indicatie) | text | `aantal_ramen_indicatie` | C+D | label, placeholder | type, id, key, delete |
| `quote-glass-height` | Hoogste raam (meter) | text | `hoogste_raam_meter` | C+D | label, placeholder | type, id, key, delete |
| `quote-glass-access` | Bereikbaarheid | select | `bereikbaarheid` | C+D | label | type, id, key, options values*, delete |
| `quote-glass-inside-out` | Binnen, buiten of beide? | select | `binnen_buiten_of_beide` | C+D | label | type, id, key, option values*, delete |
| `quote-glass-frequency` | Frequentie | select | `frequentie` | C+D | label | type, id, key, option values*, delete |
| `quote-glass-photos` | Foto's… | file | `photos` | C+D | label, placeholder | type, id, key, delete |
| `quote-glass-message` | Uw bericht | textarea | `message` | C+D | label, placeholder | type, id, key, delete |
| builtin name/email | Naam / E-mail | name/email | `name`/`email` | C+D | label via shared builtins only | delete, type |

\*Option **labels** may be presentation; option **values** participate in payloads → treat value edits as E/Geavanceerd unless separately audited.

### Furniture tab fields (seed / typical)

| Stable id | Default label | Type | Submission key | Cat | Canvas allow | Forbidden |
|-----------|---------------|------|----------------|-----|--------------|-----------|
| `quote-furniture-phone` | Telefoon | phone | `phone` | C+D | label, placeholder | type, id, key, delete |
| `quote-furniture-company` | Bedrijfsnaam | company | `company` | C+D | label, placeholder | type, id, key, delete |
| `quote-furniture-type` | Type meubel / vloer | select | `type_meubel_vloer` | C+D | label | type, id, key, option values*, delete |
| `quote-furniture-count` | Aantal stuks | text | `aantal_stuks` | C+D | label, placeholder | type, id, key, delete |
| `quote-furniture-material` | Materiaal / stof… | text | `materiaal_stof_indien_bekend` | C+D | label, placeholder | type, id, key, delete |
| `quote-furniture-area` | Oppervlakte (m²) | text | `oppervlakte_m` | C+D | label, placeholder | type, id, key, delete |
| `quote-furniture-photos` | Foto's… | file | `photos` | C+D | label, placeholder | type, id, key, delete |
| `quote-furniture-notes` | Bijzondere vlekken… | textarea | `bijzondere_vlekken_of_geuren` | C+D | label, placeholder | type, id, key, delete |

### Intentionally locked (E12)

- Conditional builders / formula editors
- Changing `tab.kind` on canvas
- Deleting system fields on canvas
- Required toggle for system fields on canvas
- Field reorder on canvas
- Generic “replace type with Text/Email/…” picker for quote system fields
- Backend endpoints / mailbox / Aanvragen routing

## Localization

- NL presentation lives on field/tab strings in block data.
- EN uses existing `enFieldDrafts` paths (`block:{id}:tabs.{i}.tag|title|description`, etc.).
- Field-label EN remains Geavanceerd / en-field where already wired; canvas E12 focuses on NL presentation + frozen keys.
- Undo/redo (E11) applies via normal block mutations; locale identity preserved.

## History (E11)

Presentation patches go through `CmsMutation` → history as `FORM_FIELD_UPDATED` / `TEXT_UPDATED` / `CONTENT_UPDATED`. No history for open/close popover or selection.

## Renderer

Canonical: `QuoteRequestFormSectionView` only (+ edit surface chrome). No OfferteEditorForm duplicate.

## Gate

`E12_AUDIT_COMPLETE` — classification matrix above is authoritative.

Safe WYSIWYG shipped: labels, placeholders (non-select), tab tag/title/description, block heading/description/submit/success.

Locked: kinds, payloadKeys, required, reorder, delete of system fields, option values, conditions, formulas.
