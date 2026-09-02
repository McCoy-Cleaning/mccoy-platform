-- Reverts Commerce Phase 2 schema on an isolated qualification clone only.
-- NEVER run against production postgres.

\set ON_ERROR_STOP on

DROP FUNCTION IF EXISTS public.transfer_company_account_admin(uuid, uuid, uuid);

DROP POLICY IF EXISTS company_users_select_own ON public.company_users;
DROP POLICY IF EXISTS companies_select_member ON public.companies;
DROP POLICY IF EXISTS orders_select_own_customer ON public.orders;
DROP POLICY IF EXISTS order_items_select_own_order ON public.order_items;

DROP TABLE IF EXISTS private.commerce_email_outbox;
DROP TABLE IF EXISTS private.customer_invitations;

DROP TYPE IF EXISTS private.customer_invitation_status;
DROP TYPE IF EXISTS private.customer_inviter_type;

DROP INDEX IF EXISTS private.customer_invitations_one_pending_admin_per_company_uq;
DROP INDEX IF EXISTS public.company_users_one_active_admin_uq;
DROP INDEX IF EXISTS public.companies_external_customer_id_uq;

ALTER TABLE public.companies DROP COLUMN IF EXISTS external_customer_id;
DROP TABLE IF EXISTS public.commerce_legacy_service_clients;

ALTER TABLE public.company_users DROP COLUMN IF EXISTS status;
ALTER TABLE public.company_users DROP COLUMN IF EXISTS updated_at;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'company_member_role' AND e.enumlabel = 'account_admin'
  ) THEN
    ALTER TYPE public.company_member_role RENAME VALUE 'account_admin' TO 'owner';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'company_member_role' AND e.enumlabel = 'account_user'
  ) THEN
    ALTER TYPE public.company_member_role RENAME VALUE 'account_user' TO 'member';
  END IF;
END $$;

DROP TYPE IF EXISTS public.company_member_status;

DROP FUNCTION IF EXISTS private.current_user_is_active_customer_member(uuid);
DROP FUNCTION IF EXISTS private.current_user_is_company_account_admin(uuid);
DROP FUNCTION IF EXISTS private.transfer_company_account_admin(uuid, uuid, uuid);
