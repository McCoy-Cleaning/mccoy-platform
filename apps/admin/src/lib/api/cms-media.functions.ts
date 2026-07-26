import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  storageImage,
  collectLegacyEmbeddedImages,
  replaceCmsImagesInTree,
  type CmsImage,
  type CmsPage,
} from "@mccoy/cms-schema";
import {
  DEFAULT_CMS_SITE_ID,
  requireAdminSession,
  listCmsMediaAssets,
  getCmsMediaAsset,
  findCmsMediaAssetBySourcePath,
  uploadCmsMediaBytes,
  updateCmsMediaMetadata,
  archiveCmsMediaAsset,
  restoreCmsMediaAsset,
  deleteCmsMediaAsset,
  findCmsMediaReferencesInPayloads,
  getCmsStore,
  sha256Hex,
  type CmsMediaProfile,
  type CmsMediaReference,
} from "@mccoy/database/server";
import { AdminAuthError } from "@mccoy/security";
import { ensureMonorepoEnvLoaded } from "@mccoy/security/load-monorepo-env";

const profileSchema = z.enum(["photo", "logo", "gif"]);

function mapAuthError(error: unknown) {
  if (error instanceof AdminAuthError) {
    return { ok: false as const, error: error.message, code: "auth" as const };
  }
  console.error("[cms-media]", error);
  return {
    ok: false as const,
    error: error instanceof Error ? error.message : "Media-actie mislukt.",
    code: "unknown" as const,
  };
}

/** Server always uses the default McCoy site — ignore client siteId. */
function resolvedSiteId(_clientSiteId?: string | null): string {
  return DEFAULT_CMS_SITE_ID;
}

function decodeBase64Payload(base64: string): Uint8Array {
  const cleaned = base64.replace(/^data:[^;]+;base64,/, "");
  return Uint8Array.from(Buffer.from(cleaned, "base64"));
}

export const adminListCmsMedia = createServerFn({ method: "POST" })
  .validator(
    z.object({
      q: z.string().max(200).optional(),
      profile: profileSchema.optional(),
      tags: z.array(z.string().max(64)).max(20).optional(),
      status: z.enum(["active", "archived"]).optional(),
      limit: z.number().int().min(1).max(100).optional(),
      cursor: z
        .object({
          createdAt: z.string().min(1),
          id: z.string().uuid(),
        })
        .nullable()
        .optional(),
      /** Ignored — site is server-scoped. */
      siteId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      await requireAdminSession();
      ensureMonorepoEnvLoaded();
      const result = await listCmsMediaAssets({
        siteId: resolvedSiteId(data.siteId),
        q: data.q,
        profile: data.profile,
        tags: data.tags,
        status: data.status ?? "active",
        limit: data.limit,
        cursor: data.cursor ?? null,
      });
      return { ok: true as const, ...result };
    } catch (error) {
      return mapAuthError(error);
    }
  });

export const adminGetCmsMedia = createServerFn({ method: "POST" })
  .validator(z.object({ assetId: z.string().min(1), siteId: z.string().uuid().optional() }))
  .handler(async ({ data }) => {
    try {
      await requireAdminSession();
      const asset = await getCmsMediaAsset(data.assetId, resolvedSiteId(data.siteId));
      if (!asset || asset.status === "deleted") {
        return { ok: false as const, error: "Asset niet gevonden.", code: "not_found" as const };
      }
      return { ok: true as const, asset };
    } catch (error) {
      return mapAuthError(error);
    }
  });

/**
 * Resolve a seeded storefront path (`/images/...`) to its Supabase catalog row
 * via `source:/images/...` tags from `scripts/seed-cms-media.ts`.
 */
export const adminResolveCmsMediaBySourcePath = createServerFn({ method: "POST" })
  .validator(
    z.object({
      publicPath: z.string().min(1).max(400),
      siteId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      await requireAdminSession();
      ensureMonorepoEnvLoaded();
      const asset = await findCmsMediaAssetBySourcePath(
        data.publicPath,
        resolvedSiteId(data.siteId),
      );
      if (!asset) {
        return { ok: false as const, error: "Geen Storage-asset voor dit pad.", code: "not_found" as const };
      }
      return {
        ok: true as const,
        asset,
        image: storageImage({
          assetId: asset.id,
          publicUrl: asset.publicUrl,
          alt: asset.altDefault,
          width: asset.width,
          height: asset.height,
        }),
      };
    } catch (error) {
      return mapAuthError(error);
    }
  });

/**
 * Proxied upload for small compressed images (v1).
 * Contract: same outcome as authorize → upload → finalize; editor can later switch to direct Storage PUT.
 */
export const adminUploadCmsMedia = createServerFn({ method: "POST" })
  .validator(
    z.object({
      profile: profileSchema,
      /** Base64 of compressed bytes (or data URL). Keep small — browser compresses first. */
      bytesBase64: z.string().min(1).max(2_000_000),
      originalFilename: z.string().max(200).optional(),
      altDefault: z.string().max(500).optional(),
      tags: z.array(z.string().max(64)).max(20).optional(),
      idempotencyKey: z.string().uuid().optional(),
      siteId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminSession();
      ensureMonorepoEnvLoaded();
      const bytes = decodeBase64Payload(data.bytesBase64);
      const result = await uploadCmsMediaBytes({
        siteId: resolvedSiteId(data.siteId),
        profile: data.profile as CmsMediaProfile,
        bytes,
        originalFilename: data.originalFilename,
        altDefault: data.altDefault,
        tags: data.tags,
        idempotencyKey: data.idempotencyKey ?? null,
        actorUserId: session.userId ?? null,
      });
      if (!result.ok) return result;
      return {
        ok: true as const,
        asset: result.asset,
        reused: result.reused,
        image: storageImage({
          assetId: result.asset.id,
          publicUrl: result.asset.publicUrl,
          alt: data.altDefault ?? result.asset.altDefault,
          width: result.asset.width,
          height: result.asset.height,
        }),
        contentHash: sha256Hex(bytes),
      };
    } catch (error) {
      return mapAuthError(error);
    }
  });

export const adminUpdateCmsMediaMeta = createServerFn({ method: "POST" })
  .validator(
    z.object({
      assetId: z.string().min(1),
      altDefault: z.string().max(500).optional(),
      tags: z.array(z.string().max(64)).max(20).optional(),
      siteId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminSession();
      return await updateCmsMediaMetadata({
        siteId: resolvedSiteId(data.siteId),
        assetId: data.assetId,
        altDefault: data.altDefault,
        tags: data.tags,
        actorUserId: session.userId ?? null,
      });
    } catch (error) {
      return mapAuthError(error);
    }
  });

export const adminArchiveCmsMedia = createServerFn({ method: "POST" })
  .validator(
    z.object({
      assetId: z.string().min(1),
      reason: z.string().max(500).optional(),
      siteId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminSession();
      return await archiveCmsMediaAsset({
        siteId: resolvedSiteId(data.siteId),
        assetId: data.assetId,
        reason: data.reason,
        actorUserId: session.userId ?? null,
      });
    } catch (error) {
      return mapAuthError(error);
    }
  });

export const adminRestoreCmsMedia = createServerFn({ method: "POST" })
  .validator(z.object({ assetId: z.string().min(1), siteId: z.string().uuid().optional() }))
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminSession();
      return await restoreCmsMediaAsset({
        siteId: resolvedSiteId(data.siteId),
        assetId: data.assetId,
        actorUserId: session.userId ?? null,
      });
    } catch (error) {
      return mapAuthError(error);
    }
  });

async function collectPagePayloadsForRefs(): Promise<
  Array<{
    pageId: string;
    pageTitle: string;
    draftPayload?: unknown;
    publishedPayload?: unknown;
  }>
> {
  const store = getCmsStore();
  const pages = await store.listPages();
  const out: Array<{
    pageId: string;
    pageTitle: string;
    draftPayload?: unknown;
    publishedPayload?: unknown;
  }> = [];

  for (const page of pages) {
    const draft = await store.getDraftPayload(page.id).catch(() => null);
    const title = draft?.title ?? page.stableKey ?? page.pageKey ?? page.id;
    let publishedPayload: unknown;
    try {
      const rev = await store.getActivePublishedRevision(page.id);
      publishedPayload = rev?.payload;
    } catch {
      publishedPayload = undefined;
    }
    out.push({
      pageId: page.id,
      pageTitle: String(title),
      draftPayload: draft ?? undefined,
      publishedPayload,
    });
  }
  return out;
}

export const adminFindCmsMediaReferences = createServerFn({ method: "POST" })
  .validator(z.object({ assetId: z.string().min(1) }))
  .handler(async ({ data }) => {
    try {
      await requireAdminSession();
      const pages = await collectPagePayloadsForRefs();
      const references = findCmsMediaReferencesInPayloads(data.assetId, pages);
      return { ok: true as const, references };
    } catch (error) {
      return mapAuthError(error);
    }
  });

export const adminDeleteCmsMedia = createServerFn({ method: "POST" })
  .validator(
    z.object({
      assetId: z.string().min(1),
      reason: z.string().max(500).optional(),
      force: z.boolean().optional(),
      siteId: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminSession();
      const pages = await collectPagePayloadsForRefs();
      const references = findCmsMediaReferencesInPayloads(data.assetId, pages);
      return await deleteCmsMediaAsset({
        siteId: resolvedSiteId(data.siteId),
        assetId: data.assetId,
        reason: data.reason,
        actorUserId: session.userId ?? null,
        references,
        force: data.force === true,
      });
    } catch (error) {
      return mapAuthError(error);
    }
  });

export const adminScanPageLegacyImages = createServerFn({ method: "POST" })
  .validator(z.object({ page: z.unknown() }))
  .handler(async ({ data }) => {
    try {
      await requireAdminSession();
      const images = collectLegacyEmbeddedImages(data.page);
      return {
        ok: true as const,
        count: images.length,
        images: images.map((img) => ({
          assetId: img.assetId,
          alt: img.alt,
          bytesApprox: img.src.length,
        })),
      };
    } catch (error) {
      return mapAuthError(error);
    }
  });

/**
 * Explicit legacy migration: upload one embedded data-URL image to Storage and return replacement CmsImage.
 */
export const adminMigrateLegacyCmsImage = createServerFn({ method: "POST" })
  .validator(
    z.object({
      image: z.object({
        assetId: z.string(),
        src: z.string().min(1),
        alt: z.string(),
        decorative: z.boolean(),
        width: z.number().optional(),
        height: z.number().optional(),
      }),
      profile: profileSchema.default("photo"),
      tags: z.array(z.string().max(64)).max(20).optional(),
      idempotencyKey: z.string().uuid().optional(),
    }),
  )
  .handler(async ({ data }) => {
    try {
      const session = await requireAdminSession();
      ensureMonorepoEnvLoaded();
      if (!/^data:image\//i.test(data.image.src) && !data.image.assetId.startsWith("upload:")) {
        return {
          ok: false as const,
          error: "Geen ingesloten legacy-afbeelding.",
          code: "not_legacy" as const,
        };
      }
      if (!/^data:image\//i.test(data.image.src)) {
        return {
          ok: false as const,
          error: "Legacy-afbeelding zonder data-URL kan niet worden gemigreerd.",
          code: "missing_data_url" as const,
        };
      }
      const bytes = decodeBase64Payload(data.image.src);
      const result = await uploadCmsMediaBytes({
        profile: data.profile,
        bytes,
        originalFilename: data.image.assetId,
        altDefault: data.image.alt,
        tags: data.tags ?? ["legacy-migrated"],
        idempotencyKey: data.idempotencyKey ?? null,
        actorUserId: session.userId ?? null,
      });
      if (!result.ok) return result;
      const image = storageImage({
        assetId: result.asset.id,
        publicUrl: result.asset.publicUrl,
        alt: data.image.alt,
        decorative: data.image.decorative,
        width: result.asset.width,
        height: result.asset.height,
      });
      return { ok: true as const, image, asset: result.asset, reused: result.reused };
    } catch (error) {
      return mapAuthError(error);
    }
  });

export function applyLegacyImageReplacements(
  page: CmsPage,
  replacements: Map<string, CmsImage>,
): CmsPage {
  const next = replaceCmsImagesInTree(page, (img) => {
    const key = img.assetId || img.src.slice(0, 64);
    return replacements.get(key) ?? replacements.get(img.src) ?? null;
  }) as CmsPage;
  return next;
}

export type { CmsMediaReference };
