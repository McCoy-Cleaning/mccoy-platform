# Phase 7 — Services modal SSR + hash anchors

## Goal

Make each service’s `full` copy crawlable **without** an SEO-only `sr-only` / crawler duplicate.
Preserve the existing card + modal visual design.

## Architecture (one-instance SSR)

1. **`ServiceDetailPanel`** — one React tree per service containing the real `full` paragraphs.
2. **Always rendered** for every card (SSR + hydrate). Closed panels use `hidden` + `inert` + `aria-hidden`; open panels use the same overlay classes as before.
3. **`BodyPortal`** — first paint / SSR renders panels in-place (so HTML includes the text). After mount, portals to `document.body` for stacking (same reason as the old client-only portal). Still **one** instance — not a second clone.
4. **No** `typeof document !== "undefined"` gate that omitted detail HTML from SSR.
5. **No** parallel `sr-only` copy of `full`.

Client JS only:

- toggles which panel is open
- syncs `#hash` ↔ open service (`hashchange` / `popstate` / Lees meer click)
- body scroll lock while open

## Stable hashes (Phase 8-ready)

| CMS card id   | Hash                     |
|---------------|--------------------------|
| svc_regular   | `#reguliere-schoonmaak`  |
| svc_horeca    | `#horeca-schoonmaak`     |
| svc_oplevering| `#opleveringsschoonmaak` |
| svc_floor     | `#vloeronderhoud`        |
| svc_furniture | `#meubelreiniging`       |
| svc_glass     | `#glas-gevelreiniging`   |

Links:

- NL: `/services#…`
- EN: `/en/services#…` (when on an English route)

## Deferred (explicitly not Phase 7)

Dedicated per-service landing URLs such as:

- `/reguliere-schoonmaak`
- `/horeca-schoonmaak`
- `/opleveringsschoonmaak`
- `/vloeronderhoud`
- `/meubelreiniging`
- `/glas-gevelreiniging`

…remain **deferred**. Do **not** create six new pages in this phase. Hash anchors on `/services` are the crawlable surface for now; Phase 8 wires footer / internal links to these hashes — see [internal-link-plan.md](./internal-link-plan.md).

## Files

- `apps/storefront/src/components/site/sections/ServicesSections.tsx`
- `apps/storefront/src/components/site/sections/ServiceDetailPanel.tsx`
- `packages/cms-schema/src/service-detail-anchors.ts` (shared; storefront re-exports)
- Tests: `service-detail-anchors.test.ts`, `services-ssr-crawlability.test.ts`, `services-cards-media.test.ts`