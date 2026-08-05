import * as React from "react";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Section lead for gallery / work / offers.
 *
 * Centered on the page background — no inset panel; intro + media read as one unit.
 * Uses a div (not header): storefront critical CSS scopes the nav frosted panel to
 * `header[data-site-header]` only.
 */
export function GallerySectionIntro({
  eyebrow,
  title,
  intro,
  className,
}: {
  eyebrow?: string;
  title?: string;
  intro?: string;
  className?: string;
}) {
  const hasEyebrow = !!eyebrow?.trim();
  const hasTitle = !!title?.trim();
  const hasIntro = !!intro?.trim();
  if (!hasEyebrow && !hasTitle && !hasIntro) return null;

  return (
    <div
      data-cms-gallery-intro="centered"
      className={cn("mx-auto max-w-3xl bg-transparent text-center", className)}
    >
      {hasEyebrow ? (
        <div className="flex items-center justify-center gap-3">
          <span className="h-px w-5 shrink-0 bg-primary sm:w-6" aria-hidden />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary sm:text-xs">
            {eyebrow}
          </p>
          <span className="h-px w-5 shrink-0 bg-primary sm:w-6" aria-hidden />
        </div>
      ) : null}

      {hasTitle ? (
        <h2
          className={cn(
            "font-display text-[1.65rem] font-semibold leading-[1.15] tracking-[-0.028em] text-[#f2f4f7] break-words sm:text-[2.05rem] sm:leading-[1.12] lg:text-[2.35rem] lg:leading-[1.1]",
            hasEyebrow ? "mt-4 sm:mt-5" : null,
          )}
        >
          {title}
        </h2>
      ) : null}

      {hasIntro ? (
        <p
          className={cn(
            "mx-auto max-w-2xl text-[0.9375rem] leading-[1.65] text-white/58 sm:text-[1rem] sm:leading-[1.68]",
            hasTitle || hasEyebrow ? "mt-4 sm:mt-5" : null,
          )}
        >
          {intro}
        </p>
      ) : null}
    </div>
  );
}

/** Open stack: centered lead → media with tight rhythm. */
export function GalleryUnifiedPanel({
  children,
  className,
  unit = "services",
}: {
  children: React.ReactNode;
  className?: string;
  /** `services` for gallery blocks; `open` for offers. */
  unit?: "services" | "open";
}) {
  const unitAttrs =
    unit === "open"
      ? ({ "data-cms-offers-unit": "open" } as const)
      : ({ "data-cms-gallery-unit": "services" } as const);

  return (
    <div
      {...unitAttrs}
      className={cn("flex flex-col gap-6 sm:gap-7 lg:gap-8", className)}
    >
      {children}
    </div>
  );
}
