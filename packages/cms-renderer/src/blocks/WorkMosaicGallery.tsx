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
    <section id={id} className={className ?? "relative py-24 sm:py-28"}>
      <div className={SECTION_PAGE_RAIL}>
        <div className="max-w-2xl">
          {eyebrow ? (
            <div className="flex items-center gap-3">
              <span
                className="h-px w-8 shrink-0 bg-primary/80 sm:w-10"
                aria-hidden
              />
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary sm:text-xs">
                {eyebrow}
              </p>
            </div>
          ) : null}
          <h2
            className={cn(
              "font-display text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-white break-words sm:text-5xl lg:text-[3.25rem]",
              eyebrow ? "mt-5 sm:mt-6" : undefined,
            )}
          >
            {heading}
          </h2>
          {eyebrow || heading ? (
            <div
              className="mt-6 h-px w-20 bg-gradient-to-r from-primary via-primary/55 to-transparent sm:w-24"
              aria-hidden
            />
          ) : null}
          {body ? (
            <p className="mt-6 max-w-xl whitespace-pre-line text-[15px] leading-[1.75] text-white/65 sm:mt-7 sm:text-lg sm:leading-[1.7]">
              {body}
            </p>
          ) : null}
        </div>

        {items.length === 0 ? (
          <p className="mt-14 text-sm text-white/55">Nog geen foto&apos;s in deze galerij.</p>
        ) : (
          <div className="mt-14 grid auto-rows-[220px] grid-cols-2 gap-3 sm:mt-16 sm:gap-4 md:grid-cols-4 md:gap-5">
            {items.map((item, index) => {
              const spanClass = hasExplicitShape(item.shape)
                ? workMosaicShapeClass(normalizeGalleryShape(item.shape))
                : workMosaicLegacyIndexClass(index);
              const imgClass =
                "absolute inset-0 h-full w-full object-cover object-center transition duration-700 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100";
              return (
                <figure
                  key={item.id}
                  className={cn(
                    "group relative overflow-hidden rounded-[1.35rem] bg-white/[0.03]",
                    "ring-1 ring-inset ring-white/12",
                    "transition-[box-shadow,ring-color] duration-500",
                    "hover:ring-white/22 hover:shadow-[0_22px_48px_-30px_rgba(0,0,0,0.7)]",
                    "focus-within:ring-primary/45 focus-within:outline-none",
                    "motion-reduce:transition-none motion-reduce:hover:shadow-none",
                    spanClass,
                  )}
                >
                  {renderImage ? (
                    renderImage(item, imgClass)
                  ) : (
                    <CmsImageView image={item.image} className={imgClass} />
                  )}
                  <div
                    className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/35 to-transparent opacity-95"
                    aria-hidden
                  />
                  <figcaption className="absolute bottom-0 z-10 w-full p-4 sm:p-5">
                    <p className="font-display text-lg font-semibold leading-snug tracking-[-0.02em] text-white sm:text-xl">
                      {item.title}
                    </p>
                    {item.caption ? (
                      <p className="mt-1.5 text-sm leading-snug text-white/68">
                        {item.caption}
                      </p>
                    ) : null}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
