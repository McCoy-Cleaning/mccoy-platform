# Commerce Foundation Phase 1 — Domain Contract

**Status:** authoritative for Companies / Customers / Orders before checkout & Mollie.  
**Out of scope:** cart, checkout UI, Mollie API/webhooks, customer portal, inventory, CRM.

## Goals

1. Canonical commerce identity and order history that future checkout/Mollie/portal can write without redesign.
2. Admin **Customers** module: Existing Customers vs Guests That Purchased.
3. Keep `website_requests` independent (form submitter ≠ customer).

## Canonical live identity

| Concept | Source of truth | Notes |
|--------|-----------------|-------|
| Auth credentials / MFA | `auth.users` | Never fake guest Auth rows |
| Application profile | `public.users` | 1:1 with Auth; `account_kind` = `staff` \| `customer` |
| Company (B2B legal entity) | `public.companies` | KVK/VAT, type, status, invoice_allowed |
| Membership | `public.company_users` | Many users ↔ many companies (v1 typically 1+) |
| Guest purchaser (no account) | `public.guest_purchasers` | Stable UUID; **not** Auth; keyed by normalized email uniqueness |
| Order | `public.orders` + `public.order_items` | Commercial record |
| Payment record (future Mollie) | `public.payments` | Schema only; no processing in this phase |

`website_requests` remains a separate form/inbox domain. Do not auto-create customers, guests, companies, or Auth users from form submitters.

## Registered customer model

- A **registered customer** is a `public.users` row with `account_kind = 'customer'` and `staff_role IS NULL`.
- Status reuses `user_status`: `invited` \| `active` \| `blocked` (+ `blocked_at`).
- Optional `phone` on `public.users` for operational contact (Auth email remains auth SoT).
- Commercial affiliation is via `company_users`, not by stuffing company fields onto the user alone.
- **Individual customer:** one `users` row + one `companies` row (sole-trader / one-person company) + membership. McCoy registration remains company-oriented; we do not invent a second identity table for “person without company.”
- **Multi-user company:** multiple `company_users` rows for the same `company_id`.

## Guest purchaser model

- Created when an order is placed (or imported/fixture) without a registered purchaser link.
- `guest_purchasers.email_normalized` = `trim + lower` of checkout email; **unique**.
- Multiple orders with the same normalized email share one `guest_purchaser_id`.
- Guests never get `auth.users` / `public.users` rows.
- Aggregation signal: email. **Primary key:** UUID. No fuzzy merge.

## Order ownership

An order may reference:

| Field | Meaning |
|-------|---------|
| `guest_purchaser_id` | Guest commercial identity (may remain set after conversion) |
| `customer_user_id` | Registered purchaser profile |
| `company_id` | Buying company |

**Rules**

- At least one of `guest_purchaser_id`, `customer_user_id`, `company_id` must be set.
- **Guest order (list “Guests That Purchased”):** `customer_user_id IS NULL` and `guest_purchaser_id IS NOT NULL`.
- **Registered order:** `customer_user_id IS NOT NULL` and/or `company_id IS NOT NULL`.
- After guest→registered conversion: set `customer_user_id` / `company_id` on historical orders; **do not clear** purchaser/billing/shipping snapshots; prefer keeping `guest_purchaser_id` for audit.

## Immutable commercial snapshots (on `orders`)

Live profile edits must **not** rewrite:

- `purchaser_email`, `purchaser_email_normalized`, `purchaser_name`, `purchaser_phone`, `purchaser_company_name`
- `billing_address` / `shipping_address` (jsonb structured address)
- Line item name, SKU, unit price, tax, quantities, line totals
- Money columns (`*_minor` bigint, currency ISO 4217)

## Status machines (separate columns)

| Column | Values (v1) |
|--------|-------------|
| `order_status` | `pending`, `confirmed`, `cancelled`, `completed` |
| `payment_status` | `unpaid`, `pending`, `paid`, `failed`, `cancelled`, `refunded` |
| `fulfilment_status` | `unfulfilled`, `partial`, `fulfilled`, `cancelled` |

**Total spend (admin aggregates):** sum `total_minor` where `payment_status = 'paid'` and `order_status <> 'cancelled'`.

## Money

- All amounts: **integer minor units** (`bigint`), never float.
- Currency: ISO 4217 text (`EUR` default).
- Tax rate on lines: **basis points** (`tax_rate_bps`, e.g. 2100 = 21%).

## Future Mollie (schema only)

`orders.payment_provider`, `orders.payment_provider_ref`  
`payments`: `provider`, `provider_payment_id` (unique per provider), `amount_minor`, `currency`, `status`, timestamps.

No Edge Functions, webhooks, or payment creation in this phase.

## Guest → registered conversion (contract)

1. Admin selects eligible guest (`converted_user_id IS NULL`).
2. Normalize email; look up existing `public.users` by email.
3. If active/invited **customer** exists → link only (no new Auth); attach membership/company if missing; link orders; mark guest converted. Idempotent.
4. If **staff** email collision → reject (do not convert onto staff).
5. If no user → Supabase Auth Admin invite (customer establishes password); insert `public.users` (`account_kind=customer`, `status=invited`); create/link company; `company_users`; link orders; mark guest converted.
6. Never invent passwords. Service role server-only.
7. Concurrent conversions: unique `guest_purchasers.email_normalized` + transactional link + idempotent re-entry.

## Authorization / RLS

- Browser: no broad `authenticated` SELECT on companies/orders/guests/customers directory.
- Staff admin lists/mutations: trusted server + `requireAdminSession()` + service-role client (same pattern as staff & website_requests).
- Optional future: customer SELECT own orders via `customer_user_id = auth.uid()` / company membership — **not** enabled as open listing in Phase 1; policies stay deny-by-default for anon and non-own rows.
- Staff may SELECT commerce tables only when `private.current_user_is_active_staff()` (for potential future direct reads); writes remain service_role / security definer.

## Admin Customers UI populations

- **Existing Customers:** `public.users` where `account_kind = 'customer'`, with company + order aggregates.
- **Guests That Purchased:** `guest_purchasers` where `converted_user_id IS NULL`, with order aggregates from linked orders.

Fixtures / admin import seed test data; no fake checkout.

## Audit actions (extend staff audit vocabulary)

`customer.invited`, `customer.blocked`, `customer.unblocked`, `customer.profile_updated`, `customer.company_updated`, `guest.conversion_invited`, `guest.linked_existing`, `order.imported`, `commerce.fixtures_seeded`.
