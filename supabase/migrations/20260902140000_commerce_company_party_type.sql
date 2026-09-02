-- Party type: company (bedrijf) vs private person (particulier) for existing
-- service-client imports and portal display. Does not change company_type
-- (product_customer | service_client) or checkout eligibility rules.

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'company_party_type'
  ) then
    create type public.company_party_type as enum ('company', 'private_person');
  end if;
end $$;

alter table public.companies
  add column if not exists party_type public.company_party_type not null default 'company';

comment on column public.companies.party_type is
  'Legal-party classification: company (bedrijf) or private_person (particulier). Import-owned for service clients; independent of company_type.';

alter table public.commerce_legacy_service_clients
  add column if not exists party_type public.company_party_type not null default 'company';

comment on column public.commerce_legacy_service_clients.party_type is
  'Import-owned party classification synced onto companies.party_type.';

create index if not exists companies_party_type_idx on public.companies (party_type);
