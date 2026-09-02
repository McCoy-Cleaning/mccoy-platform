-- Fix optimistic-lock storm on draft bumps.
-- App calls cms_bump_draft_revision(text, integer, uuid) via saveDraft (p_site_id set).
-- An earlier live edit only changed the legacy (uuid, integer) overload, so conflicts
-- still raised on the text/uuid signature and drove retry / findPageRow load.

create or replace function public.cms_bump_draft_revision(
  p_page_id text,
  p_expected integer,
  p_site_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page_id uuid;
  v_next integer;
  v_current integer;
begin
  if p_site_id is not null then
    v_page_id := cms_resolve_page_id(p_site_id, p_page_id);
  else
    begin
      select id into v_page_id from cms_pages where id = p_page_id::uuid;
    exception
      when invalid_text_representation then
        select id into v_page_id from cms_pages where stable_key = p_page_id limit 1;
    end;
    if v_page_id is null then
      select id into v_page_id from cms_pages where stable_key = p_page_id limit 1;
    end if;
    if v_page_id is null then
      raise exception 'cms_bump_draft_revision: page not found (%)', p_page_id;
    end if;
  end if;

  if v_page_id is null then
    raise exception 'cms_bump_draft_revision: page not found (%)', p_page_id;
  end if;

  update cms_pages
  set draft_revision_number = draft_revision_number + 1, updated_at = now()
  where id = v_page_id and draft_revision_number = p_expected
  returning draft_revision_number into v_next;

  if v_next is not null then
    return v_next;
  end if;

  -- Conflict: do not raise (avoids exception + client retry storms). Return current.
  select draft_revision_number into v_current
  from cms_pages
  where id = v_page_id;

  if v_current is null then
    raise exception 'cms_bump_draft_revision: page not found (%)', p_page_id;
  end if;

  return v_current;
end;
$$;

revoke all on function public.cms_bump_draft_revision(text, integer, uuid) from public;
grant execute on function public.cms_bump_draft_revision(text, integer, uuid) to service_role;

-- Keep legacy overload consistent if anything still calls it.
create or replace function public.cms_bump_draft_revision(
  p_page_id uuid,
  p_expected integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
  v_current integer;
begin
  update cms_pages
  set draft_revision_number = draft_revision_number + 1, updated_at = now()
  where id = p_page_id and draft_revision_number = p_expected
  returning draft_revision_number into v_next;

  if v_next is not null then
    return v_next;
  end if;

  select draft_revision_number into v_current
  from cms_pages
  where id = p_page_id;

  if v_current is null then
    raise exception 'cms_bump_draft_revision: page not found (%)', p_page_id;
  end if;

  return v_current;
end;
$$;

revoke all on function public.cms_bump_draft_revision(uuid, integer) from public;
grant execute on function public.cms_bump_draft_revision(uuid, integer) to service_role;
