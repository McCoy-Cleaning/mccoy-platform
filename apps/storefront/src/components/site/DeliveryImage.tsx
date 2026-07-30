import type { ImgHTMLAttributes } from "react";
import {
  GALLERY_IMAGE_SIZES,
  HERO_IMAGE_SIZES,
  heroWebpSrcSet,
  supabasePhotoSrcSets,
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
 * Serves explicit WebP srcsets (e.g. hero variants) and Supabase Image
 * Transformation for cms-media URLs. Local `/images/cms` JPEGs/PNGs are served
 * as-is — do not invent sibling `.webp` paths (many were never generated and 404).
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
  const webpSrcSet = webpSrcSetProp ?? localHero ?? remote?.webpSrcSet;

  // Prefer a WebP URL as <img src> so Chromium doesn’t paint the heavy JPEG
  // fallback first (Lighthouse “Improve image delivery”).
  const imgSrc =
    (webpSrcSet ? firstSrcFromSrcSet(webpSrcSet) : undefined) ??
    remote?.fallbackSrc ??
    src;

  if (webpSrcSet) {
    return (
      <picture>
        <source type="image/webp" srcSet={webpSrcSet} sizes={resolvedSizes} />
        {remote?.jpegSrcSet ? (
          <source type="image/jpeg" srcSet={remote.jpegSrcSet} sizes={resolvedSizes} />
        ) : null}
        <img src={imgSrc} alt={alt} sizes={resolvedSizes} className={className} {...rest} />
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
          {...rest}
        />
      </picture>
    );
  }

  return <img src={src} alt={alt} sizes={resolvedSizes} className={className} {...rest} />;
}

function firstSrcFromSrcSet(srcSet: string): string | undefined {
  const first = srcSet.split(",")[0]?.trim();
  if (!first) return undefined;
  return first.split(/\s+/)[0] || undefined;
}
