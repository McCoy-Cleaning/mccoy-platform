# McCoy keyword map

Planning + verification status for commercial clusters. **No invented search volumes** (GSC/Bing exports are operator-owned).

Companions: [`keyword-map.md`](./keyword-map.md), [`keyword-baseline.md`](./keyword-baseline.md), [`proposed-metadata.md`](./proposed-metadata.md), [`mccoy-content-improvement-proposals.md`](./mccoy-content-improvement-proposals.md), [`semrush-opportunities-triage.md`](./semrush-opportunities-triage.md).

## Legend

| Status | Meaning |
|--------|---------|
| **verified** | Supported by site facts (1998, Oldenzaal, Twente, services, wholesale) and already used on a live/code route |
| **candidate** | Natural phrasing for future content; not volume-validated; no new URL assumed |
| **avoid** | Stuffing / unsupported claim / fake social proof |

## Clusters

| Cluster | Primary query | Supporting | Locale | Target URL | Status | Notes |
|---------|---------------|------------|--------|------------|--------|-------|
| Brand / home | schoonmaakbedrijf Twente | McCoy Cleaning Oldenzaal, schoonmaakbedrijf Oldenzaal | nl | `/` | verified | Phase 6 title + H1 |
| Brand / home EN | cleaning company Twente | McCoy Cleaning Oldenzaal | en | `/en` | verified | Only where EN published |
| Services hub | schoonmaakdiensten Twente | kantoorschoonmaak Twente, glasbewassing Twente | nl | `/services` | verified | Phase 6 + Phase 7 SSR full text |
| Services hub EN | cleaning services Twente | office cleaning Twente | en | `/en/services` | verified | Published EN |
| Service — regular | reguliere schoonmaak Twente | kantoorschoonmaak | nl | `/services#reguliere-schoonmaak` | verified | Hash only; dedicated landing deferred |
| Service — horeca | horecaschoonmaak Twente | schoonmaak horeca | nl | `/services#horeca-schoonmaak` | verified | Hash only |
| Service — oplevering | opleveringsschoonmaak Twente | bouwoplevering schoonmaak | nl | `/services#opleveringsschoonmaak` | verified | Hash only |
| Service — floor | vloeronderhoud Twente | vloerreiniging | nl | `/services#vloeronderhoud` | verified | Hash only |
| Service — furniture | meubelreiniging Twente | stoffering reinigen | nl | `/services#meubelreiniging` | verified | Hash only |
| Service — glass | glasbewassing Twente | glazenwasser Oldenzaal | nl | `/services#glas-gevelreiniging` | verified | Hash only |
| Products / wholesale | McCoy Cleaning Products | hygiënepapier, professionele zepen, groothandel | nl | `/products` | verified | H1 Producten; scent H2 |
| Products EN | McCoy Cleaning Products wholesale | hygiene paper, professional soaps | en | `/en/products` | verified | |
| About | McCoy Cleaning sinds 1998 | schoonmaakbedrijf Twente geschiedenis | nl | `/about` | verified | 1998 founding fact |
| Contact | contact McCoy Cleaning Oldenzaal | schoonmaak Twente contact | nl | `/contact` | verified | NAP aligned |
| Quote | offerte schoonmaak Twente | offerte kantoorschoonmaak | nl | `/offerte` | verified | EN offerte unpublished |
| Jobs list | vacatures schoonmaak Twente | glazenwasser vacature Oldenzaal | nl | `/vacatures` | verified | Keywords meta stuffing removed |
| Jobs detail | {vacancy title} Oldenzaal / Twente | — | nl | `/vacatures/$slug` | verified | JobPosting on detail only |
| City Enschede | schoonmaakbedrijf Enschede | kantoorschoonmaak Enschede | nl | `/schoonmaakbedrijf-enschede` | verified | Existing city landing |
| City Hengelo | schoonmaakbedrijf Hengelo | glazenwasser Hengelo | nl | `/schoonmaakbedrijf-hengelo` | verified | Existing city landing |
| Future city pages | schoonmaakbedrijf Almelo / … | — | nl | TBD | candidate | Approval-gated; not implemented |
| Future service URLs | kantoorschoonmaak Twente (landing) | — | nl | TBD vs keep hash | candidate | Six landings deferred |
| Ultrasoon legacy | ultrasoon reiniging McCoy | — | — | gone `/ultrasoon` | avoid | 410; no successor page |
| Fake ratings | “beste schoonmaak Twente” + stars | — | — | — | avoid | No invented reviews |

## Phase 6 deploy mapping

| Query intent | Deployed title / H1 signal |
|--------------|----------------------------|
| schoonmaakbedrijf Twente / Oldenzaal | Home title + H1 |
| schoonmaakdiensten Twente | `/services` title + H1 |
| producten / groothandel | `/products` title + Producten H1 |
| vacatures schoonmaak Twente | `/vacatures` title (no keywords meta) |

## Volume / rank data

| Source | Status |
|--------|--------|
| Google Search Console export | **Operator** — fill post-deploy; see [`search-console-post-deploy.md`](./search-console-post-deploy.md) |
| Bing Webmaster | **Operator** — [`bing-post-deploy.md`](./bing-post-deploy.md) |
| Semrush keyword tracker (operator screenshot, 2024–2026) | **Recorded below** — ranks/CTR where visible; monthly volume left blank (tool showed `—`; do not invent) |
| Third-party volume tools | **Not used** to invent monthly searches |

## Operator tracker — Tracked (add to McCoy set)

Source: Semrush-style keyword list provided by operator (Universe = Tracked). Commercial / brand / local service intent only.

| Query | Locale | Intent | Tracker notes | Target URL | Status |
|-------|--------|--------|---------------|------------|--------|
| mc coy | nl | brand | Tracked (added ~Aug 2024); brand spelling variant | `/` | verified |
| mccoy oldenzaal | nl | brand + local | Tracked (added ~Aug 2024) | `/` | verified |
| schoonmaakbedrijf oldenzaal | nl | commercial | Tracked (added ~Sep 2024); already Phase 6 home signal | `/` | verified |
| schoonmaakbedrijven oldenzaal | nl | commercial | Tracked (added ~Sep 2024); plural variant | `/` | candidate |
| schoonmaak oldenzaal | nl | commercial | Tracked (added ~Sep 2024) | `/` | candidate |
| glazenwasser oldenzaal | nl | service | Tracked (added ~Sep 2024); glass cluster support | `/services#glas-gevelreiniging` | verified |
| gevelreiniging oldenzaal | nl | service | Tracked (added ~Aug 2024) | `/services#glas-gevelreiniging` | candidate |
| zonnepanelen schoonmaken oldenzaal | nl | service | Tracked (added ~Sep 2024); niche outdoor | TBD vs services hash | candidate |
| dakkapel schoonmaken oldenzaal | nl | service | Tracked (added ~Sep 2024); niche outdoor | TBD vs services hash | candidate |
| dakgoot schoonmaken wijk bij duurstede | nl | service + geo | Tracked (added ~Aug 2024); outside Twente primary | TBD (approval-gated city/service) | candidate |

## Operator tracker — Semrush IMPROVE visibility (existing rankings)

Source: Semrush Opportunities “Improve existing visibility” rows (operator screenshots). These are **content/ranking** opportunities, not code defects. Tracked here so GSC/content work can prioritize them; do not invent landings or stuffing.

| Query | Locale | Intent | Target URL | Status | Notes |
|-------|--------|--------|------------|--------|-------|
| glazenwasser oldenzaal | nl | service | `/services#glas-gevelreiniging` | verified | Also in Tracked table above |
| schoonmaakster oldenzaal | nl | service + role | `/vacatures` vs `/services` | candidate | Role-intent; jobs list is primary; avoid new URL |
| schoonmaakbedrijf | nl | commercial (broad) | `/` | candidate | Broad head term; home already targets Twente/Oldenzaal |
| schoonmaakdienst | nl | commercial (broad) | `/services` | candidate | Singular/service hub support |
| mccoy vacatures | nl | brand + jobs | `/vacatures` | verified | Brand+jobs; Phase 6 vacatures title |
| zonnepanelen schoonmaken oldenzaal | nl | service | TBD vs services hash | candidate | Also in Tracked; niche outdoor |

## Operator tracker — Suggested (do **not** treat as McCoy targets)

Universe = Suggested in the same export. Mostly unrelated local noise or competitors — keep out of titles/H1/meta.

| Query | Disposition | Reason |
|-------|-------------|--------|
| buienradar oldenzaal | avoid | Weather tool, not cleaning |
| weer oldenzaal | avoid | Weather |
| funda oldenzaal | avoid | Real-estate portal |
| funda wijk bij duurstede | avoid | Real-estate portal |
| gemeente oldenzaal | avoid | Municipality |
| gemeente wijk bij duurstede | avoid | Municipality |
| burgerzaken | avoid | Civic admin, not commercial cleaning |
| kartbaan oldenzaal / karthuizer oldenzaal | avoid | Unrelated venue / noise |
| oldenzaal classics | avoid | Unrelated event/brand |
| ppo wijk bij duurstede | avoid | Unrelated org |
| wijk bij duurstede | avoid | Bare geo (too broad; no cleaning intent) |
| banierix / benerink oldenzaal | avoid | Unclear / non-McCoy brand noise |
| dejasque / dejacque oldenzaal | avoid | Unclear / non-McCoy brand noise |
| vobago / valego cleaning services | competitive watch | Competitor brand — do not target as McCoy primary; optional competitive note only |

## Out of scope here

- New location/service URL creation without approval
- Thin EN legal / offerte inventiveness
- Ecommerce Offer schema — [`product-seo-roadmap.md`](./product-seo-roadmap.md)
- Promoting Semrush “Suggested” geo/civic noise into on-page copy
