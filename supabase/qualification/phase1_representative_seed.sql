-- Representative Phase 1 commerce state for migration upgrade qualification.
-- Run ONLY on a database that has applied migrations through 20260821220000
-- (before 20260822120000_commerce_foundation_phase2_customer_portal.sql).
-- Uses owner/member roles and no company_users.status column.

\set ON_ERROR_STOP on

-- Fixed IDs for deterministic before/after comparison
-- Companies
INSERT INTO public.companies (
  id, legal_name, display_name, company_type, status, invoice_allowed, email, kvk_number
) VALUES
  (
    'a1111111-1111-4111-8111-111111111101',
    'Phase1 Product BV',
    'Product Co',
    'product_customer',
    'active',
    false,
    'product@phase1-qual.test',
    '12345678'
  ),
  (
    'a1111111-1111-4111-8111-111111111102',
    'Phase1 Service BV',
    'ABC Facility',
    'service_client',
    'active',
    true,
    'abc@phase1-qual.test',
    '87654321'
  )
ON CONFLICT (id) DO NOTHING;

-- Auth + public.users (customer profiles)
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES
  (
    'b1111111-1111-4111-8111-111111111101',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'owner@phase1-qual.test',
    crypt('qual-phase1-password', gen_salt('bf')),
    timezone('utc', now()),
    '{"account_kind":"customer"}'::jsonb,
    '{"full_name":"Phase1 Owner"}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now()),
    '', '', '', ''
  ),
  (
    'b1111111-1111-4111-8111-111111111102',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'member@phase1-qual.test',
    crypt('qual-phase1-password', gen_salt('bf')),
    timezone('utc', now()),
    '{"account_kind":"customer"}'::jsonb,
    '{"full_name":"Phase1 Member"}'::jsonb,
    timezone('utc', now()),
    timezone('utc', now()),
    '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, account_kind, status, email, full_name)
VALUES
  ('b1111111-1111-4111-8111-111111111101', 'customer', 'active', 'owner@phase1-qual.test', 'Phase1 Owner'),
  ('b1111111-1111-4111-8111-111111111102', 'customer', 'active', 'member@phase1-qual.test', 'Phase1 Member')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.company_users (company_id, user_id, role)
VALUES
  ('a1111111-1111-4111-8111-111111111101', 'b1111111-1111-4111-8111-111111111101', 'owner'),
  ('a1111111-1111-4111-8111-111111111101', 'b1111111-1111-4111-8111-111111111102', 'member'),
  ('a1111111-1111-4111-8111-111111111102', 'b1111111-1111-4111-8111-111111111101', 'owner')
ON CONFLICT (company_id, user_id) DO NOTHING;

INSERT INTO public.guest_purchasers (
  id, email_normalized, email_display, full_name, company_name
) VALUES (
  'c1111111-1111-4111-8111-111111111101',
  'guest@phase1-qual.test',
  'guest@phase1-qual.test',
  'Phase1 Guest',
  'Guest Shop'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.orders (
  id, number, company_id, customer_user_id, guest_purchaser_id,
  purchaser_email, purchaser_email_normalized, purchaser_name,
  currency, subtotal_minor, tax_minor, total_minor,
  order_status, payment_status, fulfilment_status, source
) VALUES (
  'd1111111-1111-4111-8111-111111111101',
  'ORD-P1-QUAL-001',
  'a1111111-1111-4111-8111-111111111101',
  'b1111111-1111-4111-8111-111111111101',
  NULL,
  'owner@phase1-qual.test',
  'owner@phase1-qual.test',
  'Phase1 Owner',
  'EUR',
  10000,
  2100,
  12100,
  'completed',
  'paid',
  'fulfilled',
  'fixture'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.order_items (
  id, order_id, line_number, sku, name, quantity,
  unit_price_minor, tax_rate_bps, tax_minor, line_total_minor
) VALUES (
  'e1111111-1111-4111-8111-111111111101',
  'd1111111-1111-4111-8111-111111111101',
  1,
  'SKU-P1',
  'Phase1 Product Line',
  2,
  5000,
  2100,
  2100,
  12100
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.payments (
  id, order_id, provider, provider_payment_id, amount_minor, currency, status
) VALUES (
  'f1111111-1111-4111-8111-111111111101',
  'd1111111-1111-4111-8111-111111111101',
  'fixture',
  'pay-p1-qual-001',
  12100,
  'EUR',
  'paid'
) ON CONFLICT (id) DO NOTHING;
