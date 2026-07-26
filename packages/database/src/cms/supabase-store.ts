/**
 * Supabase-backed CMS store. Uses service-role client + publish RPCs.
 * Falls back to file store methods for operations not yet RPC-covered when needed.
 */
import {
  ensurePageLocaleFields,
  normalizeCmsPath,
  type CmsPage,
  type CmsPagePublishedEvent,
  type Locale,
} from "@mccoy/cms-schema";

import { createSupabaseServiceClient, hasSupabaseServiceConfig } from "../supabase";
import { getFileCmsStore } from "./file-store";
import {
  cmsPageRecordId,
  cmsPageStableKey,
  isCmsUuid,
  uuidOrNull,
} from "./page-id";
import {
  DEFAULT_CMS_SITE_ID,
  type CmsLocaleStateRecord,
  type CmsOutboxRecord,
  type CmsPageRecord,
  type CmsPublishedLookup,
  type CmsRedirectRecord,
  type CmsRevisionRecord,
  type CmsSiteRecord,
  type CmsStore,
  type PublishPageInput,
  type PublishPageResult,
  type RollbackPageInput,
  type UpsertPageInput,
  type DeletePageInput,
  type DeletePageResult,
} from "./types";

type SiteRow = {
  id: string;
  slug: string;
  origin: string;
  config_version: number;
  created_at: string;
  updated_at: string;
};

type PageRow = {
  id: string;
  site_id: string;
  stable_key: string | null;
  kind: "builtin" | "custom";
  page_key: string | null;
  in_nav: boolean;
  is_draft_only: boolean;
  draft_revision_number: number;
  active_published_revision_id: string | null;
  created_at: string;
  updated_at: string;
};

type RevisionRow = {
  id: string;
  site_id: string;
  page_id: string;
  revision_number: number;
  status: CmsRevisionRecord["status"];
  payload: CmsPage;
  created_at: string;
  created_by: string | null;
  published_at: string | null;
};

type LocaleRow = {
  page_id: string;
  site_id: string;
  locale: Locale;
  publication_state: CmsLocaleStateRecord["publicationState"];
  freshness: CmsLocaleStateRecord["freshness"];
  path: string;
  public_path: string;
};

function mapSite(row: SiteRow): CmsSiteRecord {
  return {
    id: row.id,
    slug: row.slug,
    origin: row.origin,
    configVersion: row.config_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPage(row: PageRow): CmsPageRecord {
  return {
    id: cmsPageRecordId(row),
    siteId: row.site_id,
    stableKey: row.stable_key,
    kind: row.kind,
    pageKey: row.page_key,
    inNav: row.in_nav,
    isDraftOnly: row.is_draft_only,
    draftRevisionNumber: row.draft_revision_number,
    activePublishedRevisionId: row.active_published_revision_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRevision(row: RevisionRow, appPageId?: string): CmsRevisionRecord {
  return {
    id: row.id,
    siteId: row.site_id,
    pageId: appPageId ?? row.page_id,
    revisionNumber: row.revision_number,
    status: row.status,
    payload: ensurePageLocaleFields(row.payload),
    createdAt: row.created_at,
    createdBy: row.created_by,
    publishedAt: row.published_at,
  };
}

function mapLocale(row: LocaleRow, appPageId?: string): CmsLocaleStateRecord {
  return {
    pageId: appPageId ?? row.page_id,
    siteId: row.site_id,
    locale: row.locale,
    publicationState: row.publication_state,
    freshness: row.freshness,
    path: row.path,
    publicPath: row.public_path,
  };
}

type ServiceClient = ReturnType<typeof createSupabaseServiceClient>;

/** Resolve opaque app page id (page_home) or UUID to the cms_pages row. */
async function findPageRow(
  supabase: ServiceClient,
  siteId: string,
  pageRef: string,
): Promise<PageRow | null> {
  if (isCmsUuid(pageRef)) {
    const byId = await supabase
      .from("cms_pages")
      .select("*")
      .eq("site_id", siteId)
      .eq("id", pageRef)
      .maybeSingle();
    if (byId.error) throw new Error(`cms findPage: ${byId.error.message}`);
    if (byId.data) return byId.data as PageRow;
  }

  const byKey = await supabase
    .from("cms_pages")
    .select("*")
    .eq("site_id", siteId)
    .eq("stable_key", pageRef)
    .maybeSingle();
  if (byKey.error) throw new Error(`cms findPage: ${byKey.error.message}`);
  return byKey.data ? (byKey.data as PageRow) : null;
}

/**
 * Fallback when cms_delete_custom_page RPC is not yet migrated.
 * Archives immutable revisions before delete so the immutability trigger allows cleanup.
 */
async function deleteCustomPageClientSide(
  supabase: ServiceClient,
  siteId: string,
  row: PageRow,
  appPageId: string,
  pageRef: string,
): Promise<void> {
  const { data: localeRows, error: localeErr } = await supabase
    .from("cms_page_locale_states")
    .select("path, public_path")
    .eq("page_id", row.id)
    .eq("site_id", siteId);
  if (localeErr) throw new Error(`cms deletePage locales: ${localeErr.message}`);

  const ownedPaths = new Set<string>();
  for (const loc of (localeRows ?? []) as Array<{ path: string; public_path: string }>) {
    if (loc.path) ownedPaths.add(loc.path);
    if (loc.public_path) ownedPaths.add(loc.public_path);
  }

  const { data: redirectRows, error: redirectListErr } = await supabase
    .from("cms_redirects")
    .select("id, page_id, from_path, to_path")
    .eq("site_id", siteId);
  if (redirectListErr) {
    throw new Error(`cms deletePage redirects: ${redirectListErr.message}`);
  }
  const redirectIds = ((redirectRows ?? []) as Array<{
    id: string;
    page_id: string | null;
    from_path: string;
    to_path: string;
  }>)
    .filter(
      (r) =>
        r.page_id === row.id ||
        ownedPaths.has(r.from_path) ||
        ownedPaths.has(r.to_path),
    )
    .map((r) => r.id);
  if (redirectIds.length > 0) {
    const { error: redirectDelErr } = await supabase
      .from("cms_redirects")
      .delete()
      .in("id", redirectIds);
    if (redirectDelErr) {
      throw new Error(`cms deletePage redirects: ${redirectDelErr.message}`);
    }
  }

  const { data: outboxRows, error: outboxListErr } = await supabase
    .from("cms_outbox")
    .select("id, payload")
    .eq("site_id", siteId);
  if (outboxListErr) throw new Error(`cms deletePage outbox: ${outboxListErr.message}`);
  const outboxIds = ((outboxRows ?? []) as Array<{ id: string; payload: { pageId?: string } }>)
    .filter(
      (o) =>
        o.payload?.pageId === appPageId ||
        o.payload?.pageId === pageRef ||
        o.payload?.pageId === row.id,
    )
    .map((o) => o.id);
  if (outboxIds.length > 0) {
    const { error: outboxDelErr } = await supabase.from("cms_outbox").delete().in("id", outboxIds);
    if (outboxDelErr) throw new Error(`cms deletePage outbox: ${outboxDelErr.message}`);
  }

  const { error: clearErr } = await supabase
    .from("cms_pages")
    .update({ active_published_revision_id: null, updated_at: new Date().toISOString() })
    .eq("id", row.id);
  if (clearErr) throw new Error(`cms deletePage clear revision: ${clearErr.message}`);

  // Immutability trigger blocks DELETE of published/superseded; archive first.
  const { error: archiveErr } = await supabase
    .from("cms_page_revisions")
    .update({ status: "archived" })
    .eq("page_id", row.id)
    .eq("site_id", siteId)
    .in("status", ["published", "superseded"]);
  if (archiveErr) throw new Error(`cms deletePage archive revisions: ${archiveErr.message}`);

  const { error: revDelErr } = await supabase
    .from("cms_page_revisions")
    .delete()
    .eq("page_id", row.id)
    .eq("site_id", siteId);
  if (revDelErr) throw new Error(`cms deletePage revisions: ${revDelErr.message}`);

  const { error: localeDelErr } = await supabase
    .from("cms_page_locale_states")
    .delete()
    .eq("page_id", row.id)
    .eq("site_id", siteId);
  if (localeDelErr) throw new Error(`cms deletePage locale states: ${localeDelErr.message}`);

  const { error: pageDelErr } = await supabase.from("cms_pages").delete().eq("id", row.id);
  if (pageDelErr) throw new Error(`cms deletePage: ${pageDelErr.message}`);
}

export function createSupabaseCmsStore(): CmsStore {
  const fallback = getFileCmsStore();

  return {
    async getSite(siteId = DEFAULT_CMS_SITE_ID) {
      const supabase = createSupabaseServiceClient();
      const { data, error } = await supabase
        .from("cms_sites")
        .select("*")
        .or(`id.eq.${siteId},slug.eq.${siteId}`)
        .maybeSingle();
      if (error) throw new Error(`cms getSite: ${error.message}`);
      if (!data) throw new Error("cms site not found");
      return mapSite(data as SiteRow);
    },

    async listPages(siteId = DEFAULT_CMS_SITE_ID) {
      const supabase = createSupabaseServiceClient();
      const { data, error } = await supabase.from("cms_pages").select("*").eq("site_id", siteId);
      if (error) throw new Error(`cms listPages: ${error.message}`);
      return ((data ?? []) as PageRow[]).map(mapPage);
    },

    async getPage(pageId, siteId = DEFAULT_CMS_SITE_ID) {
      const supabase = createSupabaseServiceClient();
      const row = await findPageRow(supabase, siteId, pageId);
      return row ? mapPage(row) : null;
    },

    async upsertPage(input: UpsertPageInput) {
      const supabase = createSupabaseServiceClient();
      const page = ensurePageLocaleFields(input.page);
      const stableKey = cmsPageStableKey(page.id, input.stableKey);
      let existing = await findPageRow(supabase, input.siteId, stableKey);

      const fields = {
        site_id: input.siteId,
        stable_key: stableKey,
        kind: page.kind,
        page_key: page.kind === "builtin" ? page.pageKey : null,
        in_nav: page.inNav,
        is_draft_only: page.isDraftOnly ?? false,
        updated_at: new Date().toISOString(),
      };

      let data: PageRow | null = null;
      let error: { message: string; code?: string } | null = null;

      if (existing) {
        const updated = await supabase
          .from("cms_pages")
          .update(fields)
          .eq("id", existing.id)
          .select("*")
          .single();
        data = updated.data as PageRow | null;
        error = updated.error;
      } else {
        // Never insert opaque app ids into uuid PK. Prefer upsert on (site_id, stable_key)
        // so concurrent seed / missed lookups cannot trip cms_pages_site_id_stable_key_key.
        const upserted = await supabase
          .from("cms_pages")
          .upsert(fields, { onConflict: "site_id,stable_key" })
          .select("*")
          .single();
        data = upserted.data as PageRow | null;
        error = upserted.error;

        // Fallback if PostgREST rejects composite onConflict: re-read + update.
        if (
          error &&
          (error.message.includes("cms_pages_site_id_stable_key_key") ||
            error.message.includes("duplicate key"))
        ) {
          existing = await findPageRow(supabase, input.siteId, stableKey);
          if (existing) {
            const updated = await supabase
              .from("cms_pages")
              .update(fields)
              .eq("id", existing.id)
              .select("*")
              .single();
            data = updated.data as PageRow | null;
            error = updated.error;
          }
        }
      }

      if (error) throw new Error(`cms upsertPage: ${error.message}`);
      if (!data) throw new Error("cms upsertPage: no row returned");

      await fallback.upsertPage({ ...input, stableKey });
      return mapPage(data);
    },

    async getDraftPayload(pageId, siteId) {
      return fallback.getDraftPayload(pageId, siteId);
    },

    async saveDraft(command) {
      const supabase = createSupabaseServiceClient();
      const siteId = command.siteId ?? DEFAULT_CMS_SITE_ID;
      const pageRow = await findPageRow(supabase, siteId, command.pageId);
      if (!pageRow) {
        throw new Error(`cms saveDraft: page not found (${command.pageId})`);
      }
      const { data, error } = await supabase.rpc("cms_bump_draft_revision", {
        p_page_id: pageRow.id,
        p_expected: command.expectedRevisionNumber,
        p_site_id: siteId,
      });
      if (error) {
        if (error.message.includes("conflict") || error.code === "40001") {
          const err = new Error("cms draft: conflict");
          (err as Error & { code: string }).code = "conflict";
          throw err;
        }
        throw new Error(`cms saveDraft: ${error.message}`);
      }
      await fallback.saveDraft({
        ...command,
        expectedRevisionNumber: command.expectedRevisionNumber,
      });
      return { draftRevisionNumber: data as number };
    },

    async getActivePublishedRevision(pageId, siteId = DEFAULT_CMS_SITE_ID) {
      const supabase = createSupabaseServiceClient();
      const row = await findPageRow(supabase, siteId, pageId);
      if (!row?.active_published_revision_id) return null;
      const appPageId = cmsPageRecordId(row);
      const { data, error } = await supabase
        .from("cms_page_revisions")
        .select("*")
        .eq("id", row.active_published_revision_id)
        .maybeSingle();
      if (error) throw new Error(`cms getActivePublishedRevision: ${error.message}`);
      return data ? mapRevision(data as RevisionRow, appPageId) : null;
    },

    async listRevisions(pageId, siteId = DEFAULT_CMS_SITE_ID) {
      const supabase = createSupabaseServiceClient();
      const row = await findPageRow(supabase, siteId, pageId);
      if (!row) return [];
      const appPageId = cmsPageRecordId(row);
      const { data, error } = await supabase
        .from("cms_page_revisions")
        .select("*")
        .eq("page_id", row.id)
        .eq("site_id", siteId)
        .order("revision_number", { ascending: false });
      if (error) throw new Error(`cms listRevisions: ${error.message}`);
      return ((data ?? []) as RevisionRow[]).map((r) => mapRevision(r, appPageId));
    },

    async publishPage(input: PublishPageInput): Promise<PublishPageResult> {
      const supabase = createSupabaseServiceClient();
      const payload = ensurePageLocaleFields(input.payload);
      const changedPaths = input.publishedLocales.map((locale) => {
        const pathValue =
          locale === "en"
            ? payload.paths?.en ?? payload.paths?.nl ?? payload.slug
            : payload.paths?.nl ?? payload.slug;
        return normalizeCmsPath(locale, pathValue);
      });

      // Resolve opaque app ids (page_home, custom_*) → UUID PK before RPC.
      // Remote DBs may still have uuid-typed p_page_id if the text-ref migration
      // was not applied; passing page_home then fails with invalid uuid syntax.
      const pageRow = await findPageRow(supabase, input.siteId, input.pageId);
      if (!pageRow) {
        throw new Error(`cms publishPage: page not found (${input.pageId})`);
      }

      const { data, error } = await supabase.rpc("cms_publish_page", {
        p_site_id: input.siteId,
        p_page_id: pageRow.id,
        p_payload: payload,
        p_published_locales: input.publishedLocales,
        p_changed_paths: changedPaths,
        p_created_by: uuidOrNull(input.createdBy),
        p_expected_draft_revision: input.expectedDraftRevision ?? null,
      });
      if (error) {
        if (error.message.includes("conflict") || error.code === "40001") {
          const err = new Error("cms publish: conflict");
          (err as Error & { code: string }).code = "conflict";
          throw err;
        }
        throw new Error(`cms publishPage: ${error.message}`);
      }

      const result = data as {
        revisionId: string;
        revisionNumber: number;
        eventId: string;
        draftRevisionNumber: number;
      };

      await fallback.publishPage(input).catch(() => undefined);

      const event: CmsPagePublishedEvent = {
        eventId: result.eventId,
        siteId: input.siteId,
        pageId: input.pageId,
        revisionId: result.revisionId,
        publishedLocales: input.publishedLocales,
        changedPaths,
        occurredAt: new Date().toISOString(),
      };

      return {
        revisionId: result.revisionId,
        revisionNumber: result.revisionNumber,
        eventId: result.eventId,
        draftRevisionNumber: result.draftRevisionNumber,
        event,
      };
    },

    async rollbackPage(input: RollbackPageInput) {
      const supabase = createSupabaseServiceClient();
      const pageRow = await findPageRow(supabase, input.siteId, input.pageId);
      if (!pageRow) {
        throw new Error(`cms rollbackPage: page not found (${input.pageId})`);
      }
      const { data, error } = await supabase.rpc("cms_rollback_page", {
        p_site_id: input.siteId,
        p_page_id: pageRow.id,
        p_target_revision_id: input.targetRevisionId,
        p_created_by: uuidOrNull(input.createdBy),
      });
      if (error) throw new Error(`cms rollbackPage: ${error.message}`);
      const result = data as {
        revisionId: string;
        revisionNumber: number;
        eventId: string;
        draftRevisionNumber: number;
      };
      const event: CmsPagePublishedEvent = {
        eventId: result.eventId,
        siteId: input.siteId,
        pageId: input.pageId,
        revisionId: result.revisionId,
        publishedLocales: [],
        changedPaths: [],
        occurredAt: new Date().toISOString(),
      };
      return {
        revisionId: result.revisionId,
        revisionNumber: result.revisionNumber,
        eventId: result.eventId,
        draftRevisionNumber: result.draftRevisionNumber,
        event,
      };
    },

    async findPublishedByPublicPath(locale, publicPath, siteId = DEFAULT_CMS_SITE_ID) {
      const supabase = createSupabaseServiceClient();
      const normalized = normalizeCmsPath(locale, publicPath);
      const { data: localeRow, error } = await supabase
        .from("cms_page_locale_states")
        .select("*")
        .eq("site_id", siteId)
        .eq("locale", locale)
        .eq("public_path", normalized)
        .eq("publication_state", "published")
        .maybeSingle();
      if (error) throw new Error(`cms findPublishedByPublicPath: ${error.message}`);
      if (!localeRow) return null;

      const pageRow = await findPageRow(supabase, siteId, (localeRow as LocaleRow).page_id);
      if (!pageRow?.active_published_revision_id) return null;
      const appPageId = cmsPageRecordId(pageRow);
      const rev = await this.getActivePublishedRevision(appPageId, siteId);
      if (!rev) return null;
      const site = await this.getSite(siteId);
      return {
        page: rev.payload,
        revisionId: rev.id,
        publishedAt: rev.publishedAt ?? rev.createdAt,
        localeState: mapLocale(localeRow as LocaleRow, appPageId),
        site,
      } satisfies CmsPublishedLookup;
    },

    async listPublishedLocaleStates(siteId = DEFAULT_CMS_SITE_ID) {
      const supabase = createSupabaseServiceClient();
      const { data, error } = await supabase
        .from("cms_page_locale_states")
        .select("*")
        .eq("site_id", siteId)
        .eq("publication_state", "published");
      if (error) throw new Error(`cms listPublishedLocaleStates: ${error.message}`);
      const rows = (data ?? []) as LocaleRow[];
      const pageIds = [...new Set(rows.map((r) => r.page_id))];
      const appIdByDbId = new Map<string, string>();
      for (const dbId of pageIds) {
        const pageRow = await findPageRow(supabase, siteId, dbId);
        if (pageRow) appIdByDbId.set(dbId, cmsPageRecordId(pageRow));
      }
      return rows.map((r) => mapLocale(r, appIdByDbId.get(r.page_id)));
    },

    async listActiveRedirects(siteId = DEFAULT_CMS_SITE_ID) {
      const supabase = createSupabaseServiceClient();
      const { data, error } = await supabase
        .from("cms_redirects")
        .select("*")
        .eq("site_id", siteId)
        .is("retired_at", null);
      if (error) throw new Error(`cms listActiveRedirects: ${error.message}`);
      const rows = (data ?? []) as Array<{
        id: string;
        site_id: string;
        page_id: string | null;
        locale: Locale;
        from_path: string;
        to_path: string;
        status_code: 301 | 308;
        created_at: string;
        retired_at: string | null;
      }>;
      const pageIds = [...new Set(rows.map((r) => r.page_id).filter(Boolean))] as string[];
      const appIdByDbId = new Map<string, string>();
      for (const dbId of pageIds) {
        const pageRow = await findPageRow(supabase, siteId, dbId);
        if (pageRow) appIdByDbId.set(dbId, cmsPageRecordId(pageRow));
      }
      return rows.map((r) => ({
        id: r.id,
        siteId: r.site_id,
        pageId: r.page_id ? (appIdByDbId.get(r.page_id) ?? r.page_id) : null,
        locale: r.locale,
        fromPath: r.from_path,
        toPath: r.to_path,
        statusCode: r.status_code,
        createdAt: r.created_at,
        retiredAt: r.retired_at,
      }));
    },

    async upsertRedirect(redirect) {
      const supabase = createSupabaseServiceClient();
      const fromPath = normalizeCmsPath(redirect.locale, redirect.fromPath);
      const toPath = normalizeCmsPath(redirect.locale, redirect.toPath);
      if (fromPath === toPath) throw new Error("Redirect target cannot equal source.");

      let pageDbId: string | null = null;
      let appPageId: string | null = redirect.pageId;
      if (redirect.pageId) {
        const pageRow = await findPageRow(supabase, redirect.siteId, redirect.pageId);
        if (!pageRow) throw new Error(`cms upsertRedirect: page not found (${redirect.pageId})`);
        pageDbId = pageRow.id;
        appPageId = cmsPageRecordId(pageRow);
      }

      const redirectId = isCmsUuid(redirect.id) ? redirect.id : undefined;
      const { data, error } = await supabase
        .from("cms_redirects")
        .upsert(
          {
            ...(redirectId ? { id: redirectId } : {}),
            site_id: redirect.siteId,
            page_id: pageDbId,
            locale: redirect.locale,
            from_path: fromPath,
            to_path: toPath,
            status_code: redirect.statusCode,
            retired_at: redirect.retiredAt ?? null,
          },
          { onConflict: "site_id,locale,from_path" },
        )
        .select("*")
        .single();
      if (error) throw new Error(`cms upsertRedirect: ${error.message}`);
      const r = data as {
        id: string;
        site_id: string;
        page_id: string | null;
        locale: Locale;
        from_path: string;
        to_path: string;
        status_code: 301 | 308;
        created_at: string;
        retired_at: string | null;
      };
      return {
        id: r.id,
        siteId: r.site_id,
        pageId: appPageId,
        locale: r.locale,
        fromPath: r.from_path,
        toPath: r.to_path,
        statusCode: r.status_code,
        createdAt: r.created_at,
        retiredAt: r.retired_at,
      } satisfies CmsRedirectRecord;
    },

    async listUnprocessedOutbox(limit = 50) {
      const supabase = createSupabaseServiceClient();
      const { data, error } = await supabase
        .from("cms_outbox")
        .select("*")
        .is("processed_at", null)
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`cms listUnprocessedOutbox: ${error.message}`);
      return ((data ?? []) as Array<{
        id: string;
        site_id: string;
        event_type: string;
        payload: CmsPagePublishedEvent;
        created_at: string;
        processed_at: string | null;
        attempts: number;
      }>).map(
        (o) =>
          ({
            id: o.id,
            siteId: o.site_id,
            eventType: o.event_type,
            payload: o.payload,
            createdAt: o.created_at,
            processedAt: o.processed_at,
            attempts: o.attempts,
          }) satisfies CmsOutboxRecord,
      );
    },

    async markOutboxProcessed(eventId) {
      const supabase = createSupabaseServiceClient();
      const { error } = await supabase
        .from("cms_outbox")
        .update({
          processed_at: new Date().toISOString(),
          attempts: 1,
        })
        .eq("id", eventId);
      if (error) throw new Error(`cms markOutboxProcessed: ${error.message}`);
    },

    async deletePage(input: DeletePageInput): Promise<DeletePageResult> {
      const supabase = createSupabaseServiceClient();
      const siteId = input.siteId || DEFAULT_CMS_SITE_ID;
      const row = await findPageRow(supabase, siteId, input.pageId);
      if (!row) {
        await fallback.deletePage(input).catch(() => undefined);
        return { deleted: false };
      }
      if (row.kind !== "custom") {
        throw new Error("Alleen aangepaste pagina's kunnen verwijderd worden.");
      }

      const appPageId = cmsPageRecordId(row);

      // Prefer transactional RPC: archive immutable revisions, then purge dependents.
      const { data: rpcData, error: rpcError } = await supabase.rpc("cms_delete_custom_page", {
        p_site_id: siteId,
        p_page_ref: input.pageId,
      });

      if (rpcError) {
        const missingFn =
          rpcError.code === "PGRST202" ||
          rpcError.code === "42883" ||
          (/cms_delete_custom_page/i.test(rpcError.message) &&
            /does not exist|not find|Could not find/i.test(rpcError.message));
        if (!missingFn) {
          if (
            rpcError.message.includes("only custom") ||
            rpcError.message.includes("aangepaste")
          ) {
            throw new Error("Alleen aangepaste pagina's kunnen verwijderd worden.");
          }
          throw new Error(`cms deletePage: ${rpcError.message}`);
        }
        // Migration not applied yet — ordered client-side cleanup (same semantics).
        await deleteCustomPageClientSide(supabase, siteId, row, appPageId, input.pageId);
      } else {
        const deleted =
          rpcData &&
          typeof rpcData === "object" &&
          "deleted" in (rpcData as Record<string, unknown>)
            ? Boolean((rpcData as { deleted: boolean }).deleted)
            : true;
        if (!deleted) {
          await fallback.deletePage({ siteId, pageId: appPageId }).catch(() => undefined);
          return { deleted: false };
        }
      }

      await fallback.deletePage({ siteId, pageId: appPageId }).catch(() => undefined);
      return { deleted: true };
    },

    async seedBuiltinsIfEmpty(pages, siteId = DEFAULT_CMS_SITE_ID) {
      for (const page of pages) {
        // Prefer live lookup by stable_key — list map can miss when stable_key was null
        // historically and public id was the UUID, causing a duplicate-key insert race.
        const row = await this.getPage(page.id, siteId);
        if (row?.activePublishedRevisionId) continue;

        await this.upsertPage({ siteId, page, stableKey: page.id });
        const draft = (await this.getDraftPayload(page.id)) ?? page;
        const withStates = ensurePageLocaleFields({
          ...draft,
          localeStates: {
            nl: { publicationState: "published", freshness: "current" },
            en: draft.localeStates?.en ?? {
              publicationState: "missing",
              freshness: "unknown",
            },
          },
        });
        await this.publishPage({
          siteId,
          pageId: page.id,
          payload: withStates,
          publishedLocales: ["nl"],
        });
      }
    },
  };
}

export function getCmsStore(): CmsStore {
  if (hasSupabaseServiceConfig()) {
    try {
      return createSupabaseCmsStore();
    } catch {
      return getFileCmsStore();
    }
  }
  return getFileCmsStore();
}
