import * as React from "react";
import type { CmsImage } from "@mccoy/cms-schema";

export type LinkResolverPages = Array<{ id: string; slug: string }>;

export function CmsImageView({
  image,
  className,
  onNaturalSize,
}: {
  image: CmsImage;
  className?: string;
  /** Fired once dimensions are known (metadata or decode). */
  onNaturalSize?: (size: { width: number; height: number }) => void;
}) {
  const setImgRef = (el: HTMLImageElement | null) => {
    if (!el) return;
    if (el.complete && el.naturalWidth > 0) {
      onNaturalSize?.({ width: el.naturalWidth, height: el.naturalHeight });
    }
  };

  const common = {
    src: image.src,
    className,
    loading: "lazy" as const,
    decoding: "async" as const,
    width: image.width,
    height: image.height,
    ref: setImgRef,
    onLoad: (e: React.SyntheticEvent<HTMLImageElement>) => {
      const el = e.currentTarget;
      if (el.naturalWidth > 0 && el.naturalHeight > 0) {
        onNaturalSize?.({ width: el.naturalWidth, height: el.naturalHeight });
      }
    },
  };
  if (image.decorative) {
    return <img {...common} alt="" role="presentation" />;
  }
  return <img {...common} alt={image.alt} />;
}
