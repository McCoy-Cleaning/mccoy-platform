
## Goal

Replace the generic block-template editor with a real replica of each website page, add a side-by-side live preview, a Save/Discard flow, and virtual routes for custom pages created from the admin.

## What changes for the user

- Clicking a page in `/admin/website` shows an identical replica of that live page (Home = current Home, About = current About, etc.), not generic hero/feature blocks.
- The editor is a two-pane layout:
  - **Left**: the page rendered with subtle edit affordances — click any text to change it, hover any image to replace it, plus buttons to add/remove sections where the page supports it.
  - **Right**: a clean live preview updating in real time as changes are made, exactly as visitors will see it.
- A sticky action bar shows **Save**, **Discard**, and an unsaved-changes indicator. Nothing is applied to the live site until Save is pressed.
- On mobile/tablet the two panes stack (edit on top, preview below) with a toggle to switch focus.
- New pages: user picks a slug and starts from a blank canvas or a starter layout. On Save, the page is added to the CMS and a **virtual route** at that slug is created automatically — navigating to `/my-new-page` renders it on the live site, and it appears in the site navigation (respecting the "in nav" toggle).

## Technical approach

1. **Content model per real page.** For each existing route (`/`, `/about`, `/services`, `/products`, `/contact`, `/vacatures`), define a typed `content` object listing every editable field (headings, paragraphs, CTA labels, images, list items, section visibility). Refactor each route file to read from a single `usePageContent(pageId)` hook that returns saved overrides merged over defaults. Live pages therefore reflect saved edits automatically.
2. **Draft vs. saved state in the CMS store.** Extend `src/lib/cms/store.ts` so each page has `saved` and `draft` content buckets. Edits write to `draft`; Save promotes `draft → saved`; Discard clears `draft`. `usePageContent` returns `saved` on the public site and `draft` inside the editor preview.
3. **Editor shell.** Replace `PageEditor` with a split-pane layout:
   - Left pane renders the same page component wrapped in an `EditContext` provider that swaps text nodes for `InlineText` and images for `ImageEdit`.
   - Right pane renders the same page component with the `draft` content but no edit chrome (true preview).
   - Sticky top bar: page title, unsaved indicator, Save, Discard, Back.
4. **Section add/remove (where meaningful).** Pages that have a repeatable region (e.g. Services cards, Products categories, Vacatures list, Home feature grid) expose add/remove/reorder controls on those regions only. Fixed structural sections (hero, footer CTA) remain in place — this keeps every page an actual replica instead of a lego kit.
5. **Custom pages via a virtual catch-all route.** Add `src/routes/$customSlug.tsx` (splat/catch-all) that looks up the slug in the CMS custom pages list; if found, renders using a small set of starter section templates (hero, rich text, feature grid, CTA) picked when the page was created; otherwise falls through to the 404. The editor for a custom page uses the same split-pane shell. Nav in `__root.tsx` reads `usePagesInNav()` so new pages appear automatically.
6. **Save semantics for new pages.** Creating a new page only stores it in `draft` state and does not add it to nav until the user hits Save on the editor. Cancel before saving discards it entirely.
7. **Mobile/tablet layout.** Below `lg`, the two panes stack with a segmented "Edit / Preview" toggle at the top instead of side-by-side.

## Out of scope for this pass

- Writing real `.tsx` route files at runtime (not possible client-side). Custom pages use the virtual catch-all route above; behavior is identical from the visitor's perspective.
- Rich-text formatting toolbar (bold/italic/links). Text edits stay plain-text for now; can be layered on later.
- SEO/i18n automation beyond the existing per-page title + meta description already in the settings panel.

## Files touched (high level)

- `src/lib/cms/store.ts`, `src/lib/cms/types.ts` — draft/saved buckets, per-real-page content model.
- New `src/lib/cms/content-defaults.ts` — the canonical content of each existing page.
- New `src/lib/cms/EditContext.tsx` + `usePageContent` hook.
- Refactor `src/routes/index.tsx`, `about.tsx`, `services.tsx`, `products.tsx`, `contact.tsx`, `vacatures.tsx` to read from `usePageContent` — no visual changes on the public site.
- New `src/routes/$customSlug.tsx` — virtual routing for custom pages.
- Rewrite `src/components/admin/cms/PageEditor.tsx` into a split-pane editor with Save/Discard.
- Update `src/routes/__root.tsx` header/footer nav to include custom pages marked `inNav`.
- `src/components/admin/cms/BlockRenderer.tsx` — kept only for starter templates on new custom pages; existing pages no longer use it.

## Confirmation needed

Two decisions before I start:

1. **Preview placement on desktop:** side-by-side 50/50, or edit pane on the left with a narrower ~40% preview on the right? I'll default to 50/50 unless you say otherwise.
2. **Add/remove sections on the six existing pages:** OK to restrict add/remove to the repeatable regions I listed (Services cards, Product categories, Home feature grid, Vacatures list) and keep hero/footer sections fixed? This is what keeps the editor a true replica.
