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
        <div className="flex items-center justify-center gap-3 sm:gap-3.5">
          <span
            className="h-px w-6 shrink-0 bg-primary/80 sm:w-8"
            aria-hidden
          />
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary sm:text-xs">
            {eyebrow}
          </p>
          <span
            className="h-px w-6 shrink-0 bg-primary/80 sm:w-8"
            aria-hidden
          />
        </div>
      ) : null}

      {hasTitle ? (
        <h2
          className={cn(
            "font-display text-[1.75rem] font-semibold leading-[1.12] tracking-[-0.03em] text-[#f2f4f7] break-words sm:text-[2.15rem] sm:leading-[1.1] lg:text-[2.5rem] lg:leading-[1.08]",
            hasEyebrow ? "mt-5 sm:mt-6" : null,
          )}
        >
          {title}
        </h2>
      ) : null}

      {hasTitle || hasEyebrow ? (
        <div
          className={cn(
            "mx-auto h-px w-16 bg-gradient-to-r from-transparent via-primary/70 to-transparent sm:w-20",
            hasTitle ? "mt-5 sm:mt-6" : "mt-4",
          )}
          aria-hidden
        />
      ) : null}

      {hasIntro ? (
        <p
          className={cn(
            "mx-auto max-w-2xl text-[0.9375rem] leading-[1.7] text-white/58 sm:text-base sm:leading-[1.72]",
            hasTitle || hasEyebrow ? "mt-5 sm:mt-6" : null,
          )}
        >
          {intro}
        </p>
      ) : null}
    </div>
  );
}

/** Open stack: centered lead → media with generous rhythm. */
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
      className={cn("flex flex-col gap-10 sm:gap-12 lg:gap-14", className)}
    >
      {children}
    </div>
  );
}
