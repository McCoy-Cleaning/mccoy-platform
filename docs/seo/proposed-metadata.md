# SEO-8 / Phase 6 — Deployed metadata

**Status: `DEPLOYED`** (Phase 6 on-page authorized — exits Safe Mode for titles/descriptions/H1 semantics only)

Final copy below is live via `apps/storefront/src/lib/cms/frozen-deployed-seo.ts` (+ root fallback / i18n H1s). No invented claims; facts: 1998, Oldenzaal, Twente, services, wholesale products.

| Route | Locale | Title | Description | H1 (semantic) | Status |
|-------|--------|-------|-------------|---------------|--------|
| `/` | nl | McCoy Cleaning — Schoonmaakbedrijf Twente \| Oldenzaal | Professioneel schoonmaakbedrijf in Twente sinds 1998. Kantoorschoonmaak, glasbewassing, vloer- en horecaschoonmaak vanuit Oldenzaal — met een vast eigen team. | McCoy Cleaning, **schoonmaakbedrijf in Twente.** | DEPLOYED |
| `/services` | nl | Schoonmaakdiensten Twente — McCoy Cleaning | Kantoorschoonmaak, horeca-, opleverings- en vloeronderhoud, meubelreiniging en glasbewassing in Twente. Vast eigen team van McCoy Cleaning in Oldenzaal — vraag een offerte aan. | Schoonmaakdiensten in Twente | DEPLOYED |
| `/products` | nl | Producten — McCoy Cleaning Products \| Groothandel | McCoy Products: groothandel in hygiënepapier, professionele zepen, reinigingsmiddelen voor horeca en schoonmaakapparatuur. Neem contact op voor het assortiment. | H1: Producten (eyebrow classes); H2: scent/section title (display classes); cards H3 | DEPLOYED |
| `/about` | nl | Over McCoy Cleaning — Schoonmaakbedrijf Twente sinds 1998 | Sinds 1998 staat McCoy Cleaning voor schoonmaak met karakter vanuit Oldenzaal. Lees over onze missie, visie en geschiedenis als schoonmaakbedrijf in Twente. | Over McCoy Cleaning | DEPLOYED |
| `/contact` | nl | Contact — McCoy Cleaning Twente \| Oldenzaal | Neem contact op met McCoy Cleaning in Oldenzaal voor vragen of aanvragen over professionele schoonmaak in Twente. Persoonlijk antwoord binnen één werkdag. | Form chrome H1 (Neem contact op / catalog) | DEPLOYED |
| `/offerte` | nl | Offerte aanvragen — Schoonmaak Twente \| McCoy Cleaning | Offerte aanvragen voor kantoorschoonmaak, glasbewassing, vloer- en meubelonderhoud in Twente. Persoonlijk antwoord binnen één werkdag — McCoy Cleaning Oldenzaal. | Vraag een offerte aan | DEPLOYED |
| `/vacatures` | nl | Vacatures Schoonmaak Twente — Werken bij McCoy Cleaning | Vacatures schoonmaak Twente: schoonmaakmedewerker, glazenwasser en oproepkracht bij McCoy Cleaning in Oldenzaal. Solliciteer direct. | Werken bij McCoy Cleaning | DEPLOYED |
| `/` | en | McCoy Cleaning — Cleaning Company Twente \| Oldenzaal | Professional cleaning company in Twente since 1998. … from Oldenzaal — permanent in-house team. | McCoy Cleaning, **cleaning company in Twente.** | DEPLOYED |
| `/en/services` | en | Cleaning Services Twente — McCoy Cleaning | Office, hospitality, post-construction and floor cleaning… in Twente. | Cleaning services in Twente | DEPLOYED |
| `/en/products` | en | Products — McCoy Cleaning Products \| Wholesale | Wholesale hygiene paper, soaps, agents and equipment. | H1 Products / H2 scent | DEPLOYED |
| `/en/about` | en | About McCoy Cleaning — Cleaning Company Twente since 1998 | Since 1998… from Oldenzaal. | About McCoy Cleaning | DEPLOYED |
| `/en/contact` | en | Contact — McCoy Cleaning Twente \| Oldenzaal | Contact… Oldenzaal… Twente. | Form chrome H1 | DEPLOYED |
| `/en/vacatures` | en | Cleaning Jobs Twente — Work at McCoy Cleaning | Cleaning vacancies in Twente… Oldenzaal. | Work at McCoy Cleaning | DEPLOYED |
| `/en/offerte` | — | — | — | Unpublished → 302 `/offerte` | NOT DEPLOYED (no thin EN) |
| `/en/terms`, `/en/privacy` | en | — | Dutch-bleed → noindex (Phase 3) | — | NOT DEPLOYED (no invented legal EN) |

## Notes

- No `<meta name="keywords">` for ranking (removed from storefront root, city landings, frozen vacatures).
- Visual layout unchanged; Producten only swaps heading **tags** (eyebrow→H1, scent→H2) with identical classNames.
- Further SEO-8 inventiveness stays out of scope; this table is the deployed source of truth for Phase 6.
