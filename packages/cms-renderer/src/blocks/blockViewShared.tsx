import * as React from "react";
import type { CmsButton, CmsImage } from "@mccoy/cms-schema";
import { CmsButtonView } from "./CmsButtonView";
import { CmsImageView, type LinkResolverPages } from "./CmsImageView";
import { SECTION_TITLE } from "../sectionLayout";

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h2 className={cn(SECTION_TITLE, className)}>{children}</h2>;
}

export function OptionalImage({ image, className }: { image?: CmsImage; className?: string }) {
  if (!image) return null;
  return <CmsImageView image={image} className={className} />;
}

/**
 * Framed content image that always fits — the whole photo stays visible inside
 * a fixed aspect box (object-contain on a soft backdrop), never cropped/zoomed.
 */
export function FitImage({
  image,
  aspectClass,
  className,
  imgClassName,
}: {
  image?: CmsImage;
  /** Aspect-ratio frame, e.g. "aspect-[4/3]". */
  aspectClass: string;
  className?: string;
  imgClassName?: string;
}) {
  if (!image) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden bg-white/[0.03]",
        aspectClass,
        className,
      )}
    >
      <CmsImageView image={image} className={cn("h-full w-full object-contain", imgClassName)} />
    </div>
  );
}

/**
 * Gallery / media tile: image crops to fill the entire frame edge-to-edge (no letterboxing).
 */
export function CoverFillImage({
  image,
  aspectClass,
  className,
  imgClassName,
}: {
  image?: CmsImage;
  aspectClass: string;
  className?: string;
  imgClassName?: string;
}) {
  if (!image) return null;
  return (
    <div className={cn("relative overflow-hidden bg-white/[0.04]", aspectClass, className)}>
      <CmsImageView
        image={image}
        className={cn(
          "absolute inset-0 h-full w-full object-cover object-center",
          imgClassName,
        )}
      />
    </div>
  );
}

export function OptionalCta({
  cta,
  pages,
  className,
}: {
  cta?: CmsButton;
  pages: LinkResolverPages;
  className?: string;
}) {
  if (!cta) return null;
  return <CmsButtonView button={cta} pages={pages} className={className} />;
}

export type BlockSectionViewProps = {
  data: Record<string, unknown>;
  pages?: LinkResolverPages;
  blockId?: string;
  adminMode?: boolean;
  mode?: "preview" | "storefront";
  showHidden?: boolean;
};
