-- Purge Referenties / custom CMS page safely.
-- WHY YOU CAN'T CLICK DELETE: published/superseded revisions are immutable.
-- You must ARCHIVE them first, then DELETE. Builtin pages are not touched.

begin;

-- 1) Resolve page(s) from the stuck revision and/or /referenties paths
create temporary table tmp_purge_pages on commit drop as
select distinct p.id as page_id, p.site_id, p.kind, p.stable_key
from cms_pages p
where p.kind = 'custom'
  and (
    p.id in (
      select r.page_id
      from cms_page_revisions r
      where r.id = '619104bc-02fa-4269-a387-4d51c59a85c2'
    )
    or p.id in (
      select s.page_id
      from cms_page_locale_states s
      where s.path ilike '%referenties%'
         or s.public_path ilike '%referenties%'
    )
    or p.stable_key ilike '%refer%'
  );

-- Safety: abort if somehow a non-custom slipped in
do $$
begin
  if exists (select 1 from tmp_purge_pages where kind is distinct from 'custom') then
    raise exception 'refusing to purge non-custom pages';
  end if;
  if not exists (select 1 from tmp_purge_pages) then
    raise notice 'no custom referenties page found — will still try orphan revision cleanup';
  end if;
end $$;

-- 2) Redirects for owned paths
delete from cms_redirects r
using tmp_purge_pages t
where r.site_id = t.site_id
  and (
    r.page_id = t.page_id
    or r.from_path in (
      select coalesce(path, public_path)
      from cms_page_locale_states
      where page_id = t.page_id
    )
    or r.to_path in (
      select coalesce(path, public_path)
      from cms_page_locale_states
      where page_id = t.page_id
    )
  );

-- 3) Outbox events
delete from cms_outbox o
using tmp_purge_pages t
where o.site_id = t.site_id
  and (
    o.payload->>'pageId' = t.stable_key
    or o.payload->>'pageId' = t.page_id::text
  );

-- 4) Break FK to active published revision
update cms_pages p
set active_published_revision_id = null, updated_at = now()
from tmp_purge_pages t
where p.id = t.page_id;

-- 5) REQUIRED: archive immutable revisions before DELETE
update cms_page_revisions r
set status = 'archived'
from tmp_purge_pages t
where r.page_id = t.page_id
  and r.site_id = t.site_id
  and r.status in ('published', 'superseded');

-- Also archive the specific stuck revision if orphaned
update cms_page_revisions
set status = 'archived'
where id = '619104bc-02fa-4269-a387-4d51c59a85c2'
  and status in ('published', 'superseded');

-- 6) Delete revisions, locale states, pages
delete from cms_page_revisions r
using tmp_purge_pages t
where r.page_id = t.page_id and r.site_id = t.site_id;

delete from cms_page_revisions
where id = '619104bc-02fa-4269-a387-4d51c59a85c2';

delete from cms_page_locale_states s
using tmp_purge_pages t
where s.page_id = t.page_id and s.site_id = t.site_id;

delete from cms_pages p
using tmp_purge_pages t
where p.id = t.page_id;

commit;

-- Verify
select 'pages' as what, count(*)::int as n from cms_pages
where kind = 'custom' and (
  stable_key ilike '%refer%'
  or id in (select page_id from cms_page_locale_states where path ilike '%referenties%')
)
union all
select 'revision', count(*)::int from cms_page_revisions
where id = '619104bc-02fa-4269-a387-4d51c59a85c2';
