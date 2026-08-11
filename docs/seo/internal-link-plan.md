# SEO-18 / Phase 8 — Internal linking (implemented)

Status: **implemented** (Phase 8 of SEO Migration Hardening).

## What shipped

| Surface | Behavior |
|---------|----------|
| Footer service defaults | Six services → `/services#…` using shared Phase 7 anchors |
| EN chrome | Same links resolve to `/en/services#…` on English paths |
| `CmsLink` / `resolveCmsLinkHref` | Optional `hash` on `internal` / `internal_route`; hashes preserved |
| `CmsLinkAnchor` | Localizes via pathname; keeps `#hash` / `?query` |
| Lees meer | Visible “Lees meer” / “Read more” + `aria-label` including service title |
| Integrity gate | `@mccoy/security` `internal-link-integrity` — denylist Phase 2 legacy + gone |

## Shared anchors

Source of truth: `packages/cms-schema/src/service-detail-anchors.ts`

| Hash | Footer / card |
|------|----------------|
| `#reguliere-schoonmaak` | footer_svc_1 / svc_regular |
| `#horeca-schoonmaak` | footer_svc_2 / svc_horeca |
| `#opleveringsschoonmaak` | footer_svc_3 / svc_oplevering |
| `#vloeronderhoud` | footer_svc_4 / svc_floor |
| `#meubelreiniging` | footer_svc_5 / svc_furniture |
| `#glas-gevelreiniging` | footer_svc_6 / svc_glass |

Dedicated per-service landing URLs remain **deferred** (see Phase 7).

## Recommended topical links (still editorial)

| From | To | Suggested anchor (NL) | Notes |
|------|----|------------------------|-------|
| `/` | `/services` | Onze diensten | nav |
| `/` | `/schoonmaakbedrijf-enschede` | Schoonmaakbedrijf Enschede | city landing |
| `/` | `/schoonmaakbedrijf-hengelo` | Schoonmaakbedrijf Hengelo | city landing |
| `/services` | `/offerte` | Offerte aanvragen | conversion |
| `/vacatures` | `/contact` | Contact | secondary |
| City landings | `/services` | Diensten in Twente | topical |

Body copy / CMS section link additions still go through the content change request process; chrome + integrity gate are infra.

## Integrity gate

```bash
npm run test:seo
# includes: @mccoy/security src/internal-link-integrity.test.ts
```

Rules for McCoy-owned hrefs on major public routes:

1. **Not** Phase 2 legacy redirect URLs (`/cleaning`, `/over-ons`, …)
2. **Not** 410 paths (`/ultrasoon`, `/actie`)
3. **Not** trailing-slash or apex-host (`mccoy.nl`) variants
4. **Not** identity aliases (`/producten`, `/jobs`, …)
5. **Not** bare NL peers when the link is emitted on an EN page and `/en/…` is known
6. Path (sans hash) must be in the major public canonical set (or `/vacatures/*`)

## Files

- `packages/cms-schema/src/footer.ts`
- `packages/cms-schema/src/links.ts` / `cms-link-model.ts`
- `packages/cms-schema/src/service-detail-anchors.ts`
- `packages/security/src/internal-link-integrity.ts`
- `apps/storefront/src/components/site/CmsLinkAnchor.tsx`
- `apps/storefront/src/lib/locale-path.ts`
- `apps/storefront/src/components/site/sections/ServicesSections.tsx`
