import type { ImgHTMLAttributes } from "react";
import {
  GALLERY_IMAGE_SIZES,
  HERO_IMAGE_SIZES,
  heroWebpSrcSet,
  supabasePhotoSrcSets,
  localCmsPhotoWebpSrcSet,
} from "@/lib/image-delivery";

type DeliveryImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string;
  alt: string;
  /** Prefer hero widths/sizes; default gallery. */
  variant?: "hero" | "gallery" | "photo";
  /** Optional precomputed WebP srcset (e.g. Vite-bundled hero variants). */
  webpSrcSet?: string;
};

/**
 * Serves explicit WebP srcsets (e.g. hero variants), allowlisted local CMS
 * WebP siblings from the optimize script, and Supabase Image Transformation
 * for cms-media URLs. Unknown local paths stay as-is (no invented 404 WebPs).
 */
export function DeliveryImage({
  src,
  alt,
  variant = "gallery",
  sizes,
  className,
  webpSrcSet: webpSrcSetProp,
  ...rest
}: DeliveryImageProps) {
  const resolvedSizes =
    sizes ?? (variant === "hero" ? HERO_IMAGE_SIZES : GALLERY_IMAGE_SIZES);
  const widths = variant === "hero" ? [640, 960, 1280] : [480, 800, 1200];

  const localHero = variant === "hero" ? heroWebpSrcSet(src) : undefined;
  // Width-only + `cover` can still over-crop some CDN variants; deliver the full
  // frame and let CSS (`object-cover` / `object-contain`) decide the tile crop.
  const remote = supabasePhotoSrcSets(src, widths, { resize: "contain" });
  const localCms =
    !localHero && !remote && (variant === "gallery" || variant === "photo")
      ? localCmsPhotoWebpSrcSet(src)
      : undefined;
  const webpSrcSet = webpSrcSetProp ?? localHero ?? remote?.webpSrcSet ?? localCms;

  // Prefer a WebP URL as <img src> so Chromium doesn’t paint the heavy JPEG
  // fallback first (Lighthouse “Improve image delivery”).
  const imgSrc =
    (webpSrcSet ? firstSrcFromSrcSet(webpSrcSet) : undefined) ??
    remote?.fallbackSrc ??
    src;

  const loading = rest.loading ?? (variant === "hero" ? undefined : "lazy");
  const decoding = rest.decoding ?? "async";
  const imgProps = { ...rest, loading, decoding };

  if (webpSrcSet) {
    return (
      <picture>
        <source type="image/webp" srcSet={webpSrcSet} sizes={resolvedSizes} />
        {remote?.jpegSrcSet ? (
          <source type="image/jpeg" srcSet={remote.jpegSrcSet} sizes={resolvedSizes} />
        ) : null}
        <img src={imgSrc} alt={alt} sizes={resolvedSizes} className={className} {...imgProps} />
      </picture>
    );
  }

  if (remote) {
    return (
      <picture>
        <source type="image/webp" srcSet={remote.webpSrcSet} sizes={resolvedSizes} />
        <source type="image/jpeg" srcSet={remote.jpegSrcSet} sizes={resolvedSizes} />
        <img
          src={remote.fallbackSrc}
          alt={alt}
          sizes={resolvedSizes}
          className={className}
          {...imgProps}
        />
      </picture>
    );
  }

  return <img src={src} alt={alt} sizes={resolvedSizes} className={className} {...imgProps} />;
}

function firstSrcFromSrcSet(srcSet: string): string | undefined {
  const first = srcSet.split(",")[0]?.trim();
  if (!first) return undefined;
  return first.split(/\s+/)[0] || undefined;
}
