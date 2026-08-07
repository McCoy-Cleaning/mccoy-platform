import type { CmsImage } from "@mccoy/cms-schema";

/**
 * Prefix relative `/images/...` paths with the storefront (or other) origin.
 * Absolute http(s)/data/blob URLs pass through unchanged.
 */
export function resolveCmsAssetSrc(src: string, assetBaseUrl?: string): string {
  if (!src) return "";
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  if (!assetBaseUrl) return src;
  const path = src.startsWith("/") ? src : `/${src}`;
  return `${assetBaseUrl.replace(/\/$/, "")}${path}`;
}

export function lookupResolvedProjectImage(
  path: string,
  resolveProjectImage?: (path: string) => CmsImage | null,
): CmsImage | null {
  if (!resolveProjectImage) return null;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return resolveProjectImage(normalized) ?? resolveProjectImage(path);
}

/**
 * Prefer seeded Supabase catalog URL over relative `/images/...` (admin origin
 * and http://localhost storefront paths often 404 or are CSP-blocked).
 */
export function resolveProjectThumbSrc(
  path: string,
  options: {
    assetBaseUrl?: string;
    resolveProjectImage?: (path: string) => CmsImage | null;
  },
): string {
  const resolved = lookupResolvedProjectImage(path, options.resolveProjectImage);
  if (resolved?.src) return resolveCmsAssetSrc(resolved.src, options.assetBaseUrl);
  return resolveCmsAssetSrc(path, options.assetBaseUrl);
}

/** Preview src for a stored CmsImage — resolve local project paths via Storage when possible. */
export function resolveCmsImageDisplaySrc(
  src: string,
  options: {
    assetBaseUrl?: string;
    resolveProjectImage?: (path: string) => CmsImage | null;
  },
): string {
  if (!src) return "";
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  return resolveProjectThumbSrc(src, options);
}

/**
 * Once the Storage path map has hits, hide local-only catalog entries that 404
 * on staging/prod. While the map is empty (loading / empty library), keep all.
 */
export function filterProjectImagesForStorage<
  T extends { path: string; label: string; tags?: string[] },
>(projectImages: T[], resolveProjectImage?: (path: string) => CmsImage | null): T[] {
  if (!resolveProjectImage) return projectImages;
  const resolvedOnly = projectImages.filter((img) =>
    Boolean(lookupResolvedProjectImage(img.path, resolveProjectImage)),
  );
  return resolvedOnly.length > 0 ? resolvedOnly : projectImages;
}
