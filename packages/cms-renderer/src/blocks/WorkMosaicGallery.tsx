import * as React from "react";
import type { CmsImage } from "@mccoy/cms-schema";
import { CmsImageView } from "./primitives";

export type WorkMosaicGalleryItem = {
  id: string;
  title: string;
  caption?: string;
  image: CmsImage;
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

/** Span classes matching the legacy WorkGallery mosaic. */
export function workMosaicTileClass(index: number, total: number): string {
  const featured = total >= 3 && index === 0 ? "col-span-2 row-span-2" : "";
  const tall = total >= 4 && index === 3 ? "md:row-span-2" : "";
  return [featured, tall].filter(Boolean).join(" ");
}

/**
 * Homepage-style photo mosaic: eyebrow + heading + body, then a responsive
 * featured grid of titled photos (original McCoy “Ons werk” layout).
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
            ) : null}
            <h2 className="font-display mt-4 text-4xl text-white md:text-5xl">{heading}</h2>
            {body ? <p className="mt-4 text-white/65">{body}</p> : null}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="mt-14 text-sm text-white/55">Nog geen foto&apos;s in deze galerij.</p>
        ) : (
          <div className="mt-14 grid auto-rows-[220px] grid-cols-2 gap-4 md:grid-cols-4">
            {items.map((item, i) => {
              const imgClass =
                "h-full w-full object-cover transition duration-700 md:group-hover:scale-110 motion-reduce:transition-none motion-reduce:md:group-hover:scale-100";
              return (
                <div
                  key={item.id}
                  className={`group relative overflow-hidden rounded-3xl border border-white/10 ${workMosaicTileClass(i, items.length)}`}
                >
                  {renderImage ? (
                    renderImage(item, imgClass)
                  ) : (
                    <CmsImageView image={item.image} className={imgClass} />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />
                  <div className="absolute bottom-0 p-5">
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
