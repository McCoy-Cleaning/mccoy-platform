# Application E2E matrix — McCoy CMS + Aanvragen

**Date:** 2026-07-24  
**Companion:** [playwright-application-audit.md](./playwright-application-audit.md)

**Disposition values**

| Disposition | Meaning |
|-------------|---------|
| **P0 smoke** | Must pass every CI run |
| **full E2E** | Covered by dedicated suite |
| **partial** | Smoke or subset only |
| **skip** | Intentionally not automated |
| **quarantine** | Flaky / blocked — tracked |
| **exclude** | Out of CMS/Aanvragen scope |
| **manual** | Requires human / real provider |
| **blocked** | Cannot automate until gap fixed |

---

## Coverage stats (inventory)

| Category | Count | Notes |
|----------|------:|-------|
| Admin routes inventoried | 13 | See §1 |
| Storefront routes inventoried | 18 | See §2 |
| Builtin CMS pages | 9 | home…terms (incl. privacy/terms) |
| Fixed section keys | 19 | `ALL_FIXED_SECTION_KEYS` in `@mccoy/cms-schema` |
| Publishable block types | 35 | `PUBLISHABLE_BLOCK_TYPES` / `INVENTORY_PUBLISHABLE_BLOCK_TYPES` |
| Form kinds | 5 | inquiry…newsletter |
| Dispositions: P0 / full / partial | — | Filled as suites land |
| Exclude (commerce stubs) | 2 | products, users admin |
| External-provider gated | 4+ | MFA, invite, Graph/IMAP inbox, real SMTP |

---

## 1. Admin routes

| Route | Disposition | Suite / notes |
|-------|-------------|----------------|
| `/` → `/admin` | P0 smoke | Redirect |
| `/admin/` | partial | Shell + nav links only (stats are mock) |
| `/admin/login` | P0 smoke | Legacy login path available under E2E env |
| `/admin/mfa` | skip / manual | Supabase MFA — external |
| `/admin/invite` | skip / manual | External email/Supabase |
| `/admin/settings` | partial | Auth-mode dependent |
| `/admin/website/` | P0 smoke | Page inventory visible |
| `/admin/website/$pageId` | full E2E | Core CMS phases 4–12 |
| `/admin/website/media` | partial | Open + list |
| `/admin/website/other/navigation` | partial | Open + edit smoke |
| `/admin/inquiries` | full E2E *(after deterministic adapter)* / blocked until then | Phases 13–15 |
| `/admin/products` | **exclude** | Static stub |
| `/admin/users` | **exclude** | Static stub |

---

## 2. Storefront routes

| Route | Disposition | Suite / notes |
|-------|-------------|----------------|
| `/` | P0 smoke + full E2E | Public render after publish |
| `/about` | full E2E | Public CMS |
| `/services` | full E2E | Public CMS |
| `/products` | full E2E | **CMS page**, not commerce |
| `/contact` | P0 smoke + forms | Form → request |
| `/offerte` | forms | glass + furniture |
| `/vacatures` | forms | job application |
| `/vacatures/$slug` | partial | Depends on published jobs |
| `/en/`, `/en/$` | full E2E | Localization phase 11–12 |
| `/$customSlug` | full E2E | Seeded `/e2e-custom` |
| `/cms-preview` | full E2E | Preview gate (existing) |
| `/cms-sync` | partial | Covered via bridge specs |
| `/schoonmaakbedrijf-enschede` | partial | Public smoke |
| `/schoonmaakbedrijf-hengelo` | partial | Public smoke |
| `/privacy` | P0 smoke | Loads |
| `/terms` | P0 smoke | Loads |
| `/sitemap.xml` | partial | 200 + xml |

---

## 3. CMS workflows

| Workflow | Disposition | Phase |
|----------|-------------|-------|
| Editor loads for each builtin page | full E2E | 4 — `e2e/cms-loading-inventory.spec.ts` |
| Section inventory (fixed + blocks) | **full E2E (M5 implemented)** | 5 — `e2e/cms-loading-inventory.spec.ts` + `packages/cms-schema/src/e2e-inventory.ts` + `e2e/helpers/cms-inventory.ts` |
| Add section from picker (publishable set) | full E2E | 6 — representative add in `e2e/cms-add-sections.spec.ts`; exhaustive picker presence is M5 |
| Field coverage (representative per type) | full E2E | 7 — `e2e/cms-field-coverage.spec.ts` (metadata + representative edit; not deep per-type) |
| Reorder / hide / duplicate / remove | full E2E | 8 |
| Canvas + device frame + preview | full E2E | 9 |
| Publish / discard / unsaved | full E2E | 10 |
| NL / EN edit + publish | full E2E | 11 |
| Public rendering matches publish | full E2E | 12 |
| Draft blocks unpublishable content | full E2E | existing draft-gate |
| Cross-origin edit bridge | full E2E | existing |

---

## 4. Block types (publishable)

| Block type | Disposition | Notes |
|------------|-------------|-------|
| hero | full E2E | Home fixed + custom |
| richText | full E2E | Add + edit |
| centered | partial | Add smoke |
| textImage | full E2E | |
| columns | partial | |
| benefits | partial | |
| quote | partial | |
| gallery | full E2E | Existing dedicated spec |
| video | partial | |
| beforeAfter | partial | |
| carousel | partial | |
| steps | partial | |
| comparisonTable | partial | |
| featureGrid | partial | |
| spacer | partial | |
| teamGrid | partial | |
| teamProfile | partial | |
| values | partial | |
| timeline | partial | |
| roadmap | full E2E | Existing |
| plans | full E2E | Existing |
| cta | partial | |
| newsletter | full E2E | Forms + CMS |
| contactForm | full E2E | Forms + CMS |
| announcement | partial | |
| popup | partial | |
| portfolio | partial | |
| jobs | full E2E | Vacatures |
| latestPosts | partial | |
| partnersMarquee | partial | Inventory M5 |
| statsCounters | partial | Inventory M5 |
| contactInfoCards | partial | Inventory M5 |
| quoteRequestForm | partial | Inventory M5 (picker on Offerte) |
| legalArticles | partial | Inventory M5 |
| offers | partial | Inventory M5 |

*Rule:* every type appears at least once in inventory (**Phase 5 / M5 — implemented** via `e2e/cms-loading-inventory.spec.ts`, catalog in `packages/cms-schema/src/e2e-inventory.ts`). Deep field coverage prioritizes high-risk / conversion types; others get add→publish→public smoke.

---

## 5. Forms & Aanvragen

| Flow | Disposition | Phase |
|------|-------------|-------|
| Contact (`inquiry`) submit success | P0 + full | 13 |
| Offerte glass (`glass_washing`) | full | 13 |
| Offerte furniture (`furniture_cleaning`) | full | 13 |
| Vacatures (`job_application`) | full | 13 |
| Newsletter block (`newsletter`) | full | 13 |
| Scoped CMS contactForm | full | 14 |
| Validation / honeypot / rate-limit (browser-obs) | partial | 13 / 21 |
| Persist without SMTP | full | 13 (assert request store / inbox adapter) |
| Admin Aanvragen list + filters | full *(deterministic)* | 15 |
| Cross-app: form → Aanvragen visible | **P0 journey** | 15 |
| Graph/IMAP real mailbox | manual / separate project | 16 |
| Admin reply via Graph/SMTP | manual / integration | 16 |

---

## 6. Quality / platform

| Area | Disposition | Phase |
|------|-------------|-------|
| Global pageerror / console fail | full | 2 |
| a11y (critical flows) | full | 17 |
| Responsive (storefront + admin editor) | full | 18 |
| Chromium CI | P0 | 19 |
| Firefox / WebKit | partial / opt-in | 19 |
| Brave | partial smoke | existing |
| Resilience (offline nav, slow, double-submit) | partial | 20 |
| Security browser-observable | partial | 21 |
| Visual / screenshots | partial | 22 / existing |
| Scripts + CI gates | full | 23 |

---

## 7. Explicit excludes

- Admin `/admin/products`, `/admin/users` mock UIs  
- Cart, checkout, Mollie, orders, company registration, invoices, customer portal  
- Live production credentials / production data  
- Content-AI provider success (unless local stub exists)

---

## 8. Blocking items before READY

1. Deterministic inbox adapter for `MCCOY_E2E=1` (map JSON website-requests → FormInbox contracts).  
2. At least one automated form → Admin Aanvragen journey green.  
3. P0 smoke suite green on Chromium.  
4. Defects severity ≥ High fixed or accepted with documented residual risk.
