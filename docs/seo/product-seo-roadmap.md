# Product SEO roadmap (ecommerce later)

Status: **deferred / planning**. No fake `Offer`, prices, availability, or AggregateRating in current JSON-LD.

Protected surface: Producten (`/products`, `/en/products`) — Safe Mode forbids SEO-driven content redesign of Producten.

## Current (Phases 0–11)

| Surface | Structured data | Notes |
|---------|-----------------|-------|
| `/products` | `ItemList` with `Product` / `Service`-style list items (catalogue cards) | Fact-only names; **no** Offer / price |
| Sitewide | `CleaningService` org NAP | Not a product graph |
| Reviews / ratings | **None** | Never invent |

## Future ecommerce Product / Offer (when catalogue is purchase-capable)

Prerequisites before emitting `Offer`:

1. Server-authoritative public base prices exist for each SKU shown.
2. Currency (`EUR`) and availability come from inventory/policy, not hardcoded marketing copy.
3. Product pages (or stable SKU URLs) exist — not only the wholesale intro/assortment chrome.
4. Explicit product owner approval to leave planning → implementation.

Suggested shape (illustrative — do not ship until prerequisites):

```json
{
  "@type": "Product",
  "name": "<SKU name from catalogue>",
  "offers": {
    "@type": "Offer",
    "priceCurrency": "EUR",
    "price": "<server price as decimal string>",
    "availability": "https://schema.org/InStock"
  }
}
```

**Do not** invent prices for SEO. Prefer omitting `offers` until checkout-ready.

## Vacancy JobPosting note (Phase 9 — done in code)

**Decision:** Emit `JobPosting` on vacancy **detail** routes only (`/vacatures/$slug`, and EN peer when published).

| Route | JobPosting |
|-------|------------|
| `/vacatures` | **No** — list only (avoids multi-job list abuse) |
| `/vacatures/$slug` | **Yes** — one fact-only posting from CMS vacancy; `hiringOrganization.@id` → `https://www.mccoy.nl/#organization` |
| `datePosted` | Only when vacancy `startDate` (or explicit option) exists — never invented |

Detail: [`mccoy-local-citation-cleanup.md`](./mccoy-local-citation-cleanup.md) § JobPosting eligibility.

## Explicit non-goals now

- Fake wholesale “from €X” offers
- AggregateRating / review stars
- Product schema on non-product marketing pages
- Changing Producten block composition for SEO
