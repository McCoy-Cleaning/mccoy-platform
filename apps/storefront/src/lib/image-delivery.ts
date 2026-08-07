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

/** CMS filenames that `optimize-storefront-delivery-images.mjs` emits as `.webp`. */
const LOCAL_CMS_WEBP_BASENAMES = new Set([
  "about-history",
  "about-vision",
  "about-vision-alt",
  "about-mission",
  "products-flyer",
  "work-horeca",
  "work-regular",
  "work-oplevering",
  "work-floor",
  "work-glass",
  "work-glass-van",
  "work-oplevering-hal",
  "work-regular-sander",
  "work-floor-scrubber",
  "work-furniture-bank",
]);

/**
 * Same-directory `.webp` sibling for a local jpeg/png path.
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
  // Known CMS delivery photos with sibling `.webp` from the optimize script.
  if (src.includes("/images/cms/") && /\.(jpe?g|png)$/i.test(src)) {
    const base = src.split("/").pop()?.replace(/\.(jpe?g|png)$/i, "") ?? "";
    if (LOCAL_CMS_WEBP_BASENAMES.has(base)) {
      return src.replace(/\.(jpe?g|png)$/i, ".webp");
    }
  }
  return undefined;
}

/** Gallery/photo WebP srcset for known local CMS delivery variants. */
export function localCmsPhotoWebpSrcSet(src: string): string | undefined {
  const sibling = localWebpSibling(src);
  if (!sibling || !src.includes("/images/cms/")) return undefined;
  return `${sibling} 1200w`;
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
/**
 * Hero sits beside copy only from `lg` up. On mobile the H1 is the LCP element —
 * preloading the photo competes with CSS/JS on Slow 4G and hurts Speed Index.
 */
export const HERO_IMAGE_PRELOAD_MEDIA = "(min-width: 1024px)";
export const PARTNER_LOGO_SIZES = "(min-width: 640px) 12rem, 10rem";
/** Wider page rail (max ~96rem) — keep mosaic tiles from requesting oversized originals. */
export const GALLERY_IMAGE_SIZES =
  "(min-width: 1536px) 480px, (min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw";
/** Service card rail — 3-col desktop, 2-col tablet, full-bleed mobile. */
export const SERVICES_CARD_IMAGE_SIZES =
  "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw";
/** Desktop first row shows three cards; mobile only needs the first tile early. */
export const SERVICES_CARD_ROW_PRELOAD_MEDIA = "(min-width: 1024px)";
export const NAV_LOGO_WIDTH = 480;
export const NAV_LOGO_HEIGHT = 320;

export type HomeHeroPreloadLink = {
  rel: "preload";
  as: "image";
  type: "image/webp";
  href: string;
  imageSrcSet: string;
  imageSizes: string;
  fetchPriority: "high";
  media: string;
};

export type ServicesCardPreloadLink = {
  rel: "preload";
  as: "image";
  type?: "image/webp";
  href: string;
  imageSrcSet?: string;
  imageSizes?: string;
  fetchPriority: "high" | "low" | "auto";
  media?: string;
};

/** Desktop-only hero image preload for `/` and `/en` head links. */
export function homeHeroPreloadLink(heroSrc: string): HomeHeroPreloadLink {
  // Match DeliveryImage hero (`resize: "contain"`) so preload URL === <img> URL.
  const remote = supabasePhotoSrcSets(heroSrc, [640, 960, 1280], { resize: "contain" });
  const webpSrcSet =
    remote?.webpSrcSet ??
    heroWebpSrcSet(heroSrc) ??
    "/images/cms/hero-cleaning-640.webp 640w, /images/cms/hero-cleaning-960.webp 960w, /images/cms/hero-cleaning-1280.webp 1280w";
  const preloadHref = remote
    ? supabaseTransformedUrl(heroSrc, {
        width: 640,
        quality: 72,
        format: "webp",
        resize: "contain",
      })
    : "/images/cms/hero-cleaning-640.webp";
  return {
    rel: "preload",
    as: "image",
    type: "image/webp",
    href: preloadHref,
    imageSrcSet: webpSrcSet,
    imageSizes: HERO_IMAGE_SIZES,
    fetchPriority: "high",
    media: HERO_IMAGE_PRELOAD_MEDIA,
  };
}

/**
 * Match DeliveryImage gallery/photo delivery for a single CMS card src so head
 * preload URL === the URL the `<img>` will request.
 */
function galleryPhotoDeliveryUrls(src: string): {
  href: string;
  webpSrcSet?: string;
  type?: "image/webp";
} | null {
  if (!src || src.includes("placeholder")) return null;
  const remote = supabasePhotoSrcSets(src, [480, 800, 1200], { resize: "contain" });
  if (remote) {
    return {
      href: supabaseTransformedUrl(src, {
        width: 480,
        quality: 72,
        format: "webp",
        resize: "contain",
      }),
      webpSrcSet: remote.webpSrcSet,
      type: "image/webp",
    };
  }
  const localCms = localCmsPhotoWebpSrcSet(src);
  if (localCms) {
    const href = localCms.split(",")[0]?.trim().split(/\s+/)[0];
    if (!href) return null;
    return { href, webpSrcSet: localCms, type: "image/webp" };
  }
  if (isLocalPublicImageSrc(src)) {
    return { href: src };
  }
  return null;
}

/**
 * Preload above-the-fold service card photos for `/services`.
 * Card 0: all viewports (often LCP after the H1). Cards 1–2: desktop row only.
 */
export function servicesCardsPreloadLinks(
  imageSrcs: readonly string[],
): ServicesCardPreloadLink[] {
  const links: ServicesCardPreloadLink[] = [];
  const seen = new Set<string>();
  imageSrcs.slice(0, 3).forEach((src, i) => {
    const delivery = galleryPhotoDeliveryUrls(src);
    if (!delivery || seen.has(delivery.href)) return;
    seen.add(delivery.href);
    links.push({
      rel: "preload",
      as: "image",
      href: delivery.href,
      ...(delivery.type ? { type: delivery.type } : {}),
      ...(delivery.webpSrcSet
        ? {
            imageSrcSet: delivery.webpSrcSet,
            imageSizes: SERVICES_CARD_IMAGE_SIZES,
          }
        : {}),
      fetchPriority: i === 0 ? "high" : "auto",
      ...(i > 0 ? { media: SERVICES_CARD_ROW_PRELOAD_MEDIA } : {}),
    });
  });
  return links;
}
