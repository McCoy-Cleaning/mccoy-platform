import * as React from "react";
import { sectionInnerAlignRowClass } from "./sectionLayout";
import { useContentAlign } from "./contentAlign";
import type { SectionSurfaceVariant } from "./sectionChrome";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function SectionEyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "text-xs font-semibold uppercase tracking-[0.2em] text-primary",
        className,
      )}
    >
      {children}
    </p>
  );
}

export function SectionIndex({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-9 min-w-9 items-center justify-center rounded-xl border border-border bg-card px-2 text-sm font-bold tabular-nums text-primary",
        className,
      )}
    >
      {value}
    </span>
  );
}

/**
 * Shared section heading band. Callers own heading level (h1/h2/h3).
 * Does not render when title is empty.
 */
export function SectionHeader({
  eyebrow,
  title,
  body,
  titleAs: TitleTag = "h2",
  className,
  align,
}: {
  eyebrow?: string;
  title?: string;
  body?: string;
  titleAs?: "h1" | "h2" | "h3";
  className?: string;
  align?: "left" | "center" | "right";
}) {
  const ctxAlign = useContentAlign();
  const resolved = align ?? ctxAlign ?? "center";
  if (!title?.trim() && !eyebrow?.trim() && !body?.trim()) return null;

  const textAlign =
    resolved === "left" ? "text-left" : resolved === "right" ? "text-right" : "text-center";

  return (
    <header className={cn("mb-14 sm:mb-20", textAlign, className)}>
      <div className={cn(sectionInnerAlignRowClass(resolved))}>
        <div className="min-w-0 max-w-3xl">
          {eyebrow?.trim() ? <SectionEyebrow>{eyebrow}</SectionEyebrow> : null}
          {title?.trim() ? (
            <TitleTag
              className={cn(
                "font-display text-3xl font-semibold tracking-tight text-foreground break-words sm:text-4xl",
                eyebrow?.trim() ? "mt-4" : null,
              )}
            >
              {title}
            </TitleTag>
          ) : null}
          {body?.trim() ? (
            <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-muted-foreground sm:text-lg">
              {body}
            </p>
          ) : null}
          <div
            className={cn(
              "mt-6 h-px w-16 bg-primary/50",
              resolved === "center" && "mx-auto",
              resolved === "right" && "ml-auto",
            )}
            aria-hidden
          />
        </div>
      </div>
    </header>
  );
}

const SURFACE_VARIANT_CLASS: Record<SectionSurfaceVariant, string> = {
  plain: "",
  outlined: "rounded-3xl border border-border bg-card/40",
  elevated: "rounded-3xl border border-border bg-card shadow-sm",
  media: "overflow-hidden rounded-3xl border border-border bg-card/30",
  form: "rounded-3xl border border-border bg-card/60 p-6 sm:p-8 md:p-10",
  featured:
    "rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/15 via-card/80 to-card/40",
};

/**
 * Theme-token surface. Do not nest SectionSurface unless the renderer contract documents it.
 */
export function SectionSurface({
  variant = "outlined",
  className,
  children,
  featured = false,
}: {
  variant?: SectionSurfaceVariant;
  className?: string;
  children: React.ReactNode;
  /** Elevates one item in an items group — at most one per group. */
  featured?: boolean;
}) {
  const resolved = featured ? "featured" : variant;
  if (resolved === "plain") {
    return <div className={className}>{children}</div>;
  }
  return (
    <div className={cn(SURFACE_VARIANT_CLASS[resolved], className)} data-cms-surface={resolved}>
      {children}
    </div>
  );
}

/** Static ambient wash — pointer-events none, hidden from AT, no motion. */
export function SectionAmbient({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-primary/10 via-transparent to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.04)_1px,transparent_0)] [background-size:28px_28px] opacity-40" />
    </div>
  );
}
