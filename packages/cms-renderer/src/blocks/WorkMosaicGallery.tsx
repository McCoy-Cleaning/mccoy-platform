import * as React from "react";
import {
  galleryShapeConfig,
  normalizeGalleryShape,
  type CmsImage,
  type GalleryImageShape,
} from "@mccoy/cms-schema";
import { CmsImageView } from "./primitives";
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

/**
 * Homepage-style photo mosaic: classic filled tiles (`object-cover`) with optional
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
    <section id={id} className={className ?? "relative py-24"}>
      <div className={SECTION_PAGE_RAIL}>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
            ) : null}
            <h2 className="font-display mt-4 text-4xl text-white md:text-5xl">{heading}</h2>
            {body ? <p className="mt-4 whitespace-pre-line text-white/65">{body}</p> : null}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="mt-14 text-sm text-white/55">Nog geen foto&apos;s in deze galerij.</p>
        ) : (
          <div className="mt-14 grid auto-rows-[220px] grid-cols-2 gap-4 md:grid-cols-4">
            {items.map((item, index) => {
              const spanClass = hasExplicitShape(item.shape)
                ? workMosaicShapeClass(normalizeGalleryShape(item.shape))
                : workMosaicLegacyIndexClass(index);
              const imgClass =
                "absolute inset-0 h-full w-full object-cover object-center transition duration-700 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100";
              return (
                <div
                  key={item.id}
                  className={cn(
                    "group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]",
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
      </div>
    </section>
  );
}
