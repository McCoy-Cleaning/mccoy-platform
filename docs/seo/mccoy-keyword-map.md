# McCoy keyword map

Planning + verification status for commercial clusters. **No invented search volumes** (GSC/Bing exports are operator-owned).

Companions: [`keyword-map.md`](./keyword-map.md), [`keyword-baseline.md`](./keyword-baseline.md), [`proposed-metadata.md`](./proposed-metadata.md), [`mccoy-content-improvement-proposals.md`](./mccoy-content-improvement-proposals.md).

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
| Third-party volume tools | **Not used** in this program (no fabricated monthly searches) |

## Out of scope here

- New location/service URL creation without approval
- Thin EN legal / offerte inventiveness
- Ecommerce Offer schema — [`product-seo-roadmap.md`](./product-seo-roadmap.md)
