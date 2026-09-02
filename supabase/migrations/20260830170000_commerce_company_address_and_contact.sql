-- Company address + contact person for existing-customer import (mirror -> companies).
-- Import-owned: may be overwritten on re-import. Billing / payment fields deferred.

alter table public.companies
  add column if not exists contact_person_name text,
  add column if not exists address_street text,
  add column if not exists address_house_number text,
  add column if not exists address_house_suffix text,
  add column if not exists address_postal_code text,
  add column if not exists address_city text,
  add column if not exists address_country text;

comment on column public.companies.contact_person_name is
  'Optional contact person from import; used as invitee name hint for Account Admin invite.';
comment on column public.companies.address_street is
  'Import-owned company street (not a full address table).';

alter table public.commerce_legacy_service_clients
  add column if not exists contact_person_name text,
  add column if not exists address_street text,
  add column if not exists address_house_number text,
  add column if not exists address_house_suffix text,
  add column if not exists address_postal_code text,
  add column if not exists address_city text,
  add column if not exists address_country text;

comment on column public.commerce_legacy_service_clients.contact_person_name is
  'Contact person from operator CSV/XLSX; synced onto companies and invitee name fields.';
