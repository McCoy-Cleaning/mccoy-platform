# CMS WYSIWYG editor architecture note

## Goal

The page editor must be the **same website renderer** with an editing interaction layer on top — not a second representation of the page.

## Existing flow (before / retained)

```
Admin `/website/$pageId`
  → SplitToolbar + DeviceFrame iframe
  → storefront `?_cmsMode=edit&_cmsPage=`
  → LiveEditDraftProvider (postMessage bridge)
  → PageLayoutRenderer (fixed + RegisteredBlockView)
  → optional Secties drawer (BuiltinLayoutEditor) via Geavanceerd
```

Canonical pixels: storefront `PageLayoutRenderer` → fixed section views / `RegisteredBlockView`.
Parent remains draft source of truth via `cms-edit-draft` revisions.

## WYSIWYG interaction layer

| Concern | Implementation |
|--------|----------------|
| Section hover/select + ↑↓ duplicate hide delete | `WysiwygSectionChrome` in storefront (absolute overlays) |
| Insert between sections | `SectionInsertGap` → `cms-ui-command` `openAddPicker` → admin `TemplatePicker` |
| Inline text (NL + EN locale-safe) | `WysiwygInlineText` → `section`/`block`/`enField` mutations |
| Media replace | `WysiwygMediaFrame` → `openMediaPicker` → admin `CanvasMediaPicker` (same Storage pipeline) |
| Button / link | `WysiwygButtonEditor` popover on real CTAs |
| Form fields | `WysiwygFormFieldChrome` + add-field (custom fields only; builtins preserved) |
| Advanced settings | `openAdvanced` opens Secties as overlay (not persistent dock) |
| Preview | `cms-editor-mode` `preview` hides chrome; draft sync continues |
| Layout mutations from canvas | Extended `CmsMutation` layout ops applied in `edit-bridge` |

## Must not change

- `RegisteredBlockView` / block view registry contracts
- Form submission backend / field IDs
- NL/EN draft storage (`enFieldDrafts`)
- Publish / concept / discard semantics
- Fixed↔block migration / MG5
- SEO Safe Mode (no cms-renderer forks for SEO)

## Coverage status

- **E1–E2, E7:** full-width canvas, section chrome, insert picker, preview toggle, advanced overlay
- **E3–E6 (MVP):** home.hero text/media/buttons; contact.form text + fields; offerte.form heading; media picker wired
- **E8:** Secties is secondary (`Geavanceerd` FAB); ordinary edits stay on canvas. Drawer remains for rare/advanced options
- **E9.1 (done):** authoritative `BLOCK_WYSIWYG_CAPABILITIES` for all 36 `BlockType`s (`canvas` + `advancedOnly`, mutually exclusive). CI invariants: exactly one entry per type, schema-path existence, no duplicates, spacer canvas empty. See `packages/cms-schema/src/blocks/wysiwyg-capabilities.ts`
- **E9.2 (done):** `CmsEditSurface` + `EditableText` / `EditableMedia` / `EditableCta` (true no-op without provider); `CmsBlockEditScope` inside `RegisteredBlockView` (public props unchanged); storefront `StorefrontCmsEditSurface` in edit stack; dotted block paths merge without wiping siblings
- **E9.3 P0/P1 (done):** canvas wiring on hero, richText, centered, cta, textImage, featureGrid, contactForm, quoteRequestForm (chrome copy); gallery title, video, beforeAfter, announcement, columns. Remaining P2/repeater item edits + gallery featured/mosaic paths stay classified (chrome + Geavanceerd)
- **E10 (accepted):** Preview/Edit visual parity (`e2e/cms-wysiwyg-parity.spec.ts`, maxDiffPixelRatio ≤ 0.02)
- **E11 (accepted):** ephemeral draft undo/redo (`editor-history` + edit-bridge; `e2e/cms-wysiwyg-history.spec.ts`)
- **E12 (this phase):** Offerte `quoteRequestForm` contract audit + safe presentation editing. See `docs/architecture/cms-offerte-form-contract.md`. Frozen `payloadKey`; canvas label/placeholder; tab tag/title/description; kinds/keys/required/reorder locked.
