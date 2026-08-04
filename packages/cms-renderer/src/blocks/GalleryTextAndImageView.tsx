import * as React from "react";
import {
  normalizeGalleryColumns,
  normalizeGalleryTextPlacement,
  type CmsImage,
  type GalleryColumns,
  type GalleryTextPlacement,
} from "@mccoy/cms-schema";
import { CmsImageView } from "./primitives";
import { SectionHeader } from "../sectionChromeUi";
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

/** Edge-to-edge cover — fill the media plane; framing owned by parent. */
function CoverImage({
  image,
  className,
  framed = false,
}: {
  image: CmsImage;
  className?: string;
  framed?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-white/[0.03]",
        framed && "rounded-3xl border border-white/10",
        className,
      )}
    >
      <CmsImageView
        image={image}
        className="absolute inset-0 h-full w-full object-cover object-center transition duration-700 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      />
    </div>
  );
}

/**
 * Integrated caption for grid (above/below): lives inside the same framed
 * media plane as the photo — not a lonely paragraph under a floating image.
 * Below: panel overlaps the image bottom. Above: panel sits as the frame header.
 *
 * Typography: Archivo display for primary lines; editorial left alignment with
 * a measured measure; bijschrift as tight uppercase accent; body as support.
 */
function CellCaptionStrip({
  fields,
  position,
}: {
  fields: CopyFields;
  position: "above" | "below";
}) {
  const { title, caption, body } = fields;
  const bodyOnly = !title && !caption && !!body;
  const hasLead = !!(title || caption);
  // Short body-only captions under the photo read cleaner centered; longer copy stays left.
  const centerShortBodyOnly =
    position === "below" && bodyOnly && (body?.length ?? 0) <= 72;

  return (
    <div
      className={cn(
        "relative z-[1] px-4 py-4 sm:px-5 sm:py-5",
        centerShortBodyOnly ? "text-center" : "text-left",
        position === "below"
          ? // Pull up into the photo so caption reads as part of the media plane.
            "-mt-11 mx-3 mb-3 rounded-2xl border border-white/14 bg-[#0b1220]/92 shadow-[0_-8px_32px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:-mt-12 sm:mx-4 sm:mb-4"
          : "border-b border-white/12 bg-gradient-to-b from-white/[0.09] to-white/[0.03]",
      )}
    >
      {/* Thin accent rule — editorial cue even when only body is filled. */}
      <div
        className={cn(
          "mb-3.5 h-px w-11 bg-primary/70",
          centerShortBodyOnly && "mx-auto",
        )}
        aria-hidden
      />

      {title ? (
        <h3 className="font-display max-w-[22ch] text-[1.35rem] font-semibold leading-[1.12] tracking-[-0.03em] text-white break-words sm:text-2xl sm:leading-[1.1]">
          {title}
        </h3>
      ) : null}

      {caption ? (
        <p
          className={cn(
            "font-semibold uppercase tracking-[0.22em] text-primary",
            "text-[0.625rem] sm:text-[0.6875rem]",
            title ? "mt-2.5" : undefined,
          )}
        >
          {caption}
        </p>
      ) : null}

      {body ? (
        <p
          className={cn(
            "whitespace-pre-wrap break-words",
            bodyOnly
              ? cn(
                  "font-display text-xl font-semibold leading-[1.2] tracking-[-0.03em] text-white sm:text-2xl sm:leading-[1.15]",
                  !centerShortBodyOnly && "max-w-[28ch]",
                  centerShortBodyOnly && "mx-auto max-w-[20ch]",
                )
              : cn(
                  "max-w-[36ch] text-[0.9375rem] leading-relaxed text-white/78 sm:text-base",
                  hasLead ? "mt-3" : undefined,
                ),
          )}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}

/** Side-by-side editorial column — large type, accent rail, reading measure. */
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
    <div
      className={cn(
        "min-w-0 flex flex-col justify-center text-left",
        "border-l-2 border-primary/55 pl-6 sm:pl-8 lg:pl-10",
        className,
      )}
    >
      {title ? (
        <h3 className="font-display max-w-[16ch] text-3xl font-semibold leading-[1.05] tracking-[-0.035em] text-white break-words sm:text-4xl lg:text-[2.85rem] lg:leading-[1.02]">
          {title}
        </h3>
      ) : null}

      {caption ? (
        <p
          className={cn(
            "font-semibold uppercase tracking-[0.22em] text-primary text-[0.6875rem]",
            title ? "mt-4" : undefined,
          )}
        >
          {caption}
        </p>
      ) : null}

      {hasLead ? (
        <div className="mt-6 h-px w-14 bg-primary/50" aria-hidden />
      ) : null}

      {body ? (
        <p
          className={cn(
            "whitespace-pre-wrap break-words",
            bodyOnly
              ? "font-display max-w-[18ch] text-2xl font-semibold leading-[1.12] tracking-[-0.03em] text-white sm:text-3xl lg:text-[2.15rem] lg:leading-[1.08]"
              : cn(
                  "max-w-md text-base leading-relaxed text-white/78 sm:text-[1.0625rem]",
                  hasLead ? "mt-6" : undefined,
                ),
          )}
        >
          {body}
        </p>
      ) : null}
    </div>
  );
}

function gridColumnsClass(columns: GalleryColumns): string {
  if (columns === 4) return "sm:grid-cols-2 lg:grid-cols-4";
  if (columns === 3) return "sm:grid-cols-2 lg:grid-cols-3";
  return "sm:grid-cols-2";
}

/**
 * Premium text+image gallery:
 * - above/below → multi-column grid; image + caption share one framed plane
 * - left/right → full-width asymmetric rows (image ~58%, text column with accent)
 * Images fill their media frame edge-to-edge (`object-cover`).
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
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        body={intro}
        align="left"
      />

      {items.length === 0 ? (
        <p className="text-sm text-white/55">Nog geen afbeeldingen in deze galerij.</p>
      ) : sideBySide ? (
        <div className="space-y-16 sm:space-y-20 lg:space-y-24">
          {items.map((item) => {
            const fields = readCopy(item);
            const media = (
              <div className="group relative min-h-[14rem] overflow-hidden sm:min-h-[18rem] md:min-h-0 md:aspect-[5/4] lg:aspect-[4/3]">
                <CoverImage
                  image={item.image}
                  framed
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            );
            const copy = fields ? (
              <RowCopy
                fields={fields}
                className="py-2 md:py-6"
              />
            ) : null;
            return (
              <article
                key={item.id}
                className={cn(
                  "grid items-center gap-8 sm:gap-10 md:gap-12 lg:gap-16",
                  // Image dominates (~58%); text stays a deliberate reading column.
                  textFirst
                    ? "md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
                    : "md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]",
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
          className={cn(
            "grid gap-x-5 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:gap-x-8 lg:gap-y-12",
            gridColumnsClass(columns),
          )}
        >
          {items.map((item) => {
            const fields = readCopy(item);
            const stripPosition = textFirst ? "above" : "below";
            return (
              <article
                key={item.id}
                className={cn(
                  // One composition: photo + caption share a single framed plane.
                  "gallery-text-image-cell flex flex-col overflow-hidden rounded-3xl border border-white/12 bg-white/[0.03]",
                )}
              >
                {fields && textFirst ? (
                  <CellCaptionStrip fields={fields} position={stripPosition} />
                ) : null}
                <div className="group relative aspect-[4/3] min-h-0 w-full shrink-0 overflow-hidden">
                  <CoverImage
                    image={item.image}
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
                {fields && !textFirst ? (
                  <CellCaptionStrip fields={fields} position={stripPosition} />
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </SectionShell>
  );
}
