import { createHash, randomUUID } from "node:crypto";
import type { CmsImage } from "@mccoy/cms-schema";
import { createSupabaseServiceClient, getSupabasePublicConfig } from "../supabase";
import { writeStaffAudit } from "../staff";
import { DEFAULT_CMS_SITE_ID } from "./types";
import {
  CMS_MEDIA_BUCKET,
  buildCmsMediaStoragePath,
  deriveCmsMediaPublicUrl,
  inspectCmsImageBytes,
  sanitizeOriginalFilename,
  type CmsMediaProfile,
} from "./media-validate";

export type {
  CmsMediaProfile,
  InspectCmsImageResult,
  InspectedCmsImage,
} from "./media-validate";

export {
  CMS_MEDIA_BUCKET,
  CMS_MEDIA_MAX_SOURCE_BYTES,
  CMS_MEDIA_MAX_STORED_BYTES,
  CMS_MEDIA_MAX_PIXELS,
  buildCmsMediaStoragePath,
  deriveCmsMediaPublicUrl,
  inspectCmsImageBytes,
  sanitizeOriginalFilename,
} from "./media-validate";

export type CmsMediaStatus = "active" | "archived" | "deleted";

export type CmsMediaAsset = {
  id: string;
  siteId: string;
  bucketId: string;
  storagePath: string;
  contentHash: string;
  originalFilename: string | null;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  altDefault: string;
  tags: string[];
  profile: CmsMediaProfile;
  status: CmsMediaStatus;
  idempotencyKey: string | null;
  createdByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  archiveReason: string | null;
  deletedAt: string | null;
  deleteReason: string | null;
  /** Derived — never stored as canonical. */
  publicUrl: string;
};

export type CmsMediaListCursor = {
  createdAt: string;
  id: string;
};

export type CmsMediaReference = {
  pageId: string;
  pageTitle: string;
  state: "draft" | "published";
  blockId?: string;
};

type MediaRow = {
  id: string;
  site_id: string;
  bucket_id: string;
  storage_path: string;
  content_hash: string;
  original_filename: string | null;
  mime_type: string;
  byte_size: number;
  width: number;
  height: number;
  alt_default: string;
  tags: string[] | null;
  profile: CmsMediaProfile;
  status: CmsMediaStatus;
  idempotency_key: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  archive_reason: string | null;
  deleted_at: string | null;
  delete_reason: string | null;
};

function mediaClient() {
  return createSupabaseServiceClient().schema("private");
}

function mapRow(row: MediaRow): CmsMediaAsset {
  const { url } = getSupabasePublicConfig();
  return {
    id: row.id,
    siteId: row.site_id,
    bucketId: row.bucket_id,
    storagePath: row.storage_path,
    contentHash: row.content_hash,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    byteSize: row.byte_size,
    width: row.width,
    height: row.height,
    altDefault: row.alt_default ?? "",
    tags: row.tags ?? [],
    profile: row.profile,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    createdByUserId: row.created_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    archiveReason: row.archive_reason,
    deletedAt: row.deleted_at,
    deleteReason: row.delete_reason,
    publicUrl: deriveCmsMediaPublicUrl({
      supabaseUrl: url,
      bucketId: row.bucket_id,
      storagePath: row.storage_path,
    }),
  };
}

export function cmsMediaAssetId(assetId: string): string {
  return assetId.startsWith("storage:") ? assetId.slice("storage:".length) : assetId;
}

export function storageCmsImage(
  asset: Pick<CmsMediaAsset, "id" | "publicUrl" | "altDefault" | "width" | "height">,
  opts?: { alt?: string; decorative?: boolean },
): CmsImage {
  const decorative = opts?.decorative === true;
  return {
    assetId: `storage:${asset.id}`,
    src: asset.publicUrl,
    alt: decorative ? "" : (opts?.alt ?? asset.altDefault ?? ""),
    decorative,
    width: asset.width,
    height: asset.height,
  };
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function auditMedia(params: {
  actorUserId: string | null;
  action:
    | "cms.media.uploaded"
    | "cms.media.metadata_updated"
    | "cms.media.archived"
    | "cms.media.restored"
    | "cms.media.deleted"
    | "cms.media.legacy_migrated";
  assetId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  requestId?: string | null;
}): Promise<void> {
  await writeStaffAudit({
    actorUserId: params.actorUserId,
    action: params.action,
    targetType: "cms_media_asset",
    targetId: params.assetId,
    before: params.before ?? null,
    after: params.after ?? null,
    requestId: params.requestId ?? null,
    metadata: params.metadata ?? null,
  });
}

export async function getCmsMediaAsset(
  assetId: string,
  siteId: string = DEFAULT_CMS_SITE_ID,
): Promise<CmsMediaAsset | null> {
  const id = cmsMediaAssetId(assetId);
  const { data, error } = await mediaClient()
    .from("cms_media_assets")
    .select("*")
    .eq("id", id)
    .eq("site_id", siteId)
    .maybeSingle();
  if (error) throw new Error(`getCmsMediaAsset failed: ${error.message}`);
  return data ? mapRow(data as MediaRow) : null;
}

/** Normalize a storefront public path used in seed tags (`source:/images/...`). */
export function normalizeCmsMediaSourcePath(publicPath: string): string {
  const trimmed = publicPath.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * Resolve a seeded static path (e.g. `/images/cms/hero-cleaning.jpg`) to the
 * active catalog row tagged `source:<path>` during `scripts/seed-cms-media.ts`.
 */
export async function findCmsMediaAssetBySourcePath(
  publicPath: string,
  siteId: string = DEFAULT_CMS_SITE_ID,
): Promise<CmsMediaAsset | null> {
  const normalized = normalizeCmsMediaSourcePath(publicPath);
  if (!normalized.startsWith("/images/")) return null;
  const sourceTag = `source:${normalized}`;
  const { data, error } = await mediaClient()
    .from("cms_media_assets")
    .select("*")
    .eq("site_id", siteId)
    .eq("status", "active")
    .contains("tags", [sourceTag])
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findCmsMediaAssetBySourcePath failed: ${error.message}`);
  return data ? mapRow(data as MediaRow) : null;
}

export async function listCmsMediaAssets(input: {
  siteId?: string;
  status?: CmsMediaStatus | CmsMediaStatus[];
  profile?: CmsMediaProfile;
  tags?: string[];
  q?: string;
  limit?: number;
  cursor?: CmsMediaListCursor | null;
}): Promise<{ items: CmsMediaAsset[]; nextCursor: CmsMediaListCursor | null }> {
  const siteId = input.siteId ?? DEFAULT_CMS_SITE_ID;
  const limit = Math.min(Math.max(input.limit ?? 40, 1), 100);
  const statuses = input.status
    ? Array.isArray(input.status)
      ? input.status
      : [input.status]
    : (["active"] as CmsMediaStatus[]);

  let query = mediaClient()
    .from("cms_media_assets")
    .select("*")
    .eq("site_id", siteId)
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (input.profile) query = query.eq("profile", input.profile);
  if (input.tags && input.tags.length > 0) query = query.contains("tags", input.tags);
  if (input.q?.trim()) {
    const q = `%${input.q.trim().replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    query = query.or(`original_filename.ilike.${q},alt_default.ilike.${q}`);
  }
  if (input.cursor) {
    query = query.or(
      `created_at.lt.${input.cursor.createdAt},and(created_at.eq.${input.cursor.createdAt},id.lt.${input.cursor.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`listCmsMediaAssets failed: ${error.message}`);
  const rows = ((data ?? []) as MediaRow[]).map(mapRow);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

export type AuthorizeCmsMediaUploadInput = {
  siteId?: string;
  profile: CmsMediaProfile;
  originalFilename?: string | null;
  altDefault?: string;
  tags?: string[];
  idempotencyKey?: string | null;
  actorUserId?: string | null;
  contentHash?: string | null;
  requestId?: string | null;
};

export type AuthorizeCmsMediaUploadResult =
  | {
      ok: true;
      reused: boolean;
      assetId: string;
      bucketId: string;
      storagePath: string;
      asset?: CmsMediaAsset;
    }
  | { ok: false; error: string; code: string };

/**
 * Reserves an asset id + immutable storage path.
 * If contentHash / idempotencyKey matches an active asset, returns that asset (retry-safe).
 */
export async function authorizeCmsMediaUpload(
  input: AuthorizeCmsMediaUploadInput,
): Promise<AuthorizeCmsMediaUploadResult> {
  const siteId = input.siteId ?? DEFAULT_CMS_SITE_ID;

  if (input.idempotencyKey) {
    const { data: byKey } = await mediaClient()
      .from("cms_media_assets")
      .select("*")
      .eq("site_id", siteId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (byKey) {
      const asset = mapRow(byKey as MediaRow);
      return {
        ok: true,
        reused: true,
        assetId: asset.id,
        bucketId: asset.bucketId,
        storagePath: asset.storagePath,
        asset,
      };
    }
  }

  if (input.contentHash) {
    const { data: byHash } = await mediaClient()
      .from("cms_media_assets")
      .select("*")
      .eq("site_id", siteId)
      .eq("content_hash", input.contentHash)
      .eq("status", "active")
      .maybeSingle();
    if (byHash) {
      const asset = mapRow(byHash as MediaRow);
      return {
        ok: true,
        reused: true,
        assetId: asset.id,
        bucketId: asset.bucketId,
        storagePath: asset.storagePath,
        asset,
      };
    }
  }

  const assetId = randomUUID();
  // Extension placeholder — finalize will upload with validated extension.
  // Path uses .bin until finalize; we store intended path only after validation.
  // For authorize we return path with a provisional extension based on profile default.
  const provisionalExt = input.profile === "gif" ? "gif" : input.profile === "logo" ? "png" : "webp";
  const storagePath = buildCmsMediaStoragePath({
    siteId,
    assetId,
    extension: provisionalExt,
  });

  return {
    ok: true,
    reused: false,
    assetId,
    bucketId: CMS_MEDIA_BUCKET,
    storagePath,
  };
}

export type FinalizeCmsMediaUploadInput = {
  siteId?: string;
  assetId: string;
  profile: CmsMediaProfile;
  bytes: Uint8Array;
  originalFilename?: string | null;
  altDefault?: string;
  tags?: string[];
  idempotencyKey?: string | null;
  actorUserId?: string | null;
  requestId?: string | null;
  /** When true, skip Storage upload and only insert catalog (object already present). */
  objectAlreadyUploaded?: boolean;
};

export type FinalizeCmsMediaUploadResult =
  | { ok: true; asset: CmsMediaAsset; reused: boolean }
  | { ok: false; error: string; code: string };

/**
 * Validates bytes, uploads to Storage (unless already uploaded), inserts catalog with compensation.
 */
export async function finalizeCmsMediaUpload(
  input: FinalizeCmsMediaUploadInput,
): Promise<FinalizeCmsMediaUploadResult> {
  const siteId = input.siteId ?? DEFAULT_CMS_SITE_ID;
  const contentHash = sha256Hex(input.bytes);

  // Idempotency / dedupe first
  if (input.idempotencyKey) {
    const { data: byKey } = await mediaClient()
      .from("cms_media_assets")
      .select("*")
      .eq("site_id", siteId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();
    if (byKey) {
      return { ok: true, asset: mapRow(byKey as MediaRow), reused: true };
    }
  }

  const { data: byHash } = await mediaClient()
    .from("cms_media_assets")
    .select("*")
    .eq("site_id", siteId)
    .eq("content_hash", contentHash)
    .eq("status", "active")
    .maybeSingle();
  if (byHash) {
    return { ok: true, asset: mapRow(byHash as MediaRow), reused: true };
  }

  const inspected = inspectCmsImageBytes(input.bytes, input.profile);
  if (!inspected.ok) {
    return { ok: false, error: inspected.reason, code: inspected.code };
  }

  const assetId = input.assetId || randomUUID();
  const storagePath = buildCmsMediaStoragePath({
    siteId,
    assetId,
    extension: inspected.extension,
  });
  const filename = sanitizeOriginalFilename(input.originalFilename);
  const supabase = createSupabaseServiceClient();

  let uploaded = Boolean(input.objectAlreadyUploaded);
  if (!uploaded) {
    const { error: uploadError } = await supabase.storage
      .from(CMS_MEDIA_BUCKET)
      .upload(storagePath, input.bytes, {
        contentType: inspected.mimeType,
        upsert: false,
        cacheControl: "31536000",
      });
    if (uploadError) {
      // Race: object may already exist from a prior attempt with same path
      if (!/already exists|Duplicate/i.test(uploadError.message)) {
        return { ok: false, error: uploadError.message, code: "storage_upload" };
      }
    }
    uploaded = true;
  }

  const insertRow = {
    id: assetId,
    site_id: siteId,
    bucket_id: CMS_MEDIA_BUCKET,
    storage_path: storagePath,
    content_hash: contentHash,
    original_filename: filename,
    mime_type: inspected.mimeType,
    byte_size: inspected.byteSize,
    width: inspected.width,
    height: inspected.height,
    alt_default: (input.altDefault ?? "").slice(0, 500),
    tags: input.tags ?? [],
    profile: input.profile,
    status: "active" as const,
    idempotency_key: input.idempotencyKey ?? null,
    created_by_user_id: input.actorUserId ?? null,
  };

  const { data: inserted, error: insertError } = await mediaClient()
    .from("cms_media_assets")
    .insert(insertRow)
    .select("*")
    .single();

  if (insertError || !inserted) {
    // Compensation: remove orphaned Storage object
    try {
      await supabase.storage.from(CMS_MEDIA_BUCKET).remove([storagePath]);
    } catch {
      /* best-effort cleanup */
    }
    // Unique conflict → return existing
    if (insertError && /duplicate|unique/i.test(insertError.message)) {
      const { data: existing } = await mediaClient()
        .from("cms_media_assets")
        .select("*")
        .eq("site_id", siteId)
        .eq("content_hash", contentHash)
        .eq("status", "active")
        .maybeSingle();
      if (existing) {
        return { ok: true, asset: mapRow(existing as MediaRow), reused: true };
      }
    }
    return {
      ok: false,
      error: insertError?.message ?? "Catalogus-insert mislukt.",
      code: "catalog_insert",
    };
  }

  const asset = mapRow(inserted as MediaRow);
  await auditMedia({
    actorUserId: input.actorUserId ?? null,
    action: "cms.media.uploaded",
    assetId: asset.id,
    after: {
      storagePath: asset.storagePath,
      mimeType: asset.mimeType,
      byteSize: asset.byteSize,
      profile: asset.profile,
      originalFilename: asset.originalFilename,
    },
    metadata: {
      siteId,
      contentHash,
      tags: asset.tags,
    },
    requestId: input.requestId ?? null,
  });

  return { ok: true, asset, reused: false };
}

/**
 * Convenience: authorize + finalize in one call (proxied small-file upload).
 */
export async function uploadCmsMediaBytes(input: {
  siteId?: string;
  profile: CmsMediaProfile;
  bytes: Uint8Array;
  originalFilename?: string | null;
  altDefault?: string;
  tags?: string[];
  idempotencyKey?: string | null;
  actorUserId?: string | null;
  requestId?: string | null;
}): Promise<FinalizeCmsMediaUploadResult> {
  const contentHash = sha256Hex(input.bytes);
  const auth = await authorizeCmsMediaUpload({
    siteId: input.siteId,
    profile: input.profile,
    originalFilename: input.originalFilename,
    altDefault: input.altDefault,
    tags: input.tags,
    idempotencyKey: input.idempotencyKey,
    actorUserId: input.actorUserId,
    contentHash,
    requestId: input.requestId,
  });
  if (!auth.ok) return auth;
  if (auth.reused && auth.asset) {
    return { ok: true, asset: auth.asset, reused: true };
  }
  return finalizeCmsMediaUpload({
    siteId: input.siteId,
    assetId: auth.assetId,
    profile: input.profile,
    bytes: input.bytes,
    originalFilename: input.originalFilename,
    altDefault: input.altDefault,
    tags: input.tags,
    idempotencyKey: input.idempotencyKey,
    actorUserId: input.actorUserId,
    requestId: input.requestId,
  });
}

export async function updateCmsMediaMetadata(input: {
  siteId?: string;
  assetId: string;
  altDefault?: string;
  tags?: string[];
  actorUserId?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; asset: CmsMediaAsset } | { ok: false; error: string; code: string }> {
  const siteId = input.siteId ?? DEFAULT_CMS_SITE_ID;
  const id = cmsMediaAssetId(input.assetId);
  const existing = await getCmsMediaAsset(id, siteId);
  if (!existing || existing.status === "deleted") {
    return { ok: false, error: "Asset niet gevonden.", code: "not_found" };
  }

  const patch: Record<string, unknown> = {};
  if (input.altDefault !== undefined) patch.alt_default = input.altDefault.slice(0, 500);
  if (input.tags !== undefined) patch.tags = input.tags;

  const { data, error } = await mediaClient()
    .from("cms_media_assets")
    .update(patch)
    .eq("id", id)
    .eq("site_id", siteId)
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Update mislukt.", code: "update_failed" };
  }
  const asset = mapRow(data as MediaRow);
  await auditMedia({
    actorUserId: input.actorUserId ?? null,
    action: "cms.media.metadata_updated",
    assetId: id,
    before: { altDefault: existing.altDefault, tags: existing.tags },
    after: { altDefault: asset.altDefault, tags: asset.tags },
    requestId: input.requestId ?? null,
  });
  return { ok: true, asset };
}

export async function archiveCmsMediaAsset(input: {
  siteId?: string;
  assetId: string;
  reason?: string | null;
  actorUserId?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; asset: CmsMediaAsset } | { ok: false; error: string; code: string }> {
  const siteId = input.siteId ?? DEFAULT_CMS_SITE_ID;
  const id = cmsMediaAssetId(input.assetId);
  const existing = await getCmsMediaAsset(id, siteId);
  if (!existing || existing.status === "deleted") {
    return { ok: false, error: "Asset niet gevonden.", code: "not_found" };
  }
  if (existing.status === "archived") {
    return { ok: true, asset: existing };
  }

  const { data, error } = await mediaClient()
    .from("cms_media_assets")
    .update({
      status: "archived",
      archived_at: new Date().toISOString(),
      archive_reason: input.reason?.slice(0, 500) ?? null,
    })
    .eq("id", id)
    .eq("site_id", siteId)
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Archiveren mislukt.", code: "archive_failed" };
  }
  const asset = mapRow(data as MediaRow);
  await auditMedia({
    actorUserId: input.actorUserId ?? null,
    action: "cms.media.archived",
    assetId: id,
    before: { status: existing.status },
    after: { status: "archived", archiveReason: asset.archiveReason },
    metadata: {
      note: "Archive hides from library; public URL remains reachable.",
    },
    requestId: input.requestId ?? null,
  });
  return { ok: true, asset };
}

export async function restoreCmsMediaAsset(input: {
  siteId?: string;
  assetId: string;
  actorUserId?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; asset: CmsMediaAsset } | { ok: false; error: string; code: string }> {
  const siteId = input.siteId ?? DEFAULT_CMS_SITE_ID;
  const id = cmsMediaAssetId(input.assetId);
  const existing = await getCmsMediaAsset(id, siteId);
  if (!existing || existing.status === "deleted") {
    return { ok: false, error: "Asset niet gevonden.", code: "not_found" };
  }
  if (existing.status === "active") return { ok: true, asset: existing };

  const { data, error } = await mediaClient()
    .from("cms_media_assets")
    .update({
      status: "active",
      archived_at: null,
      archive_reason: null,
    })
    .eq("id", id)
    .eq("site_id", siteId)
    .select("*")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Herstellen mislukt.", code: "restore_failed" };
  }
  const asset = mapRow(data as MediaRow);
  await auditMedia({
    actorUserId: input.actorUserId ?? null,
    action: "cms.media.restored",
    assetId: id,
    before: { status: "archived" },
    after: { status: "active" },
    requestId: input.requestId ?? null,
  });
  return { ok: true, asset };
}

/**
 * Scan page payloads (draft + published) for storage:<uuid> references.
 */
export function findCmsMediaReferencesInPayloads(
  assetId: string,
  pages: Array<{
    pageId: string;
    pageTitle: string;
    draftPayload?: unknown;
    publishedPayload?: unknown;
  }>,
): CmsMediaReference[] {
  const needle = `storage:${cmsMediaAssetId(assetId)}`;
  const refs: CmsMediaReference[] = [];

  const scan = (payload: unknown, state: "draft" | "published", pageId: string, pageTitle: string) => {
    if (payload == null) return;
    const json = JSON.stringify(payload);
    if (!json.includes(needle)) return;
    refs.push({ pageId, pageTitle, state });
  };

  for (const page of pages) {
    scan(page.draftPayload, "draft", page.pageId, page.pageTitle);
    scan(page.publishedPayload, "published", page.pageId, page.pageTitle);
  }
  return refs;
}

export async function deleteCmsMediaAsset(input: {
  siteId?: string;
  assetId: string;
  /** Optional audit note; UI no longer requires a user-entered motive. */
  reason?: string | null;
  actorUserId?: string | null;
  requestId?: string | null;
  /** Caller must supply empty refs or force after cleanup. */
  references: CmsMediaReference[];
  force?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string; code: string; references?: CmsMediaReference[] }> {
  const siteId = input.siteId ?? DEFAULT_CMS_SITE_ID;
  const id = cmsMediaAssetId(input.assetId);
  const existing = await getCmsMediaAsset(id, siteId);
  if (!existing) {
    return { ok: false, error: "Asset niet gevonden.", code: "not_found" };
  }
  if (existing.status === "deleted") {
    return { ok: true };
  }
  if (!input.force && input.references.length > 0) {
    return {
      ok: false,
      error: "Asset wordt nog gebruikt. Verwijder of vervang referenties eerst.",
      code: "referenced",
      references: input.references,
    };
  }

  const deleteReason = input.reason?.trim() ? input.reason.trim().slice(0, 500) : null;

  const supabase = createSupabaseServiceClient();
  const { error: removeError } = await supabase.storage
    .from(existing.bucketId)
    .remove([existing.storagePath]);
  if (removeError && !/not found|No such/i.test(removeError.message)) {
    return { ok: false, error: removeError.message, code: "storage_delete" };
  }

  const { error } = await mediaClient()
    .from("cms_media_assets")
    .update({
      status: "deleted",
      deleted_at: new Date().toISOString(),
      delete_reason: deleteReason,
    })
    .eq("id", id)
    .eq("site_id", siteId);
  if (error) {
    return { ok: false, error: error.message, code: "catalog_delete" };
  }

  await auditMedia({
    actorUserId: input.actorUserId ?? null,
    action: "cms.media.deleted",
    assetId: id,
    before: {
      status: existing.status,
      storagePath: existing.storagePath,
    },
    after: { status: "deleted", deleteReason },
    requestId: input.requestId ?? null,
  });

  return { ok: true };
}
