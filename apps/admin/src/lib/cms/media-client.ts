import {
  adminListCmsMedia,
  adminUploadCmsMedia,
  adminUpdateCmsMediaMeta,
  adminArchiveCmsMedia,
  adminRestoreCmsMedia,
  adminDeleteCmsMedia,
  adminFindCmsMediaReferences,
  adminMigrateLegacyCmsImage,
  adminScanPageLegacyImages,
  adminResolveCmsMediaBySourcePath,
} from "@/lib/api/cms-media.functions";
import type { CmsImage } from "@mccoy/cms-schema";
import { prepareCmsImageUpload, type CmsImageCompressProfile, type LogoBackdropResolved } from "@mccoy/cms-schema";

export type CmsMediaAssetDto = {
  id: string;
  publicUrl: string;
  originalFilename: string | null;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  altDefault: string;
  tags: string[];
  profile: "photo" | "logo" | "gif";
  status: "active" | "archived" | "deleted";
  createdAt: string;
};

function mapProfile(profile: CmsImageCompressProfile | "gif"): "photo" | "logo" | "gif" {
  if (profile === "gif") return "gif";
  return profile;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function assetToCmsImage(asset: CmsMediaAssetDto, alt?: string): CmsImage {
  return {
    assetId: `storage:${asset.id}`,
    src: asset.publicUrl,
    alt: alt ?? asset.altDefault ?? "",
    decorative: false,
    width: asset.width,
    height: asset.height,
  };
}

/** Build path → Storage image map from `source:/images/...` catalog tags. */
export function buildSourcePathImageMap(
  assets: Array<Pick<CmsMediaAssetDto, "id" | "publicUrl" | "altDefault" | "width" | "height" | "tags">>,
): Record<string, CmsImage> {
  const out: Record<string, CmsImage> = {};
  for (const asset of assets) {
    for (const tag of asset.tags ?? []) {
      if (!tag.startsWith("source:/images/")) continue;
      const path = tag.slice("source:".length);
      out[path] = assetToCmsImage(asset as CmsMediaAssetDto);
    }
  }
  return out;
}

/** Compress in browser, then upload via authorize/finalize-equivalent serverFn. */
export async function uploadCmsMediaFromFile(opts: {
  file: File;
  profile: CmsImageCompressProfile | "gif";
  altDefault?: string;
  tags?: string[];
  idempotencyKey?: string;
}): Promise<
  | {
      ok: true;
      image: CmsImage;
      asset: CmsMediaAssetDto;
      reused: boolean;
      logoBackdrop?: LogoBackdropResolved;
    }
  | { ok: false; error: string; code?: string }
> {
  if (opts.profile === "gif") {
    if (opts.file.size > 900 * 1024) {
      return { ok: false, error: "GIF mag maximaal 900 KB zijn.", code: "too_large" };
    }
    const buf = new Uint8Array(await opts.file.arrayBuffer());
    const bytesBase64 = bytesToBase64(buf);
    const result = await adminUploadCmsMedia({
      data: {
        profile: "gif",
        bytesBase64,
        originalFilename: opts.file.name,
        altDefault: opts.altDefault,
        tags: opts.tags,
        idempotencyKey: opts.idempotencyKey,
      },
    });
    if (!result.ok) return result;
    return {
      ok: true,
      image: result.image,
      asset: result.asset as CmsMediaAssetDto,
      reused: result.reused,
    };
  }

  const prepared = await prepareCmsImageUpload(opts.file, { profile: opts.profile });
  if (!prepared.ok) {
    return { ok: false, error: prepared.reason, code: "compress" };
  }

  const result = await adminUploadCmsMedia({
    data: {
      profile: mapProfile(opts.profile),
      bytesBase64: prepared.dataUrl,
      originalFilename: opts.file.name,
      altDefault: opts.altDefault,
      tags: opts.tags,
      idempotencyKey: opts.idempotencyKey,
    },
  });
  if (!result.ok) return result;
  return {
    ok: true,
    image: result.image,
    asset: result.asset as CmsMediaAssetDto,
    reused: result.reused,
    ...(prepared.logoBackdrop ? { logoBackdrop: prepared.logoBackdrop } : {}),
  };
}

export async function listCmsMediaLibrary(opts?: {
  q?: string;
  profile?: "photo" | "logo" | "gif";
  tags?: string[];
  status?: "active" | "archived";
  cursor?: { createdAt: string; id: string } | null;
}) {
  return adminListCmsMedia({
    data: {
      q: opts?.q,
      profile: opts?.profile,
      tags: opts?.tags,
      status: opts?.status ?? "active",
      cursor: opts?.cursor ?? null,
      limit: 48,
    },
  });
}

/** Prefer Storage catalog for seeded `/images/...` picks; fall back to local path. */
export async function resolveCmsProjectImagePath(
  publicPath: string,
): Promise<{ ok: true; image: CmsImage; fromStorage: boolean } | { ok: false; error: string }> {
  const normalized = publicPath.startsWith("/") ? publicPath : `/${publicPath}`;
  const result = await adminResolveCmsMediaBySourcePath({ data: { publicPath: normalized } });
  if (result.ok) {
    return { ok: true, image: result.image, fromStorage: true };
  }
  if (result.code === "not_found" && normalized.startsWith("/images/")) {
    return {
      ok: true,
      image: {
        assetId: `local:${normalized.replace(/^\//, "")}`,
        src: normalized,
        alt: "",
        decorative: false,
      },
      fromStorage: false,
    };
  }
  return { ok: false, error: result.error };
}

export {
  adminUpdateCmsMediaMeta,
  adminArchiveCmsMedia,
  adminRestoreCmsMedia,
  adminDeleteCmsMedia,
  adminFindCmsMediaReferences,
  adminMigrateLegacyCmsImage,
  adminScanPageLegacyImages,
  adminResolveCmsMediaBySourcePath,
  assetToCmsImage,
};
