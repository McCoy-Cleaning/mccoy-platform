import type { FocusEvent, KeyboardEvent } from "react";
import { useEffect, useState } from "react";
import {
  Sparkles,
  CheckCircle2,
  Award,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { HERO_IMAGE_SIZES, heroWebpSrcSet } from "@/lib/image-delivery";
import { useMobileLiteMotion } from "@/lib/use-mobile-lite-motion";
import { DeliveryImage } from "../DeliveryImage";
import { CmsLinkAnchor } from "../CmsLinkAnchor";
import { useHomeHeroContent } from "@/lib/cms/use-section-content";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import { cn } from "@/lib/utils";
import { localizedHeroCopy } from "@/lib/cms-i18n";
import { isCmsButtonInteractive, resolvePublicImageAlt } from "@mccoy/cms-schema";
import { SECTION_PAGE_RAIL } from "@mccoy/cms-renderer/section-layout";

/** Public optimized hero — avoid bundling the ~430KB JPEG into the home chunk. */
const HERO_PUBLIC_JPG = "/images/cms/hero-cleaning.jpg";
const HERO_PUBLIC_WEBP_SRCSET =
  "/images/cms/hero-cleaning-640.webp 640w, /images/cms/hero-cleaning-960.webp 960w, /images/cms/hero-cleaning-1280.webp 1280w";
const HERO_PUBLIC_WEBP_640 = "/images/cms/hero-cleaning-640.webp";

/** Inline short-text editing for Hero — patches home.hero via the v2 edit bridge. */
function HeroEditableText({
  value,
  onCommit,
  as = "span",
  className,
  multiline = false,
  editable,
}: {
  value: string;
  onCommit: (next: string) => void;
  as?: "span" | "h1" | "p";
  className?: string;
  multiline?: boolean;
  editable: boolean;
}) {
  const Tag = as;
  if (!editable) return <Tag className={className}>{value}</Tag>;

  return (
    <Tag
      className={cn(
        className,
        "rounded-sm outline-none transition hover:ring-2 hover:ring-primary/40 focus:ring-2 focus:ring-primary",
      )}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-cms-inline-edit=""
      onKeyDown={(e: KeyboardEvent<HTMLElement>) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
      }}
      onBlur={(e: FocusEvent<HTMLElement>) => {
        const next = e.currentTarget.innerText.trim();
        if (next !== value) onCommit(next);
      }}
      ref={(el: HTMLElement | null) => {
        if (el && el.innerText !== value) el.innerText = value;
      }}
    />
  );
}

/* ============= HERO ============= */
const HERO_PLACEHOLDER_SRC = "/images/hero-placeholder.jpg";

function resolveHeroImageSrc(cmsSrc: string | undefined): string {
  if (!cmsSrc || cmsSrc === HERO_PLACEHOLDER_SRC || cmsSrc.includes("hero-placeholder")) {
    return HERO_PUBLIC_JPG;
  }
  return cmsSrc;
}

function heroWebpSrcSetFor(src: string): string | undefined {
  if (src === HERO_PUBLIC_JPG || /hero-cleaning/i.test(src)) {
    return heroWebpSrcSet(src) ?? HERO_PUBLIC_WEBP_SRCSET;
  }
  return heroWebpSrcSet(src);
}

export function Hero() {
  const { t, lang } = useI18n();
  const isEn = lang === "en";
  const content = useHomeHeroContent();
  const copy = localizedHeroCopy(content, t);
  const { isEdit, sendMutation } = useLiveEditApi();
  // SSR + mobile: skip decorative CSS motion (ping / scroll cue).
  const softMotion = useMobileLiteMotion();
  const [imageSrc, setImageSrc] = useState(() => resolveHeroImageSrc(content.image?.src));

  useEffect(() => {
    setImageSrc(resolveHeroImageSrc(content.image?.src));
  }, [content.image?.src]);

  const patchHero = (patch: Record<string, unknown>) =>
    sendMutation({ kind: "section", sectionKey: "home.hero", patch });

  // SSR + mobile (`softMotion`): H1 is LCP — don't contend for Slow-4G bandwidth.
  // Desktop: eager + high priority; head also media-preloads at lg+.
  const heroImgProps = {
    width: 640,
    height: 480,
    sizes: HERO_IMAGE_SIZES,
    decoding: "async" as const,
    fetchPriority: (softMotion ? "low" : "high") as "low" | "high",
    loading: (softMotion ? "lazy" : "eager") as "lazy" | "eager",
    // Fit the whole visual inside the 4:3 card — admin uploads must never crop-zoom.
    className: "aspect-[4/3] h-auto w-full bg-black/35 object-contain object-center",
    onError: () => setImageSrc(HERO_PUBLIC_WEBP_640),
  };
  return (
    <section id="home" className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24">
      <div className="absolute inset-0 -z-10 bg-grid opacity-40" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background to-background/90" />

      {/* Accent blobs — desktop only; CSS only (no Motion on the LCP path) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -right-24 -z-10 hidden h-[34rem] w-[34rem] rounded-full bg-primary/20 blur-[90px] md:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-10 left-1/3 -z-10 hidden h-72 w-72 rounded-full bg-primary/12 blur-[80px] lg:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-10 top-1/4 -z-10 hidden lg:block"
      >
        <div className="relative h-72 w-72">
          <div className="absolute inset-0 rounded-full border border-primary/30" />
          <div className="absolute inset-6 rounded-full border border-primary/20" />
          <div className="absolute inset-16 rounded-full bg-gradient-to-br from-primary/40 to-primary/0 blur-2xl" />
        </div>
      </div>

      <div className={cn(SECTION_PAGE_RAIL, "grid w-full items-center gap-12 py-20 lg:grid-cols-12")}>
        <div className="lg:col-span-7">
          <div className="group inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-primary shadow-[0_0_40px_-10px_rgba(63,182,242,0.6)] backdrop-blur">
            <span className="relative flex h-2 w-2">
              {!softMotion ? (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              ) : null}
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <Sparkles className="h-3.5 w-3.5" />
            <HeroEditableText
              editable={isEdit}
              value={copy.eyebrow}
              onCommit={(next) => patchHero({ eyebrow: next })}
            />
          </div>

          {/* LCP-critical copy: paint immediately (no opacity:0). */}
          <h1 className="font-display mt-6 text-6xl leading-[0.98] tracking-tight text-white sm:text-7xl lg:text-[5.75rem] xl:text-[6.5rem]">
            <HeroEditableText
              as="span"
              editable={isEdit}
              value={copy.heading}
              onCommit={(next) => patchHero({ heading: next })}
            />
            {copy.headingAccent ? (
              <>
                {" "}
                <span className="relative inline-block bg-gradient-to-br from-primary via-primary to-white/90 bg-clip-text text-transparent">
                  <HeroEditableText
                    as="span"
                    editable={isEdit}
                    value={copy.headingAccent}
                    onCommit={(next) => patchHero({ headingAccent: next })}
                  />
                  <span
                    aria-hidden
                    className="absolute -bottom-2 left-0 h-1 w-full rounded-full bg-primary/70"
                  />
                </span>
              </>
            ) : null}
          </h1>

          <p className="mt-8 max-w-xl whitespace-pre-line text-lg text-white/75 md:text-xl">
            <HeroEditableText
              as="span"
              multiline
              editable={isEdit}
              value={copy.body}
              onCommit={(next) => patchHero({ body: next })}
            />
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            {content.primaryCta && isCmsButtonInteractive(content.primaryCta) ? (
              <CmsLinkAnchor
                link={content.primaryCta.link}
                fallbackHref="/offerte"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                <HeroEditableText
                  editable={isEdit}
                  value={copy.primaryCtaLabel ?? content.primaryCta.label}
                  onCommit={(next) =>
                    patchHero({
                      primaryCta: {
                        label: next,
                        link: content.primaryCta!.link,
                      },
                    })
                  }
                />
              </CmsLinkAnchor>
            ) : null}
            {content.secondaryCta && isCmsButtonInteractive(content.secondaryCta) ? (
              <CmsLinkAnchor
                link={content.secondaryCta.link}
                fallbackHref="/services"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-4 text-sm font-semibold text-white backdrop-blur transition hover:border-primary/40 hover:bg-white/10"
              >
                <HeroEditableText
                  editable={isEdit}
                  value={copy.secondaryCtaLabel ?? content.secondaryCta.label}
                  onCommit={(next) =>
                    patchHero({
                      secondaryCta: {
                        label: next,
                        link: content.secondaryCta!.link,
                      },
                    })
                  }
                />
              </CmsLinkAnchor>
            ) : null}
          </div>

          {/* Trust strip — centered on mobile; left-aligned from lg with the hero copy */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs uppercase tracking-[0.2em] text-white/55 lg:justify-start">
            {t.stats.items.map((it) => (
              <span key={it.label} className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {it.value} {it.label}
              </span>
            ))}
          </div>
        </div>

        {/* Right side image card — always painted so the photo stays on the LCP path */}
        {content.image ? (
        <div className="relative lg:col-span-5">
          <div className="relative mx-auto max-w-md">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/15 shadow-[0_30px_80px_-20px_rgba(63,182,242,0.4)]">
              {(() => {
                const heroAlt = resolvePublicImageAlt(
                  content.image,
                  "McCoy Cleaning professional at work",
                );
                return (
                  <DeliveryImage
                    variant="hero"
                    src={imageSrc}
                    alt={heroAlt}
                    role={heroAlt ? undefined : "presentation"}
                    webpSrcSet={heroWebpSrcSetFor(imageSrc)}
                    {...heroImgProps}
                  />
                );
              })()}
              <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-white/15 bg-card/95 px-5 py-4 shadow-2xl sm:block">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-display text-2xl text-white leading-none">25+</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/60 mt-1">
                    {t.stats.items[0]?.label ?? ""}
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -top-4 -right-4 hidden rounded-2xl border border-primary/30 bg-primary/20 px-4 py-3 sm:block">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white">
                <ShieldCheck className="h-4 w-4 text-primary" /> {isEn ? "Certified" : "Gecertificeerd"}
              </div>
            </div>
          </div>
        </div>
        ) : null}
      </div>

      {/* scroll indicator — static on mobile; CSS bounce on desktop only */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2" aria-hidden>
        <div className="h-10 w-6 rounded-full border border-white/20 p-1">
          <div
            className={cn(
              "mx-auto h-2 w-1 rounded-full bg-primary",
              !softMotion && "motion-safe:animate-bounce",
            )}
          />
        </div>
      </div>
    </section>
  );
}
