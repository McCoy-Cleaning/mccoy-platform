import * as React from "react";
import type { CmsImage } from "@mccoy/cms-schema";
import { CmsImageView } from "./CmsImageView";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export type MediaFrameFit = "square" | "intrinsic";

/**
 * Photo frame:
 * - `square` — equal card slots; full photo visible (`object-contain`)
 * - `intrinsic` — capped compact photo for left/right rows
 */
export function OrientationMediaFrame({
  image,
  className,
  framed = false,
  fit = "square",
  fallbackAspectClass = "aspect-square",
}: {
  image: CmsImage;
  className?: string;
  framed?: boolean;
  fit?: MediaFrameFit;
  /** Used only for `fit="square"`. */
  fallbackAspectClass?: string;
}) {
  if (fit === "intrinsic") {
    return (
      <div
        data-cms-media-fit="intrinsic"
        className={cn(
          // Hug the photo — do not stretch to column width (avoids pillarbox bars).
          "relative mx-auto flex w-fit max-w-full items-center justify-center overflow-hidden",
          "max-h-[18rem] sm:max-h-[22rem] lg:max-h-[24rem]",
          framed && "rounded-3xl border border-white/10",
          className,
        )}
      >
        <CmsImageView
          image={image}
          className="max-h-[18rem] w-auto max-w-full object-contain object-center sm:max-h-[22rem] lg:max-h-[24rem]"
        />
      </div>
    );
  }

  return (
    <div
      data-cms-media-fit="square-contain"
      className={cn(
        "relative overflow-hidden",
        fallbackAspectClass,
        framed && "rounded-3xl border border-white/10",
        className,
      )}
    >
      <CmsImageView
        image={image}
        className="absolute inset-0 h-full w-full object-contain object-center p-2"
      />
    </div>
  );
}
