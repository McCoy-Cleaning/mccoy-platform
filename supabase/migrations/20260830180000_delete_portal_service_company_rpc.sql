-- Allow privileged portal company deletion via security-definer RPC.
-- App code calls this with service role; RLS/cascade edge cases are handled inside.

create or replace function private.delete_portal_service_company(p_company_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company public.companies%rowtype;
  v_order_count integer;
begin
  select * into v_company
  from public.companies
  where id = p_company_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'error', 'Bedrijf niet gevonden.');
  end if;

  if v_company.company_type is distinct from 'service_client' then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_service_client',
      'error', 'Alleen serviceklanten (portaal) kunnen hier worden verwijderd.'
    );
  end if;

  select count(*)::integer into v_order_count
  from public.orders
  where company_id = p_company_id;

  if v_order_count > 0 then
    return jsonb_build_object(
      'ok', false,
      'code', 'has_orders',
      'error', 'Bedrijf heeft orders — verwijderen geblokkeerd om orderhistorie te bewaren.'
    );
  end if;

  if v_company.external_customer_id is not null then
    delete from public.commerce_legacy_service_clients
    where external_customer_id = v_company.external_customer_id;
  end if;

  delete from private.customer_invitations
  where company_id = p_company_id;

  delete from public.company_users
  where company_id = p_company_id;

  delete from public.companies
  where id = p_company_id
    and company_type = 'service_client';

  if not found then
    return jsonb_build_object(
      'ok', false,
      'code', 'persist',
      'error', 'Verwijderen mislukt (geen rij verwijderd).'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'companyId', v_company.id,
    'legalName', v_company.legal_name,
    'externalCustomerId', v_company.external_customer_id
  );
end;
$$;

revoke all on function private.delete_portal_service_company(uuid) from public;
grant execute on function private.delete_portal_service_company(uuid) to service_role;

-- Public wrapper so PostgREST can expose it under /rest/v1/rpc
create or replace function public.delete_portal_service_company(p_company_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.delete_portal_service_company(p_company_id);
$$;

revoke all on function public.delete_portal_service_company(uuid) from public;
grant execute on function public.delete_portal_service_company(uuid) to service_role;

comment on function public.delete_portal_service_company(uuid) is
  'Staff/service-role only: delete a service_client company, mirror row, invites, and memberships.';
