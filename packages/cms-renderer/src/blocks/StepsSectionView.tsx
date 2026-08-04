import * as React from "react";
import type { CmsImage, StepItem, StepsBlockData } from "@mccoy/cms-schema";
import { SectionShell } from "../SectionShell";
import { SectionHeader, SectionIndex } from "../sectionChromeUi";
import { CmsImageView } from "./primitives";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return reduced;
}

export type StepsSectionViewProps = {
  data: StepsBlockData;
};

function StepCard({
  step,
  index,
  active,
  reducedMotion,
  onSelect,
}: {
  step: StepItem;
  index: number;
  active: boolean;
  reducedMotion: boolean;
  onSelect: () => void;
}) {
  const image = step.image as CmsImage | undefined;
  return (
    <article
      data-step-card={active ? "active" : "inactive"}
      data-step-index={index}
      className={cn(
        "flex shrink-0 flex-col overflow-hidden rounded-[1.35rem] border bg-gradient-to-b from-white/[0.07] to-white/[0.02]",
        "origin-center",
        reducedMotion
          ? "transition-opacity duration-200"
          : "transition-[transform,opacity,border-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        active
          ? "z-[2] scale-100 border-primary/45 opacity-100 shadow-[0_24px_60px_-28px_rgba(63,182,242,0.55)]"
          : reducedMotion
            ? "z-[1] scale-100 border-white/10 opacity-[0.55]"
            : "z-[1] scale-[0.86] border-white/10 opacity-[0.42]",
      )}
      style={{ width: "var(--step-card)", flex: "0 0 var(--step-card)" }}
      aria-current={active ? "step" : undefined}
    >
      <button
        type="button"
        className="flex w-full flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={onSelect}
        aria-label={`Stap ${index + 1}: ${step.title}`}
      >
        {image ? (
          <div className="relative isolate aspect-[16/10] w-full overflow-hidden bg-black/40">
            <CmsImageView
              image={image}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent"
              aria-hidden
            />
          </div>
        ) : null}
        <div className="flex gap-3.5 p-5 sm:p-6">
          <SectionIndex value={index + 1} className={cn(!active && "opacity-70")} />
          <div className="min-w-0 space-y-1.5">
            <h3 className="font-display text-lg font-semibold tracking-tight text-foreground break-words sm:text-xl">
              {step.title}
            </h3>
            {step.body ? (
              <p className="text-sm leading-relaxed text-muted-foreground break-words">{step.body}</p>
            ) : null}
          </div>
        </div>
      </button>
    </article>
  );
}

export function StepsSectionView({ data }: StepsSectionViewProps) {
  const steps = data.steps ?? [];
  const reducedMotion = usePrefersReducedMotion();
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    setActiveIndex((i) => {
      if (steps.length === 0) return 0;
      return Math.min(i, steps.length - 1);
    });
  }, [steps.length]);

  const goTo = (next: number) => {
    if (steps.length === 0) return;
    const clamped = ((next % steps.length) + steps.length) % steps.length;
    setActiveIndex(clamped);
  };

  const goPrev = () => goTo(activeIndex - 1);
  const goNext = () => goTo(activeIndex + 1);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(steps.length - 1);
    }
  };

  const trackTransform = `translate3d(calc(50% - (var(--step-card) / 2) - ${activeIndex} * (var(--step-card) + var(--step-gap))), 0, 0)`;

  return (
    <SectionShell blockType="steps">
      <SectionHeader title={data.title} align="left" className="mb-8 sm:mb-12" />

      {steps.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nog geen stappen in deze sectie.</p>
      ) : (
        <div
          className="relative outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          role="region"
          aria-roledescription="carousel"
          aria-label={data.title?.trim() || "Stappen"}
          tabIndex={0}
          onKeyDown={onKeyDown}
          data-steps-slider=""
          style={
            {
              ["--step-card" as string]: "min(20rem, 78vw)",
              ["--step-gap" as string]: "1.25rem",
            } as React.CSSProperties
          }
        >
          <div
            className="pointer-events-none absolute inset-y-0 left-0 z-[3] w-8 bg-gradient-to-r from-background to-transparent sm:w-12"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 z-[3] w-8 bg-gradient-to-l from-background to-transparent sm:w-12"
            aria-hidden
          />

          <div className="overflow-hidden py-4 sm:py-6">
            <div
              className={cn(
                "flex items-stretch will-change-transform",
                reducedMotion
                  ? "transition-none"
                  : "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
              )}
              style={{
                gap: "var(--step-gap)",
                transform: trackTransform,
              }}
              data-steps-track=""
            >
              {steps.map((step, i) => (
                <StepCard
                  key={step.id}
                  step={step}
                  index={i}
                  active={i === activeIndex}
                  reducedMotion={reducedMotion}
                  onSelect={() => goTo(i)}
                />
              ))}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-foreground transition hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-35"
              onClick={goPrev}
              aria-label="Vorige stap"
              disabled={steps.length < 2}
            >
              <span aria-hidden className="text-lg leading-none">
                ‹
              </span>
            </button>

            <div className="flex items-center gap-2" role="tablist" aria-label="Stapnavigatie">
              {steps.map((step, i) => {
                const selected = i === activeIndex;
                return (
                  <button
                    key={step.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={`Ga naar stap ${i + 1}`}
                    className={cn(
                      "h-2.5 rounded-full transition-[width,background-color,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      reducedMotion ? "duration-150" : "duration-300",
                      selected
                        ? "w-7 bg-primary opacity-100"
                        : "w-2.5 bg-white/25 opacity-70 hover:opacity-100",
                    )}
                    onClick={() => goTo(i)}
                  />
                );
              })}
            </div>

            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/[0.04] text-foreground transition hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-35"
              onClick={goNext}
              aria-label="Volgende stap"
              disabled={steps.length < 2}
            >
              <span aria-hidden className="text-lg leading-none">
                ›
              </span>
            </button>
          </div>

          <p className="sr-only" aria-live="polite">
            Stap {activeIndex + 1} van {steps.length}: {steps[activeIndex]?.title ?? ""}
          </p>
        </div>
      )}
    </SectionShell>
  );
}
