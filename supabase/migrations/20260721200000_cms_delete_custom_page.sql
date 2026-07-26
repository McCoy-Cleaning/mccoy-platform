-- Safe delete for custom CMS pages.
-- Published/superseded revisions are immutable (cannot DELETE). Archive them first,
-- then cascade-delete the page and dependents. Builtin pages are rejected.

create or replace function cms_delete_custom_page(
  p_site_id uuid,
  p_page_ref text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page cms_pages%rowtype;
  v_found boolean := false;
  v_app_page_id text;
  v_owned_paths text[] := array[]::text[];
begin
  if p_page_ref is null or length(trim(p_page_ref)) = 0 then
    raise exception 'cms_delete_custom_page: empty page ref';
  end if;

  -- Resolve UUID PK or stable_key without raising when missing (idempotent delete).
  begin
    select * into v_page
    from cms_pages
    where site_id = p_site_id and id = p_page_ref::uuid
    for update;
    v_found := found;
  exception
    when invalid_text_representation then
      v_found := false;
  end;

  if not v_found then
    select * into v_page
    from cms_pages
    where site_id = p_site_id and stable_key = p_page_ref
    for update;
    v_found := found;
  end if;

  if not v_found then
    return jsonb_build_object('deleted', false);
  end if;

  if v_page.kind is distinct from 'custom' then
    raise exception 'cms_delete_custom_page: only custom pages can be deleted (got %)', v_page.kind
      using errcode = 'P0001';
  end if;

  v_app_page_id := coalesce(v_page.stable_key, v_page.id::text);

  select coalesce(array_agg(distinct p), array[]::text[])
    into v_owned_paths
  from (
    select path as p from cms_page_locale_states where page_id = v_page.id and site_id = p_site_id
    union
    select public_path as p from cms_page_locale_states where page_id = v_page.id and site_id = p_site_id
  ) paths
  where p is not null and length(trim(p)) > 0;

  -- Redirects owned by this page or pointing at/from its paths.
  delete from cms_redirects
  where site_id = p_site_id
    and (
      page_id = v_page.id
      or from_path = any (v_owned_paths)
      or to_path = any (v_owned_paths)
    );

  -- Outbox events keyed by app page id (stable_key) or UUID.
  delete from cms_outbox
  where site_id = p_site_id
    and (
      payload->>'pageId' = v_app_page_id
      or payload->>'pageId' = v_page.id::text
      or payload->>'pageId' = p_page_ref
    );

  -- Break circular FK before revision cleanup.
  update cms_pages
  set
    active_published_revision_id = null,
    updated_at = now()
  where id = v_page.id;

  -- Immutability trigger allows published/superseded → archived, then DELETE.
  update cms_page_revisions
  set status = 'archived'
  where page_id = v_page.id
    and site_id = p_site_id
    and status in ('published', 'superseded');

  -- Explicit revision delete (archived/draft/review are deletable).
  delete from cms_page_revisions
  where page_id = v_page.id
    and site_id = p_site_id;

  -- Locale states cascade from page, but delete explicitly for clarity.
  delete from cms_page_locale_states
  where page_id = v_page.id
    and site_id = p_site_id;

  delete from cms_pages
  where id = v_page.id
    and site_id = p_site_id;

  return jsonb_build_object(
    'deleted', true,
    'pageId', v_app_page_id,
    'pageUuid', v_page.id
  );
end;
$$;

revoke all on function cms_delete_custom_page(uuid, text) from public;
grant execute on function cms_delete_custom_page(uuid, text) to service_role;
