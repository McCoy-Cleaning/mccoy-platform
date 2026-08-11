# Legacy URL migration map (Phase 1–2)

Phase 1: decisions. **Phase 2: implemented** — real HTTP 301/410 via `@mccoy/security/legacy-redirects` + storefront `start.ts` middleware; permanent path redirects also mirrored in `apps/storefront/vercel.json` (host-scoped; before apex catch-all).

Companion baseline: [`mccoy-seo-baseline.md`](./mccoy-seo-baseline.md).

**Rules (locked):** one hop to canonical `https://www.mccoy.nl{path}` (slashless except `/`); never soft-404 to `/`; `/ultrasoon` → **true HTTP 410** (not homepage redirect); preserve useful query params on redirects.

---

## Migration matrix

| Legacy URL | Historical purpose | New equivalent | Decision | Status | Reason |
|------------|-------------------|----------------|----------|--------|--------|
| `/cleaning/` | Legacy NL “cleaning / diensten” URL (still cited in third-party / SERP history) | `/services` | **301** | implemented | Clear successor is current services page; no `/cleaning` route in storefront |
| `/cleaning` | Same without slash | `/services` | **301** | implemented | After slash normalize, same target (single map entry + slash-insensitive match; avoid chains) |
| `/over-ons/` | Legacy “Over ons” (MG5 fixtures + locale tests still use slug `/over-ons`; live soft 404) | `/about` | **301** | implemented | Builtin seed slug is `/about`; historical WordPress-style path |
| `/over-ons` | Same | `/about` | **301** | implemented | Same |
| `/collegas-gezocht/` | Legacy careers landing (“Collega’s gezocht” — still indexed in web results) | `/vacatures` | **301** | implemented | Current jobs listing / solliciteer flow |
| `/collegas-gezocht` | Same | `/vacatures` | **301** | implemented | Same |
| `/solliciteer-direct/` | Legacy apply CTA landing | `/vacatures` | **301** | implemented | Apply UX lives on vacatures (+ application section); no stable public `#solliciteren` required for Phase 2 |
| `/solliciteer-direct` | Same | `/vacatures` | **301** | implemented | Same |
| `/privacybeleid/` | Legacy privacy policy path | `/privacy` | **301** | implemented | Current legal route `/privacy` |
| `/privacybeleid` | Same | `/privacy` | **301** | implemented | Same |
| `/actie/` | Historical **glasbewassing promo** (“ALTIJD SCHONE RAMEN…” — SERP/snippet evidence 2026-08-11), not a product catalogue | none / optional `/services` | **410** (default) | implemented | **Not** a genuine `/products` successor. Repo has no `/actie` content. `/aanbiedingen`→`/products` is a different identity alias. Operator may later approve **301 → `/services`** if juice preservation preferred; do not map to `/products` without new evidence |
| `/actie` | Same | none | **410** | implemented | Same |
| `/ultrasoon/` | Historical McCoy Ultrasoon service landing (window coverings / lighting ultrasonic cleaning — third-party directories) | none | **410** | implemented | No successor route/CMS page in codebase; locked plan: real Gone, not soft 404 / home redirect |
| `/ultrasoon` | Same | none | **410** | implemented | Same |
| `/products/` | Trailing-slash variant of products | `/products` | **slash normalize (existing host layer)** | existing | Already handled; keep one-hop with legacy maps |
| `/services/` | Trailing slash | `/services` | **slash normalize** | existing | Existing |
| `/about/` | Trailing slash | `/about` | **slash normalize** | existing | Existing |
| `/contact/` | Trailing slash | `/contact` | **slash normalize** | existing | Existing |
| `/offerte/` | Trailing slash | `/offerte` | **slash normalize** | existing | Existing |
| `/vacatures/` | Trailing slash | `/vacatures` | **slash normalize** | existing | Existing |
| `/privacy/` | Trailing slash | `/privacy` | **slash normalize** | existing | Existing |
| `/terms/` | Trailing slash | `/terms` | **slash normalize** | existing | Existing |
| `/producten` | NL identity alias | `/products` | **301 (already live)** | existing | `PUBLIC_IDENTITY_PATH_ALIASES` + `$customSlug` |
| `/jobs` | EN/NL identity alias | `/vacatures` | **301 (already live)** | existing | Same |
| `/aanbiedingen` | Offers/promo identity alias | `/products` | **301 (already live)** | existing | Distinct from `/actie` |
| `/offers` | EN offers alias | `/products` | **301 (already live)** | existing | Same |
| `/careers` | EN careers alias | `/vacatures` | **301 (already live)** | existing | Same |
| `/en/producten` | EN + alias | `/en/products` | **301 (code)** | existing | Locale path tests |
| `/en/jobs` | EN + alias | `/en/vacatures` | **301 (code)** | existing | Same |

---

## Discovery notes (repo + web)

### Searched, not present as routes

- No storefront route or CMS seed for: `ultrasoon`, `actie`, `cleaning`, `collegas-gezocht`, `solliciteer-direct`, `privacybeleid`.
- `vercel.json` mirrors permanent legacy paths host-scoped to `www.mccoy.nl` (relative destination) and `mccoy.nl` (absolute www destination), listed **before** the apex catch-all — one hop on production hosts, no preview→prod leakage. **410 is not expressible as a Vercel redirect** (only 301/302/307/308); Gone is enforced in storefront request middleware.
- CMS `cms_redirects` table/API exists for page-scoped redirects; not populated with these legacy marketing paths in seeds.
- Address in code/NAP: **Nijverheidsstraat 63, Oldenzaal** — **no Bremenstraat** references in repo.
- No checked-in old sitemap listing these legacy paths; live `/sitemap.xml` is a short static set of current core paths (relative locs).

### `/actie/` verification (products successor?)

| Check | Result |
|-------|--------|
| Repo path `/actie` | Absent |
| Alias `/aanbiedingen` → `/products` | Present — different URL |
| Live soft 404 title | `actie — McCoy Cleaning` |
| Public web snippet (mccoy.nl/actie/) | Glass-washing promo (“ALTIJD SCHONE RAMEN”, osmose water, glazenwassers) |
| Products page purpose | Wholesale hygiene paper / geur / middelen |

**Verdict:** `/products` is **not** the genuine successor. Default decision **410**. Optional operator confirm: 301 → `/services` (glasbewassing is a service card).

### Trailing-slash policy

Legacy map matches on **slashless** identities after `stripTrailingSlashPath`, then returns **410 or 301 in the same response** so `/ultrasoon/` and `/cleaning/` do not hop through soft-404 HTML. Host slash-strip still applies to non-legacy paths.

### Chain analysis (Phase 2)

| Request | Expected response | Notes |
|---------|-------------------|--------|
| `https://www.mccoy.nl/cleaning` | 301 → `/services` (same host) | Vercel host-scoped rule and/or app middleware |
| `https://www.mccoy.nl/cleaning/` | 301 → `/services` | One hop (slash + legacy composed) |
| `https://mccoy.nl/cleaning` | 301 → `https://www.mccoy.nl/services` | Apex-scoped absolute rule before catch-all |
| `https://www.mccoy.nl/ultrasoon` | **410** | App middleware only |
| `https://www.mccoy.nl/ultrasoon/` | **410** | Same; no slash-then-gone chain |
| `https://mccoy.nl/ultrasoon` | apex→www then **410** (possible 2 hops) | Vercel cannot emit 410; **acceptable** remaining chain (Phase 4 light confirmation) |
| Preview deploy `/cleaning` | App middleware 301 (relative) | No vercel production host match — no preview→prod leak |
| Unknown path | 404 (unchanged) | Never redirected to `/` |
| Non-legacy `/services/` | Host slash strip only | Legacy map returns null — no double system |

### Phase 4 light confirmation (post–Phase 2)

- Host trailing-slash + HTTPS/www one-hop unit tests remain in `host-canonical.test.ts`.
- Legacy composition tests confirm non-legacy slash paths are **not** claimed by the legacy map; `/cleaning/` still one-hops to www `/services`.
- Only documented multi-hop: apex → www → **410** for `/ultrasoon` (and `/actie`). Do not “fix” by 301-to-home.

---

## `/ultrasoon` evidence section

| Evidence type | Status | Notes |
|---------------|--------|-------|
| Codebase successor page | **None** | No route, seed, CMS fixture, or service-card slug for ultrasoon |
| Live HTTP (2026-08-11) | **404** soft HTML | Title `ultrasoon — McCoy Cleaning`; `robots: index, follow`; no canonical; slash variant 307→`/ultrasoon` |
| Google Search Console impressions/clicks | **UNAVAILABLE** | No GSC API / operator export in this session — do not invent numbers |
| Bing Webmaster | **UNAVAILABLE** | Same |
| Ahrefs/Semrush/Majestic backlinks | **UNAVAILABLE** | No API access |
| Manual web mentions | **Partial** | Third-party directories (e.g. laboratorium.nl, onderzoekers.nl) describe “McCoy Ultrasoon” (raambekleding / verlichtingsarmaturen) and link company site `https://www.mccoy.nl` — not always deep-linking `/ultrasoon` |
| Genuine current equivalent service on site | **Not found** | Current services cards: regulier, horeca, oplevering, vloer, meubel, glas — no ultrasonic offering in code copy |

**Phase 2 acceptance:** `/ultrasoon` and `/ultrasoon/` must return real **410 Gone** (empty/minimal body OK). Do not 301 to `/` or `/services` unless new operator evidence proves a genuine successor (stop and re-document first).

---

## Live sample summary (supporting)

| Path | Live status (2026-08-11) |
|------|--------------------------|
| `/`, `/services`, `/products`, `/about`, `/contact`, … city landings | 200 |
| `/en/offerte` | 302 → `/offerte` |
| `/producten`, `/jobs`, `/aanbiedingen`, `/offers`, `/careers` | 301 → canonical |
| `/ultrasoon`, `/actie`, `/over-ons`, `/cleaning`, `/collegas-gezocht`, `/solliciteer-direct`, `/privacybeleid` | 404 soft (pre–Phase 2) |
| `…/` trailing | 307 → slashless |

Post–Phase 2 (code): legacy rows above → **301** or **410** per matrix; identity aliases unchanged.

---

## Phase 2 ready checklist

- [x] Decisions recorded for all plan-required legacy paths
- [x] `/actie` verified ≠ products
- [x] `/ultrasoon` locked to 410 with evidence status
- [x] Implementation + unit/HTTP tests (Phase 2)
- [ ] Operator optional: confirm 410 vs 301→`/services` for `/actie`
