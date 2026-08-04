import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  CMS_PAGE_CREATE_FORBIDDEN_REASON,
  ensurePageLocaleFields,
  validatePublishableCmsPage,
  type CmsPage,
  type Locale,
} from "@mccoy/cms-schema";
import {
  builtinCmsSeedPages,
  DEFAULT_CMS_SITE_ID,
  enqueueNotificationOutbox,
  getCmsStore,
  hasSupabaseServiceConfig,
  processCmsOutbox,
  processNotificationOutbox,
  requireAdminSession,
  type CmsStore,
} from "@mccoy/database/server";
import { AdminAuthError } from "@mccoy/security";

const CMS_PAGE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * After CMS publish/delete/rollback, retire website_request scopes that no longer
 * exist on published forms. Never fails the CMS mutation.
 */
async function reconcileOrphanScopesAfterCmsChange(): Promise<void> {
  try {
    const { reconcileOrphanWebsiteRequestScopes } = await import("@mccoy/database/server");
    const result = await reconcileOrphanWebsiteRequestScopes();
    if (result.cleared > 0) {
      console.info(
        JSON.stringify({
          type: "website_requests.orphan_scopes_cleared",
          cleared: result.cleared,
          activeKeyCount: result.activeKeys.length,
        }),
      );
    }
  } catch (error) {
    console.error("[cms] orphan scope reconcile failed", error);
  }
}

/**
 * Stage D — best-effort `cms.publish_failed` notice to the acting staff member.
 * Never throws: a notification failure must not mask the original publish error.
 * Skips auth errors, optimistic-concurrency conflicts (expected/retryable), and
 * legacy-admin sessions without a `public.users` id (no notification recipient).
 */
async function notifyCmsPublishFailed(
  actorUserId: string | undefined,
  pageId: string,
  error: unknown,
): Promise<void> {
  if (error instanceof AdminAuthError) return;
  if (error instanceof Error && (error as Error & { code?: string }).code === "conflict") return;
  if (!actorUserId || !hasSupabaseServiceConfig()) return;
  if (!CMS_PAGE_ID_PATTERN.test(pageId)) return;

  try {
    const attemptId = Date.now().toString(36);
    await enqueueNotificationOutbox({
      type: "cms.publish_failed",
      title: "Publiceren van pagina mislukt",
      destinationPath: "/admin/website",
      entityType: "cms_page",
      entityId: pageId,
      metadata: { pageId, attemptId },
      dedupeKey: `cms.publish_failed:${pageId}:${attemptId}`,
      actorUserId,
    });
    await processNotificationOutbox(5);
  } catch (notifyError) {
    console.error("[cms-admin] publish-failure notification enqueue failed", notifyError);
  }
}

async function ensureSeeded() {
  const store = getCmsStore();
  await store.seedBuiltinsIfEmpty(builtinCmsSeedPages());
  return store;
}

/**
 * Admins may only update existing pages. Creating a new page id/stable_key is forbidden.
 * Builtin seeding uses `seedBuiltinsIfEmpty`, not these admin endpoints.
 */
async function requireExistingCmsPage(
  store: CmsStore,
  pageId: string,
  payloadId: string,
): Promise<{ ok: true } | { ok: false; error: string; code: "forbidden" }> {
  if (payloadId !== pageId) {
    return {
      ok: false,
      error: "Payload-id komt niet overeen met pageId.",
      code: "forbidden",
    };
  }
  const existing = await store.getPage(pageId);
  if (!existing) {
    return {
      ok: false,
      error: CMS_PAGE_CREATE_FORBIDDEN_REASON,
      code: "forbidden",
    };
  }
  return { ok: true };
}

function jsonClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function mapAuthError(error: unknown) {
  if (error instanceof AdminAuthError) {
    return { ok: false as const, error: error.message, code: "auth" as const };
  }
  if (error instanceof Error && (error as Error & { code?: string }).code === "conflict") {
    return {
      ok: false as const,
      error: "Concept is verouderd — herlaad en probeer opnieuw.",
      code: "conflict" as const,
    };
  }
  if (
    error instanceof Error &&
    (/only custom pages can be deleted/i.test(error.message) ||
      /Alleen aangepaste pagina/i.test(error.message))
  ) {
    return {
      ok: false as const,
      error: "Alleen aangepaste pagina's kunnen verwijderd worden.",
      code: "forbidden" as const,
    };
  }
  console.error("[cms-admin]", error);
  return {
    ok: false as const,
    error: error instanceof Error ? error.message : "CMS-actie mislukt.",
    code: "unknown" as const,
  };
}

export const adminListCmsRevisions = createServerFn({ method: "POST" })
  .validator(z.object({ pageId: z.string().min(1) }))
  .handler(async ({ data }) => {
    try {
      await requireAdminSession();
      const store = await ensureSeeded();
      const revisions = await store.listRevisions(data.pageId);
      return jsonClone({
        ok: true as const,
        revisions: revisions.map((r) => ({
          id: r.id,
          revisionNumber: r.revisionNumber,
          status: r.status,
          publishedAt: r.publishedAt,
          createdAt: r.createdAt,
        })),
      });
    } catch (error) {
      return mapAuthError(error);
    }
  });

export const adminGetCmsPageStatus = createServerFn({ method: "POST" })
  .validator(z.object({ pageId: z.string().min(1) }))
  .handler(async ({ data }) => {
    try {
      await requireAdminSession();
      const store = await ensureSeeded();
      const page = await store.getPage(data.pageId);
      const rev = page ? await store.getActivePublishedRevision(data.pageId) : null;
      const localeStates = rev?.payload.localeStates ?? null;
      return jsonClone({
        ok: true as const,
        draftRevisionNumber: page?.draftRevisionNumber ?? 1,
        activePublishedRevisionId: page?.activePublishedRevisionId ?? null,
        localeStates,
        publishedAt: rev?.publishedAt ?? null,
      });
    } catch (error) {
      return mapAuthError(error);
    }
  });

/** Custom page ids that still exist in the durable CMS store (file / Supabase). */
export const adminListPublishedCustomPageIds = createServerFn({ method: "POST" }).handler(
  async () => {
    try {
      await requireAdminSession();
      const store = await ensureSeeded();
      const pages = await store.listPages();
      const customIds: string[] = [];
      for (const page of pages) {
        if (page.kind !== "custom") continue;
        customIds.push(page.stableKey || page.id);
        // App-facing ids are often stable_key; published payloads use CmsPage.id.
        const rev = await store.getActivePublishedRevision(page.id);
        if (rev?.payload?.id) customIds.push(rev.payload.id);
      }
      return jsonClone({ ok: true as const, customPageIds: [...new Set(customIds)] });
    } catch (error) {
      return mapAuthError(error);
    }
  },
);

/**
 * Active published payloads for all pages — used to hydrate the admin editor
 * so Secties shows the live text/images instead of empty seed stubs.
 * Returned as JSON string for TanStack Start serializability.
 */
export const adminGetPublishedCmsPages = createServerFn({ method: "POST" }).handler(async () => {
  try {
    await requireAdminSession();
    const store = await ensureSeeded();
    const pageRows = await store.listPages();
    const pages: CmsPage[] = [];
    for (const row of pageRows) {
      const rev = await store.getActivePublishedRevision(row.id);
      if (rev?.payload) {
        pages.push(ensurePageLocaleFields(rev.payload));
      }
    }
    return jsonClone({ ok: true as const, pagesJson: JSON.stringify(pages) });
  } catch (error) {
    return mapAuthError(error);
  }
});

const publishSchema = z.object({
  pageId: z.string().min(1),
  payload: z.record(z.unknown()),
  publishedLocales: z.array(z.enum(["nl", "en"])).min(1),
  expectedDraftRevision: z.number().int().positive().nullable().optional(),
});

export const adminPublishCmsPage = createServerFn({ method: "POST" })
  .validator(publishSchema)
  .handler(async ({ data }) => {
    let actorUserId: string | undefined;
    try {
      const session = await requireAdminSession();
      actorUserId = session.userId;
      const store = await ensureSeeded();
      const payload = ensurePageLocaleFields(data.payload as unknown as CmsPage);
      const gate = await requireExistingCmsPage(store, data.pageId, payload.id);
      if (!gate.ok) return gate;

      // Validate-all-then-write: never persist an invalid publish payload.
      const validated = validatePublishableCmsPage(payload);
      if (!validated.ok) {
        return {
          ok: false as const,
          error:
            validated.issues.map((i) => i.message).join(" ") || "Pagina is niet publiceerbaar.",
          code: "validation" as const,
          issues: validated.issues,
        };
      }

      await store.upsertPage({
        siteId: DEFAULT_CMS_SITE_ID,
        page: validated.page,
        stableKey: validated.page.id,
      });
      const result = await store.publishPage({
        siteId: DEFAULT_CMS_SITE_ID,
        pageId: data.pageId,
        payload: validated.page,
        publishedLocales: data.publishedLocales as Locale[],
        createdBy: session.username,
        expectedDraftRevision: data.expectedDraftRevision ?? null,
      });
      await processCmsOutbox(10);
      await reconcileOrphanScopesAfterCmsChange();
      return jsonClone({
        ok: true as const,
        result: {
          revisionId: result.revisionId,
          revisionNumber: result.revisionNumber,
          eventId: result.eventId,
          draftRevisionNumber: result.draftRevisionNumber,
        },
      });
    } catch (error) {
      await notifyCmsPublishFailed(actorUserId, data.pageId, error);
      return mapAuthError(error);
    }
  });

const rollbackSchema = z.object({
  pageId: z.string().min(1),
  targetRevisionId: z.string().uuid(),
});

export const adminRollbackCmsPage = createServerFn({ method: "POST" })
  .validator(rollbackSchema)
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminSession();
      const store = await ensureSeeded();
      const result = await store.rollbackPage({
        siteId: DEFAULT_CMS_SITE_ID,
        pageId: data.pageId,
        targetRevisionId: data.targetRevisionId,
        createdBy: session.username,
      });
      await processCmsOutbox(10);
      await reconcileOrphanScopesAfterCmsChange();
      return jsonClone({
        ok: true as const,
        result: {
          revisionId: result.revisionId,
          revisionNumber: result.revisionNumber,
          eventId: result.eventId,
          draftRevisionNumber: result.draftRevisionNumber,
        },
      });
    } catch (error) {
      return mapAuthError(error);
    }
  });

const deleteSchema = z.object({
  pageId: z.string().min(1),
});

/** Permanently delete a custom CMS page and all related publish/i18n/SEO artifacts. */
export const adminDeleteCmsPage = createServerFn({ method: "POST" })
  .validator(deleteSchema)
  .handler(async ({ data }) => {
    try {
      await requireAdminSession();
      const store = await ensureSeeded();
      const existing = await store.getPage(data.pageId);
      if (existing && existing.kind !== "custom") {
        return {
          ok: false as const,
          error: "Alleen aangepaste pagina's kunnen verwijderd worden.",
          code: "forbidden" as const,
        };
      }
      const result = await store.deletePage({
        siteId: DEFAULT_CMS_SITE_ID,
        pageId: data.pageId,
      });
      // Idempotent: already gone is success. Still present after delete is a hard failure.
      const stillThere = await store.getPage(data.pageId);
      if (stillThere) {
        return {
          ok: false as const,
          error:
            "Pagina staat nog in de gedeelde publicatiestore. Verwijderen mislukte — probeer opnieuw.",
          code: "unknown" as const,
        };
      }
      const published = await store.getActivePublishedRevision(data.pageId);
      if (published) {
        return {
          ok: false as const,
          error:
            "Publicatierevisie van de pagina bestaat nog. Verwijderen mislukte — probeer opnieuw.",
          code: "unknown" as const,
        };
      }
      await processCmsOutbox(10);
      await reconcileOrphanScopesAfterCmsChange();
      return jsonClone({
        ok: true as const,
        deleted: result.deleted || !existing,
      });
    } catch (error) {
      return mapAuthError(error);
    }
  });

const draftSaveSchema = z.object({
  pageId: z.string().min(1),
  payload: z.record(z.unknown()),
  expectedDraftRevision: z.number().int().positive().nullable().optional(),
});

/**
 * Soft-draft persist — durable concept without publish validation.
 * Incomplete blocks are allowed; publish still uses validate-all-then-write.
 */
export const adminSaveCmsDraft = createServerFn({ method: "POST" })
  .validator(draftSaveSchema)
  .handler(async ({ data }) => {
    try {
      await requireAdminSession();
      const store = await ensureSeeded();
      const payload = ensurePageLocaleFields(data.payload as unknown as CmsPage);
      const gate = await requireExistingCmsPage(store, data.pageId, payload.id);
      if (!gate.ok) return gate;

      const pageRow = await store.getPage(data.pageId);
      if (!pageRow) {
        return {
          ok: false as const,
          error: CMS_PAGE_CREATE_FORBIDDEN_REASON,
          code: "forbidden" as const,
        };
      }
      const expected = data.expectedDraftRevision ?? pageRow.draftRevisionNumber;

      const result = await store.saveDraft({
        siteId: DEFAULT_CMS_SITE_ID,
        pageId: data.pageId,
        expectedRevisionNumber: expected,
        changes: {},
        payload,
      });
      return jsonClone({
        ok: true as const,
        draftRevisionNumber: result.draftRevisionNumber,
      });
    } catch (error) {
      return mapAuthError(error);
    }
  });

const localeStateSchema = z.object({
  pageId: z.string().min(1),
  payload: z.record(z.unknown()),
  locale: z.enum(["nl", "en"]),
  publicationState: z.enum(["missing", "draft", "review", "approved", "published", "archived"]),
  freshness: z.enum(["current", "stale", "unknown"]).optional(),
});

/** D4 — set locale review/approval state on draft payload (does not auto-publish). */
export const adminSetCmsLocaleState = createServerFn({ method: "POST" })
  .validator(localeStateSchema)
  .handler(async ({ data }) => {
    try {
      await requireAdminSession();
      const store = await ensureSeeded();
      const page = ensurePageLocaleFields(data.payload as unknown as CmsPage);
      const gate = await requireExistingCmsPage(store, data.pageId, page.id);
      if (!gate.ok) return gate;
      const next: CmsPage = {
        ...page,
        localeStates: {
          ...page.localeStates!,
          [data.locale]: {
            publicationState: data.publicationState,
            freshness:
              data.freshness ?? (data.publicationState === "published" ? "current" : "unknown"),
          },
        },
      };
      await store.upsertPage({
        siteId: DEFAULT_CMS_SITE_ID,
        page: next,
        stableKey: next.id,
      });
      return jsonClone({
        ok: true as const,
        pageId: next.id,
        localeStates: next.localeStates,
      });
    } catch (error) {
      return mapAuthError(error);
    }
  });
