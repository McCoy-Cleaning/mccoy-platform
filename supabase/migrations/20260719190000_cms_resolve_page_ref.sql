-- Phase B — resolve opaque CMS page refs (page_home, custom_*) to UUID PKs.
-- Application CmsPage.id stays a string; cms_pages.id remains uuid with stable_key.

create or replace function cms_resolve_page_id(
  p_site_id uuid,
  p_page_ref text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_page_ref is null or length(trim(p_page_ref)) = 0 then
    raise exception 'cms_resolve_page_id: empty page ref';
  end if;

  -- Prefer UUID primary key when the ref is a valid uuid and exists for this site.
  begin
    select id into v_id
    from cms_pages
    where site_id = p_site_id and id = p_page_ref::uuid;
    if found then
      return v_id;
    end if;
  exception
    when invalid_text_representation then
      null; -- opaque string id (page_home, custom_*, …)
  end;

  select id into v_id
  from cms_pages
  where site_id = p_site_id and stable_key = p_page_ref;

  if not found then
    raise exception 'cms_resolve_page_id: page not found (%)', p_page_ref;
  end if;

  return v_id;
end;
$$;

revoke all on function cms_resolve_page_id(uuid, text) from public;
grant execute on function cms_resolve_page_id(uuid, text) to service_role;

-- Drop uuid-typed overloads so PostgREST binds the text page-ref versions.
drop function if exists cms_publish_page(uuid, uuid, jsonb, text[], text[], uuid, integer);
drop function if exists cms_rollback_page(uuid, uuid, uuid, uuid);
drop function if exists cms_bump_draft_revision(uuid, integer);

create or replace function cms_publish_page(
  p_site_id uuid,
  p_page_id text,
  p_payload jsonb,
  p_published_locales text[],
  p_changed_paths text[],
  p_created_by uuid default null,
  p_expected_draft_revision integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page_id uuid;
  v_page cms_pages%rowtype;
  v_prev_revision_id uuid;
  v_new_revision_id uuid;
  v_revision_number integer;
  v_event_id uuid := gen_random_uuid();
  v_locale text;
  v_paths jsonb;
  v_locale_states jsonb;
  v_path text;
  v_public_path text;
  v_pub_state text;
  v_freshness text;
  v_occurred_at timestamptz := now();
  v_app_page_id text;
begin
  v_page_id := cms_resolve_page_id(p_site_id, p_page_id);

  select * into v_page from cms_pages where id = v_page_id and site_id = p_site_id for update;
  if not found then
    raise exception 'cms_publish_page: page not found';
  end if;

  v_app_page_id := coalesce(v_page.stable_key, v_page.id::text);

  if p_expected_draft_revision is not null
     and v_page.draft_revision_number is distinct from p_expected_draft_revision then
    raise exception 'cms_publish_page: draft revision conflict (expected %, got %)',
      p_expected_draft_revision, v_page.draft_revision_number
      using errcode = '40001';
  end if;

  v_prev_revision_id := v_page.active_published_revision_id;

  if v_prev_revision_id is not null then
    update cms_page_revisions
    set status = 'superseded'
    where id = v_prev_revision_id and status = 'published';
  end if;

  select coalesce(max(revision_number), 0) + 1
    into v_revision_number
  from cms_page_revisions
  where page_id = v_page_id;

  insert into cms_page_revisions (
    id, site_id, page_id, revision_number, status, payload, created_by, published_at
  ) values (
    gen_random_uuid(), p_site_id, v_page_id, v_revision_number, 'published',
    p_payload, p_created_by, v_occurred_at
  )
  returning id into v_new_revision_id;

  update cms_pages
  set
    active_published_revision_id = v_new_revision_id,
    is_draft_only = false,
    draft_revision_number = draft_revision_number + 1,
    updated_at = v_occurred_at,
    in_nav = coalesce((p_payload->>'inNav')::boolean, in_nav)
  where id = v_page_id;

  v_paths := coalesce(p_payload->'paths', '{}'::jsonb);
  v_locale_states := coalesce(p_payload->'localeStates', '{}'::jsonb);

  foreach v_locale in array p_published_locales
  loop
    v_path := coalesce(v_paths->>v_locale, v_paths->>'nl', '/');
    if v_locale = 'en' then
      if v_path like '/en%' then
        v_public_path := v_path;
      elsif v_path = '/' then
        v_public_path := '/en';
      else
        v_public_path := '/en' || v_path;
      end if;
    else
      v_public_path := v_path;
    end if;

    v_pub_state := coalesce(v_locale_states->v_locale->>'publicationState', 'published');
    v_freshness := coalesce(v_locale_states->v_locale->>'freshness', 'current');

    insert into cms_page_locale_states (
      page_id, site_id, locale, publication_state, freshness, path, public_path
    ) values (
      v_page_id, p_site_id, v_locale, v_pub_state, v_freshness, v_path, v_public_path
    )
    on conflict (page_id, locale) do update set
      publication_state = excluded.publication_state,
      freshness = excluded.freshness,
      path = excluded.path,
      public_path = excluded.public_path;
  end loop;

  if v_locale_states ? 'en' and not ('en' = any (p_published_locales)) then
    v_path := coalesce(v_paths->>'en', v_paths->>'nl', '/');
    if v_path like '/en%' then
      v_public_path := v_path;
    elsif v_path = '/' then
      v_public_path := '/en';
    else
      v_public_path := '/en' || v_path;
    end if;
    insert into cms_page_locale_states (
      page_id, site_id, locale, publication_state, freshness, path, public_path
    ) values (
      v_page_id,
      p_site_id,
      'en',
      coalesce(v_locale_states->'en'->>'publicationState', 'missing'),
      coalesce(v_locale_states->'en'->>'freshness', 'unknown'),
      v_path,
      v_public_path
    )
    on conflict (page_id, locale) do update set
      publication_state = excluded.publication_state,
      freshness = excluded.freshness,
      path = excluded.path,
      public_path = excluded.public_path;
  end if;

  insert into cms_outbox (id, site_id, event_type, payload)
  values (
    v_event_id,
    p_site_id,
    'cms.page.published',
    jsonb_build_object(
      'eventId', v_event_id::text,
      'siteId', p_site_id::text,
      'pageId', v_app_page_id,
      'revisionId', v_new_revision_id::text,
      'publishedLocales', to_jsonb(p_published_locales),
      'changedPaths', to_jsonb(p_changed_paths),
      'occurredAt', to_char(v_occurred_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
    )
  );

  update cms_sites set config_version = config_version + 1, updated_at = v_occurred_at
  where id = p_site_id;

  return jsonb_build_object(
    'revisionId', v_new_revision_id,
    'revisionNumber', v_revision_number,
    'eventId', v_event_id,
    'draftRevisionNumber', (select draft_revision_number from cms_pages where id = v_page_id)
  );
end;
$$;

revoke all on function cms_publish_page(uuid, text, jsonb, text[], text[], uuid, integer) from public;
grant execute on function cms_publish_page(uuid, text, jsonb, text[], text[], uuid, integer) to service_role;

create or replace function cms_rollback_page(
  p_site_id uuid,
  p_page_id text,
  p_target_revision_id uuid,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_page_id uuid;
  v_target cms_page_revisions%rowtype;
  v_payload jsonb;
  v_locales text[] := array[]::text[];
  v_paths text[] := array[]::text[];
  v_nl_state text;
  v_en_state text;
begin
  v_page_id := cms_resolve_page_id(p_site_id, p_page_id);

  select * into v_target
  from cms_page_revisions
  where id = p_target_revision_id and page_id = v_page_id and site_id = p_site_id;

  if not found then
    raise exception 'cms_rollback_page: target revision not found';
  end if;

  v_payload := v_target.payload;
  v_nl_state := coalesce(v_payload->'localeStates'->'nl'->>'publicationState', 'published');
  v_en_state := coalesce(v_payload->'localeStates'->'en'->>'publicationState', 'missing');

  if v_nl_state = 'published' then
    v_locales := array_append(v_locales, 'nl');
    v_paths := array_append(v_paths, coalesce(v_payload->'paths'->>'nl', '/'));
  end if;
  if v_en_state = 'published' then
    v_locales := array_append(v_locales, 'en');
    v_paths := array_append(
      v_paths,
      coalesce(v_payload->'paths'->>'en', v_payload->'paths'->>'nl', '/')
    );
  end if;

  return cms_publish_page(
    p_site_id,
    p_page_id,
    v_payload,
    v_locales,
    v_paths,
    p_created_by,
    null
  );
end;
$$;

revoke all on function cms_rollback_page(uuid, text, uuid, uuid) from public;
grant execute on function cms_rollback_page(uuid, text, uuid, uuid) to service_role;

create or replace function cms_bump_draft_revision(
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

  update cms_pages
  set draft_revision_number = draft_revision_number + 1, updated_at = now()
  where id = v_page_id and draft_revision_number = p_expected
  returning draft_revision_number into v_next;

  if v_next is null then
    raise exception 'cms_bump_draft_revision: conflict'
      using errcode = '40001';
  end if;
  return v_next;
end;
$$;

revoke all on function cms_bump_draft_revision(text, integer, uuid) from public;
grant execute on function cms_bump_draft_revision(text, integer, uuid) to service_role;
