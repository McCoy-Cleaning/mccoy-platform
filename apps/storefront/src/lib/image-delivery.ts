/**
 * Delivery helpers for local `/images/...` assets and Supabase `cms-media`
 * public URLs (Image Transformation / render endpoint).
 *
 * See scripts/optimize-storefront-delivery-images.mjs for local variants.
 */

export function isLocalPublicImageSrc(src: string | undefined): boolean {
  return Boolean(src && src.startsWith("/images/") && !src.includes("://"));
}

const SUPABASE_OBJECT_PUBLIC =
  /^(https:\/\/[^/]+\.supabase\.co)\/storage\/v1\/object\/public\/([^?]+)(\?.*)?$/i;

/** Partner master PNG → 480w WebP display variant path. */
export function partnerLogoWebpSrc(src: string): string | undefined {
  if (!isLocalPublicImageSrc(src)) return undefined;
  if (!src.includes("/images/partners/") || !/\.png$/i.test(src)) return undefined;
  return src.replace(/\.png$/i, "-w480.webp");
}

/**
 * Hero CMS / public JPEG → responsive WebP srcset (640 / 960 / 1280).
 * Only applies to the known optimized hero filename.
 */
export function heroWebpSrcSet(src: string): string | undefined {
  if (!/hero-cleaning/i.test(src)) return undefined;
  if (!isLocalPublicImageSrc(src)) return undefined;
  const base = src.replace(/-\d+\.webp$/i, ".jpg").replace(/\.(jpe?g|webp)$/i, "");
  return `${base}-640.webp 640w, ${base}-960.webp 960w, ${base}-1280.webp 1280w`;
}

/** Same-directory `.webp` sibling for a local jpeg/png path.
 * Only use when the WebP is known to exist (e.g. optimize script output).
 * Inventing this path for gallery CMS photos causes 404s — prefer JPEG/PNG. */
export function localWebpSibling(src: string): string | undefined {
  if (!isLocalPublicImageSrc(src)) return undefined;
  if (/\.webp$/i.test(src)) return src;
  // Partner display variants from optimize-storefront-delivery-images.mjs
  if (src.includes("/images/partners/") && /\.png$/i.test(src)) {
    return src.replace(/\.png$/i, ".webp");
  }
  // Nav/logo PNG ↔ WebP when generated beside the master
  if (/\/images\/(logo|brand)\//i.test(src) && /\.png$/i.test(src)) {
    return src.replace(/\.png$/i, ".webp");
  }
  return undefined;
}

/**
 * Rewrite Supabase public object URLs to the Image Transformation render API.
 * Falls back to the original URL when the pattern does not match.
 *
 * @param opts.resize - Supabase default is `cover` (crops). Use `contain` for logos.
 */
export function supabaseTransformedUrl(
  src: string,
  opts: {
    width: number;
    height?: number;
    quality?: number;
    format?: "origin" | "webp";
    resize?: "cover" | "contain" | "fill";
  },
): string {
  const match = src.match(SUPABASE_OBJECT_PUBLIC);
  if (!match) return src;
  const [, host, path] = match;
  const params = new URLSearchParams({
    width: String(opts.width),
    quality: String(opts.quality ?? 75),
  });
  if (opts.height != null) params.set("height", String(opts.height));
  if (opts.format) params.set("format", opts.format);
  if (opts.resize) params.set("resize", opts.resize);
  return `${host}/storage/v1/render/image/public/${path}?${params.toString()}`;
}

export function isSupabaseCmsMediaUrl(src: string): boolean {
  return SUPABASE_OBJECT_PUBLIC.test(src);
}

/** Responsive WebP (+ JPEG fallback) srcset for Supabase CMS photos. */
export function supabasePhotoSrcSets(
  src: string,
  widths: number[] = [640, 960, 1280],
  opts?: { resize?: "cover" | "contain" | "fill" },
): { webpSrcSet: string; jpegSrcSet: string; fallbackSrc: string } | undefined {
  if (!isSupabaseCmsMediaUrl(src)) return undefined;
  const resize = opts?.resize;
  const webpSrcSet = widths
    .map(
      (w) =>
        `${supabaseTransformedUrl(src, { width: w, quality: 72, format: "webp", resize })} ${w}w`,
    )
    .join(", ");
  const jpegSrcSet = widths
    .map(
      (w) =>
        `${supabaseTransformedUrl(src, { width: w, quality: 75, format: "origin", resize })} ${w}w`,
    )
    .join(", ");
  const fallbackSrc = supabaseTransformedUrl(src, {
    width: widths[Math.min(1, widths.length - 1)] ?? 960,
    quality: 75,
    format: "origin",
    resize,
  });
  return { webpSrcSet, jpegSrcSet, fallbackSrc };
}

/** Smaller display variants for partner logos stored in Supabase. */
export function supabaseLogoSrc(
  src: string,
  width = 480,
): { webpSrc: string; fallbackSrc: string } | undefined {
  if (!isSupabaseCmsMediaUrl(src)) return undefined;
  // width-only + default resize=cover crops wordmarks; contain keeps the full mark.
  return {
    webpSrc: supabaseTransformedUrl(src, {
      width,
      quality: 85,
      format: "webp",
      resize: "contain",
    }),
    fallbackSrc: supabaseTransformedUrl(src, {
      width,
      quality: 85,
      format: "origin",
      resize: "contain",
    }),
  };
}

export const HERO_IMAGE_SIZES = "(min-width: 1024px) 28rem, min(92vw, 28rem)";
export const PARTNER_LOGO_SIZES = "(min-width: 640px) 12rem, 10rem";
export const GALLERY_IMAGE_SIZES = "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";
export const NAV_LOGO_WIDTH = 480;
export const NAV_LOGO_HEIGHT = 320;
