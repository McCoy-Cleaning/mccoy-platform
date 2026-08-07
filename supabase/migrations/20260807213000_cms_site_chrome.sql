-- Persist published site chrome (navigation + footer) on cms_sites.
-- Storefront cold loads previously only received pages, so logo heights and
-- other nav/footer chrome reset to defaults after reload.

alter table cms_sites
  add column if not exists navigation jsonb,
  add column if not exists footer jsonb;

comment on column cms_sites.navigation is
  'Published site navigation chrome (logo, heights, links, CTAs). Null until first admin Opslaan.';
comment on column cms_sites.footer is
  'Published site footer chrome. Null until first admin Opslaan.';
