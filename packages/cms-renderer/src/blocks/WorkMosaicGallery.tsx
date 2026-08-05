import * as React from "react";
import {
  galleryShapeConfig,
  normalizeGalleryShape,
  type CmsImage,
  type GalleryImageShape,
} from "@mccoy/cms-schema";
import { CmsImageView } from "./CmsImageView";
import {
  GallerySectionIntro,
  GalleryUnifiedPanel,
} from "./GallerySectionIntro";
import { SECTION_PAGE_RAIL } from "../sectionLayout";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type WorkMosaicGalleryItem = {
  id: string;
  title: string;
  caption?: string;
  image: CmsImage;
  /** When set, drives tile span. When omitted, classic Ons-werk index rhythm is used. */
  shape?: GalleryImageShape;
};

export type WorkMosaicGalleryProps = {
  eyebrow?: string;
  heading: string;
  body?: string;
  items: WorkMosaicGalleryItem[];
  /** Override image element (e.g. storefront DeliveryImage). */
  renderImage?: (item: WorkMosaicGalleryItem, className: string) => React.ReactNode;
  className?: string;
  id?: string;
};

/** Desktop/mobile span classes from an explicit editor-selected shape. */
export function workMosaicShapeClass(shape: GalleryImageShape): string {
  return galleryShapeConfig[shape].className;
}

/**
 * Classic Ons-werk mosaic rhythm (pre-shape editor): first tile 2×2, fourth tall.
 * Used only when `item.shape` is unset so published galleries keep their original look.
 */
export function workMosaicLegacyIndexClass(index: number): string {
  if (index === 0) return "col-span-2 row-span-2";
  if (index === 3) return "md:row-span-2";
  return "";
}

function hasExplicitShape(raw: unknown): raw is GalleryImageShape {
  return raw === "wide" || raw === "square" || raw === "tall";
}

/** Infer mosaic span from intrinsic photo orientation when the editor left shape unset. */
function shapeFromImageOrientation(image: CmsImage | undefined): GalleryImageShape | undefined {
  const w = image?.width;
  const h = image?.height;
  if (typeof w !== "number" || typeof h !== "number" || w <= 0 || h <= 0) return undefined;
  if (h > w * 1.12) return "tall";
  if (w > h * 1.12) return "wide";
  return "square";
}

/**
 * Homepage-style photo mosaic: orientation-aware tiles (`object-contain`) with optional
 * per-image shape spans (breed / vierkant / hoog).
 */
export function WorkMosaicGallery({
  eyebrow,
  heading,
  body,
  items,
  renderImage,
  className,
  id = "work",
}: WorkMosaicGalleryProps) {
  return (
    <section id={id} className={className ?? "relative py-24 sm:py-28 lg:py-32"}>
      <div className={SECTION_PAGE_RAIL}>
        <GalleryUnifiedPanel>
          <GallerySectionIntro eyebrow={eyebrow} title={heading} intro={body} />

          {items.length === 0 ? (
            <p className="text-sm text-white/55">Nog geen foto&apos;s in deze galerij.</p>
          ) : (
            <div
              data-cms-gallery-media="mosaic"
              className="grid auto-rows-[220px] grid-cols-2 gap-4 md:grid-cols-4 md:gap-5"
            >
              {items.map((item, index) => {
                const inferred = shapeFromImageOrientation(item.image);
                const spanClass = hasExplicitShape(item.shape)
                  ? workMosaicShapeClass(normalizeGalleryShape(item.shape))
                  : inferred
                    ? workMosaicShapeClass(inferred)
                    : workMosaicLegacyIndexClass(index);
                const imgClass =
                  "absolute inset-0 h-full w-full object-contain object-center p-2";
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group relative overflow-hidden rounded-3xl border border-white/10 bg-black/35",
                      spanClass,
                    )}
                  >
                    {renderImage ? (
                      renderImage(item, imgClass)
                    ) : (
                      <CmsImageView image={item.image} className={imgClass} />
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />
                    <div className="absolute bottom-0 z-10 p-5">
                      <p className="font-display text-xl text-white">{item.title}</p>
                      {item.caption ? (
                        <p className="mt-1 text-sm leading-snug text-white/70">{item.caption}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GalleryUnifiedPanel>
      </div>
    </section>
  );
}
