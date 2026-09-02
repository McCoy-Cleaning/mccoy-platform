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
import { useEdgePagePatch, useOverlayHeading } from "@/lib/cms/aether-edge-overlay-context";
import { isCmsButtonInteractive, resolvePublicImageAlt, resolveSafeVideoEmbed } from "@mccoy/cms-schema";
import { SECTION_PAGE_RAIL } from "@mccoy/cms-renderer/section-layout";
import { WysiwygInlineText } from "../cms-editor/WysiwygInlineText";
import { WysiwygButtonEditor, WysiwygMediaFrame } from "../cms-editor/WysiwygMediaButton";

/** Public optimized hero — avoid bundling the ~430KB JPEG into the home chunk. */
const HERO_PUBLIC_JPG = "/images/cms/hero-cleaning.jpg";
const HERO_PUBLIC_WEBP_SRCSET =
  "/images/cms/hero-cleaning-640.webp 640w, /images/cms/hero-cleaning-960.webp 960w, /images/cms/hero-cleaning-1280.webp 1280w";
const HERO_PUBLIC_WEBP_640 = "/images/cms/hero-cleaning-640.webp";


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
  const overlayPatch = useEdgePagePatch();
  const heading = useOverlayHeading(copy.heading);
  const headingAccent = overlayPatch?.h1 ? "" : copy.headingAccent;
  const { sendMutation, showEditorChrome } = useLiveEditApi();
  // SSR + mobile: skip decorative CSS motion (ping / scroll cue).
  const softMotion = useMobileLiteMotion();
  const [imageSrc, setImageSrc] = useState(() => resolveHeroImageSrc(content.image?.src));
  const mediaKind = content.mediaKind === "video" ? "video" : "image";
  const videoUrl = content.videoUrl ?? "";
  const [draftVideoUrl, setDraftVideoUrl] = useState(videoUrl);
  const videoEmbed = mediaKind === "video" ? resolveSafeVideoEmbed(videoUrl) : null;

  useEffect(() => {
    setImageSrc(resolveHeroImageSrc(content.image?.src));
  }, [content.image?.src]);

  useEffect(() => {
    setDraftVideoUrl(videoUrl);
  }, [videoUrl]);

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
            <WysiwygInlineText
              label="Eyebrow"
              value={copy.eyebrow}
              enFieldPath="section:home.hero:eyebrow"
              target={{
                kind: "custom",
                onCommit: (next) => patchHero({ eyebrow: next }),
              }}
            />
          </div>

          {/* LCP-critical copy: paint immediately (no opacity:0). */}
          <h1 className="font-display mt-6 text-6xl leading-[0.98] tracking-tight text-white sm:text-7xl lg:text-[5.75rem] xl:text-[6.5rem]">
            <WysiwygInlineText
              as="span"
              label="Kop"
              value={heading}
              enFieldPath="section:home.hero:heading"
              target={{
                kind: "custom",
                onCommit: (next) => patchHero({ heading: next }),
              }}
            />
            {headingAccent ? (
              <>
                {" "}
                <span className="relative inline-block bg-gradient-to-br from-primary via-primary to-white/90 bg-clip-text text-transparent">
                  <WysiwygInlineText
                    as="span"
                    label="Accent"
                    value={headingAccent}
                    enFieldPath="section:home.hero:headingAccent"
                    target={{
                      kind: "custom",
                      onCommit: (next) => patchHero({ headingAccent: next }),
                    }}
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
            <WysiwygInlineText
              as="span"
              multiline
              label="Tekst"
              value={copy.body}
              enFieldPath="section:home.hero:body"
              target={{
                kind: "custom",
                onCommit: (next) => patchHero({ body: next }),
              }}
            />
          </p>

          <div className="mt-9 flex flex-wrap gap-3">
            {content.primaryCta && isCmsButtonInteractive(content.primaryCta) ? (
              <WysiwygButtonEditor
                button={content.primaryCta}
                onChange={(next) => patchHero({ primaryCta: next })}
              >
                <CmsLinkAnchor
                  link={content.primaryCta.link}
                  fallbackHref="/offerte"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
                >
                  {copy.primaryCtaLabel ?? content.primaryCta.label}
                </CmsLinkAnchor>
              </WysiwygButtonEditor>
            ) : null}
            {content.secondaryCta && isCmsButtonInteractive(content.secondaryCta) ? (
              <WysiwygButtonEditor
                button={content.secondaryCta}
                onChange={(next) => patchHero({ secondaryCta: next })}
              >
                <CmsLinkAnchor
                  link={content.secondaryCta.link}
                  fallbackHref="/services"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-4 text-sm font-semibold text-white backdrop-blur transition hover:border-primary/40 hover:bg-white/10"
                >
                  {copy.secondaryCtaLabel ?? content.secondaryCta.label}
                </CmsLinkAnchor>
              </WysiwygButtonEditor>
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

        {/* Right side image/video card — always painted so the photo stays on the LCP path */}
        {content.image || mediaKind === "video" || showEditorChrome ? (
        <div className="relative lg:col-span-5">
          <div className="relative mx-auto max-w-md">
            {showEditorChrome ? (
              <div
                data-cms-editor-chrome
                className="mb-3 flex flex-col gap-3 rounded-2xl border border-sky-400/25 bg-sky-500/5 p-3 sm:flex-row sm:items-end"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-200/80">
                    Hero-media
                  </p>
                  <div className="mt-1.5 flex gap-2" role="radiogroup" aria-label="Hero-media">
                    {(
                      [
                        { id: "image" as const, label: "Afbeelding" },
                        { id: "video" as const, label: "Video" },
                      ] as const
                    ).map((opt) => {
                      const selected = mediaKind === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          className={cn(
                            "rounded-lg border px-3 py-1.5 text-xs font-semibold",
                            selected
                              ? "border-sky-400/60 bg-sky-500/20 text-white"
                              : "border-white/10 bg-white/[0.03] text-white/70 hover:border-white/25",
                          )}
                          onClick={() => patchHero({ mediaKind: opt.id })}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {mediaKind === "video" ? (
                  <label className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-wide text-sky-200/80">
                    Video-URL
                    <input
                      data-cms-editor-chrome
                      className="mt-1.5 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-sky-400/50"
                      value={draftVideoUrl}
                      placeholder="https://www.youtube.com/watch?v=…"
                      onChange={(e) => setDraftVideoUrl(e.target.value)}
                      onBlur={() => {
                        if (draftVideoUrl.trim() !== videoUrl) {
                          patchHero({ videoUrl: draftVideoUrl.trim() });
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
            {mediaKind === "video" ? (
              <div className="relative overflow-hidden rounded-[2rem] border border-white/15 shadow-[0_30px_80px_-20px_rgba(63,182,242,0.4)]">
                {videoEmbed?.ok ? (
                  <div className="aspect-[4/3] w-full bg-black/50">
                    <iframe
                      title={heading || "Hero video"}
                      src={videoEmbed.embedUrl}
                      className="h-full w-full"
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                      sandbox="allow-scripts allow-same-origin allow-presentation"
                      allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center bg-black/35 px-4 text-center text-sm text-amber-100/90">
                    {showEditorChrome
                      ? videoEmbed && !videoEmbed.ok
                        ? videoEmbed.reason
                        : "Plak een YouTube-, Vimeo- of Facebook-URL hierboven."
                      : "Video niet beschikbaar."}
                  </div>
                )}
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent"
                  aria-hidden
                />
              </div>
            ) : (
            <WysiwygMediaFrame
              image={content.image}
              emptyPlaceholder
              target={{ kind: "section", sectionKey: "home.hero", field: "image" }}
            >
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
              <div
                className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent"
                aria-hidden
              />
            </div>
            </WysiwygMediaFrame>
            )}
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
