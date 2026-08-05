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
 * Portrait service photo: tall 3:4 frame filled edge-to-edge (`object-cover`).
 */
function ServicePhoto({
  image,
  className,
}: {
  image: CmsImage;
  className?: string;
}) {
  return (
    <div
      data-cms-media-fit="portrait-cover"
      className={cn(
        "relative aspect-[3/4] w-full overflow-hidden rounded-xl",
        "ring-1 ring-white/10",
        className,
      )}
    >
      <CmsImageView
        image={image}
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
    </div>
  );
}

function ServiceCopy({
  fields,
  index,
  textFirst,
}: {
  fields: CopyFields;
  index: number;
  textFirst: boolean;
}) {
  const { title, caption, body } = fields;
  const bodyOnly = !title && !caption && !!body;

  return (
    <div
      className={cn(
        "min-w-0 text-left",
        textFirst ? "mb-4 sm:mb-5" : "mt-5",
      )}
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span
          className="text-sm font-semibold tabular-nums tracking-[0.04em] text-primary"
          aria-hidden
        >
          {formatIndex(index)}
        </span>
        {caption ? (
          <p className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-white/45">
            {caption}
          </p>
        ) : null}
      </div>

      {title ? (
        <h3 className="mt-2.5 font-display text-xl font-semibold leading-[1.15] tracking-[-0.025em] text-[#f2f4f7] break-words sm:text-[1.35rem] sm:leading-[1.12]">
          {title}
        </h3>
      ) : null}

      {body ? (
        <p
          className={cn(
            "whitespace-pre-wrap break-words",
            bodyOnly
              ? "mt-2.5 font-display text-lg font-semibold leading-[1.2] tracking-[-0.02em] text-[#f2f4f7]"
              : cn(
                  "mt-2.5 text-sm leading-[1.65] text-white/58 sm:text-[0.9375rem]",
                  !title && !caption ? "mt-2" : undefined,
                ),
          )}
        >
          {body}
        </p>
      ) : null}
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
    <ServiceCopy fields={fields} index={index} textFirst={textFirst} />
  ) : null;

  return (
    <article
      data-cms-gallery-item="service"
      className="group flex h-full min-w-0 flex-col"
    >
      {textFirst ? copy : null}
      <ServicePhoto image={item.image} />
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
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.12em] text-white/45">
          {caption}
        </p>
      ) : null}
      {title ? (
        <h3
          className={cn(
            "font-display max-w-[16ch] text-3xl font-semibold leading-[1.05] tracking-[-0.035em] text-[#f2f4f7] break-words sm:text-4xl lg:text-[2.65rem] lg:leading-[1.02]",
            caption ? "mt-3" : undefined,
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
                  "max-w-md text-base leading-relaxed text-white/60",
                  hasLead ? "mt-5" : undefined,
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
 * Text+image gallery on the page background:
 * equal portrait columns with edge-to-edge photos (3:4 cover, no text panel).
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
            className="space-y-14 sm:space-y-16 lg:space-y-20"
          >
            {items.map((item) => {
              const fields = readCopy(item);
              const media = (
                <ServicePhoto
                  image={item.image}
                  className="mx-auto w-full max-w-xs md:mx-0 md:max-w-sm"
                />
              );
              const copy = fields ? (
                <RowCopy fields={fields} className="py-2 md:py-4" />
              ) : null;
              return (
                <article
                  key={item.id}
                  className={cn(
                    "grid items-center gap-8 sm:gap-10 md:gap-12 lg:gap-14",
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
              "grid items-start gap-x-6 gap-y-10 sm:gap-x-7 sm:gap-y-12 lg:gap-x-8 lg:gap-y-12",
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
