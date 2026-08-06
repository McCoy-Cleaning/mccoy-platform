import * as React from "react";
import {
  normalizeGalleryColumns,
  normalizeGalleryTextPlacement,
  type CmsImage,
  type GalleryColumns,
  type GalleryTextPlacement,
} from "@mccoy/cms-schema";
import { CmsImageView } from "./CmsImageView";
import {
  GallerySectionIntro,
  GalleryUnifiedPanel,
} from "./GallerySectionIntro";
import { SectionShell } from "../SectionShell";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type GalleryTextAndImageItem = {
  id: string;
  image: CmsImage;
  title?: string;
  caption?: string;
  body?: string;
};

export type GalleryTextAndImageProps = {
  title: string;
  eyebrow?: string;
  intro?: string;
  items: GalleryTextAndImageItem[];
  textPlacement?: GalleryTextPlacement;
  columns?: GalleryColumns;
};

type CopyFields = {
  title?: string;
  caption?: string;
  body?: string;
};

function readCopy(item: GalleryTextAndImageItem): CopyFields | null {
  const title = item.title?.trim() || undefined;
  const caption = item.caption?.trim() || undefined;
  const body = item.body?.trim() || undefined;
  if (!title && !caption && !body) return null;
  return { title, caption, body };
}

function formatIndex(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function gridColumnsClass(columns: GalleryColumns): string {
  if (columns === 4) return "sm:grid-cols-2 xl:grid-cols-4";
  if (columns === 3) return "sm:grid-cols-2 lg:grid-cols-3";
  return "sm:grid-cols-2";
}

/**
 * Tall media plane: edge-to-edge cover, index chip, depth overlays.
 */
function ServicePhoto({
  image,
  index,
  className,
}: {
  image: CmsImage;
  index: number;
  className?: string;
}) {
  return (
    <div
      data-cms-media-fit="portrait-cover"
      className={cn(
        "relative aspect-[3/4] w-full shrink-0 overflow-hidden",
        "bg-[#0a1220]",
        className,
      )}
    >
      <CmsImageView
        image={image}
        className="absolute inset-0 h-full w-full object-cover object-center transition duration-700 ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0a1220]/via-[#0a1220]/35 via-35% to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-transparent opacity-80"
        aria-hidden
      />
      <div
        className="absolute left-4 top-4 z-[1] flex h-11 w-11 items-center justify-center rounded-full border border-primary/45 bg-[#0a1220]/75 font-display text-sm font-semibold tabular-nums tracking-[0.08em] text-primary shadow-[0_12px_32px_-12px_rgba(63,182,242,0.75)] backdrop-blur-md sm:left-5 sm:top-5 sm:h-12 sm:w-12 sm:text-[0.9375rem]"
        aria-hidden
      >
        {formatIndex(index)}
      </div>
    </div>
  );
}

function ServiceCopy({
  fields,
  textFirst,
}: {
  fields: CopyFields;
  textFirst: boolean;
}) {
  const { title, caption, body } = fields;
  const bodyOnly = !title && !caption && !!body;

  return (
    <div
      data-cms-gallery-copy="service"
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1 flex-col px-5 pb-6 pt-5 text-left sm:px-6 sm:pb-7 sm:pt-6",
        textFirst ? "order-first border-b border-white/10" : null,
      )}
    >
      {caption ? (
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.2em] text-primary/75">
          {caption}
        </p>
      ) : null}

      {title ? (
        <h3
          className={cn(
            "font-display min-h-[2.75em] text-[1.05rem] font-semibold uppercase leading-[1.2] tracking-[0.08em] text-primary break-words sm:min-h-[2.6em] sm:text-[1.125rem] sm:tracking-[0.1em]",
            caption ? "mt-2" : null,
          )}
        >
          {title}
        </h3>
      ) : null}

      {(title || caption) && body ? (
        <div
          className="mt-3.5 h-px w-10 bg-gradient-to-r from-primary/80 to-transparent sm:mt-4"
          aria-hidden
        />
      ) : null}

      {body ? (
        <p
          className={cn(
            "whitespace-pre-wrap break-words",
            bodyOnly
              ? "min-h-[3.2em] font-display text-lg font-semibold leading-[1.25] tracking-[-0.02em] text-[#f2f4f7]"
              : cn(
                  "mt-3.5 min-h-[5.25rem] text-sm leading-[1.7] text-white/68 line-clamp-4 sm:mt-4 sm:min-h-[5.5rem] sm:text-[0.9375rem] sm:leading-[1.72]",
                  !title && !caption ? "mt-0" : undefined,
                ),
          )}
        >
          {body}
        </p>
      ) : null}

      <div className="mt-auto pt-5" aria-hidden>
        <span className="block h-px w-full bg-gradient-to-r from-primary/35 via-white/10 to-transparent opacity-80 transition-opacity duration-500 group-hover:opacity-100" />
      </div>
    </div>
  );
}

function ServiceColumn({
  item,
  index,
  textFirst,
}: {
  item: GalleryTextAndImageItem;
  index: number;
  textFirst: boolean;
}) {
  const fields = readCopy(item);
  const copy = fields ? (
    <ServiceCopy fields={fields} textFirst={textFirst} />
  ) : null;

  return (
    <article
      data-cms-gallery-item="service"
      data-cms-gallery-tile="premium"
      className={cn(
        "group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[1.75rem]",
        "border border-white/[0.1] bg-gradient-to-b from-white/[0.07] via-white/[0.03] to-[#0a1220]/80",
        "shadow-[0_24px_60px_-40px_rgba(0,0,0,0.9)]",
        "transition-[transform,box-shadow,border-color] duration-500 ease-out",
        "hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_36px_72px_-36px_rgba(63,182,242,0.35)]",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-70"
        aria-hidden
      />
      {textFirst ? copy : null}
      <ServicePhoto image={item.image} index={index} />
      {!textFirst ? copy : null}
    </article>
  );
}

/** Side-by-side rows — compact intrinsic photo beside copy (left/right placement). */
function RowCopy({
  fields,
  className,
}: {
  fields: CopyFields;
  className?: string;
}) {
  const { title, caption, body } = fields;
  const bodyOnly = !title && !caption && !!body;
  const hasLead = !!(title || caption);

  return (
    <div className={cn("min-w-0 flex flex-col justify-center text-left", className)}>
      {caption ? (
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.18em] text-primary/80">
          {caption}
        </p>
      ) : null}
      {title ? (
        <h3
          className={cn(
            "font-display max-w-[18ch] text-3xl font-semibold leading-[1.05] tracking-[-0.035em] text-[#f2f4f7] break-words sm:text-4xl lg:text-[2.65rem] lg:leading-[1.02]",
            caption ? "mt-3.5" : undefined,
          )}
        >
          {title}
        </h3>
      ) : null}
      {body ? (
        <p
          className={cn(
            "whitespace-pre-wrap break-words",
            bodyOnly
              ? "font-display max-w-[18ch] text-2xl font-semibold leading-[1.12] tracking-[-0.03em] text-[#f2f4f7] sm:text-3xl"
              : cn(
                  "max-w-md text-base leading-relaxed text-white/64 sm:text-[1.0625rem] sm:leading-[1.7]",
                  hasLead ? "mt-5 sm:mt-6" : undefined,
                ),
          )}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Text+image gallery: premium equal tiles (media + copy) with edge-to-edge cover photos.
 */
export function GalleryTextAndImageView({
  title,
  eyebrow,
  intro,
  items,
  textPlacement: textPlacementRaw,
  columns: columnsRaw,
}: GalleryTextAndImageProps) {
  const textPlacement = normalizeGalleryTextPlacement(textPlacementRaw);
  const columns = normalizeGalleryColumns(columnsRaw);
  const sideBySide = textPlacement === "left" || textPlacement === "right";
  const textFirst =
    textPlacement === "above" || textPlacement === "left";

  return (
    <SectionShell blockType="gallery">
      <GalleryUnifiedPanel>
        <GallerySectionIntro eyebrow={eyebrow} title={title} intro={intro} />

        {items.length === 0 ? (
          <p className="text-sm text-white/55">
            Nog geen afbeeldingen in deze galerij.
          </p>
        ) : sideBySide ? (
          <div
            data-cms-gallery-media="rows"
            className="space-y-16 sm:space-y-20 lg:space-y-24"
          >
            {items.map((item, index) => {
              const fields = readCopy(item);
              const media = (
                <div className="mx-auto w-full max-w-xs overflow-hidden rounded-[1.75rem] border border-white/10 md:mx-0 md:max-w-sm">
                  <ServicePhoto image={item.image} index={index} />
                </div>
              );
              const copy = fields ? (
                <RowCopy fields={fields} className="py-2 md:py-4" />
              ) : null;
              return (
                <article
                  key={item.id}
                  className={cn(
                    "group grid items-center gap-8 sm:gap-10 md:gap-12 lg:gap-16",
                    textFirst
                      ? "md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
                      : "md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]",
                  )}
                >
                  {textFirst ? (
                    <>
                      {copy}
                      {media}
                    </>
                  ) : (
                    <>
                      {media}
                      {copy}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        ) : (
          <div
            data-cms-gallery-media="services"
            className={cn(
              "grid items-stretch gap-x-5 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:gap-x-8 lg:gap-y-12",
              gridColumnsClass(columns),
            )}
          >
            {items.map((item, index) => (
              <ServiceColumn
                key={item.id}
                item={item}
                index={index}
                textFirst={textFirst}
              />
            ))}
          </div>
        )}
      </GalleryUnifiedPanel>
    </SectionShell>
  );
}
