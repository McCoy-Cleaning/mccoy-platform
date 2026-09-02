/**
 * Stage 5 family A — extracted from RegisteredBlockView switch.
 * Hero matches the storefront Home hero composition (full-bleed, media card, trust strip).
 */
import * as React from "react";
import {
  createItemId,
  isCmsButtonInteractive,
  resolveCmsLinkHref,
  resolveSafeVideoEmbed,
  type BlockType,
  type CmsButton,
  type CmsImage,
  type HeroHeadingAccent,
  type HeroHighlightStat,
  type HeroTrustItem,
  type RoadmapBlockData,
  type TimelineBlockData,
} from "@mccoy/cms-schema";
import { CmsButtonView } from "./CmsButtonView";
import { CmsImageView, type LinkResolverPages } from "./CmsImageView";
import { WorkMosaicGallery } from "./WorkMosaicGallery";
import { GalleryTextAndImageView } from "./GalleryTextAndImageView";
import {
  CmsListAddButton,
  CmsListRemoveButton,
  EditableCta,
  EditableMedia,
  EditableText,
  useCmsBlockEditScope,
  useCmsEditSurface,
  useCmsTypedListEditor,
} from "../edit-surface";
import {
  SECTION_GRID,
  SECTION_PAGE_RAIL,
  SECTION_TITLE,
  SECTION_TITLE_TIGHT,
} from "../sectionLayout";
import { SectionShell } from "../SectionShell";
import { SectionInner } from "../SectionInner";
import { SectionEyebrow, SectionHeader, SectionIndex, SectionSurface } from "../sectionChromeUi";
import {
  cn,
  SectionTitle,
  OptionalImage,
  FitImage,
  CoverFillImage,
  OptionalCta,
  type BlockSectionViewProps,
} from "./blockViewShared";

function HeroSparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3l1.2 3.6L17 8l-3.8 1.4L12 13l-1.2-3.6L7 8l3.8-1.4L12 3zM18.5 13l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1zM6.5 14l.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6.6-1.8z"
        fill="currentColor"
      />
    </svg>
  );
}

function HeroCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M8.5 12.2l2.2 2.2 4.8-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeroAwardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="9" r="5.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M9.2 13.6L8 20l4-2.2L16 20l-1.2-6.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeroShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3.5l7 2.5v6.2c0 4.1-2.8 7.8-7 8.8-4.2-1-7-4.7-7-8.8V6L12 3.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 12.1l1.9 1.9 3.6-3.8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function heroAccentParts(raw: unknown): HeroHeadingAccent | undefined {
  if (!raw || typeof raw !== "object") {
    if (typeof raw === "string" && raw.trim()) return { accent: raw.trim() };
    return undefined;
  }
  const rec = raw as Record<string, unknown>;
  const parts: HeroHeadingAccent = {
    beforeAccent: typeof rec.beforeAccent === "string" ? rec.beforeAccent : undefined,
    accent: typeof rec.accent === "string" ? rec.accent : undefined,
    afterAccent: typeof rec.afterAccent === "string" ? rec.afterAccent : undefined,
  };
  if (!parts.beforeAccent && !parts.accent && !parts.afterAccent) return undefined;
  return parts;
}

function HeroMediaKindChrome({
  mediaKind,
  videoUrl,
}: {
  mediaKind: "image" | "video";
  videoUrl: string;
}) {
  const surface = useCmsEditSurface();
  const scope = useCmsBlockEditScope();
  const [draftUrl, setDraftUrl] = React.useState(videoUrl);

  React.useEffect(() => {
    setDraftUrl(videoUrl);
  }, [videoUrl]);

  if (!surface?.enabled || !scope || !surface.sendBlockPatch) {
    return null;
  }

  return (
    <div
      data-cms-editor-chrome
      className="mb-3 flex flex-col gap-3 rounded-2xl border border-sky-400/25 bg-sky-500/5 p-3 sm:flex-row sm:items-end"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-200/80">Hero-media</p>
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
                onClick={() => {
                  surface.sendBlockPatch?.(scope.blockId, { mediaKind: opt.id });
                }}
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
            value={draftUrl}
            placeholder="https://www.youtube.com/watch?v=…"
            onChange={(e) => setDraftUrl(e.target.value)}
            onBlur={() => {
              if (draftUrl.trim() !== videoUrl) {
                surface.sendBlockPatch?.(scope.blockId, { videoUrl: draftUrl.trim() });
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
  );
}

function HeroMediaFrame({
  image,
  mediaKind,
  videoUrl,
  title,
}: {
  image?: CmsImage;
  mediaKind: "image" | "video";
  videoUrl: string;
  title: string;
}) {
  const surface = useCmsEditSurface();
  const editing = Boolean(surface?.enabled);
  const embed = mediaKind === "video" ? resolveSafeVideoEmbed(videoUrl) : null;

  if (mediaKind === "video") {
    return (
      <div className="relative overflow-hidden rounded-[2rem] border border-white/15 shadow-[0_30px_80px_-20px_rgba(63,182,242,0.4)]">
        {embed?.ok ? (
          <div className="aspect-[4/3] w-full bg-black/50">
            <iframe
              title={title || "Hero video"}
              src={embed.embedUrl}
              className="h-full w-full"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : (
          <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-black/35 px-4 text-center text-sm text-amber-100/90">
            {editing
              ? embed && !embed.ok
                ? embed.reason
                : "Plak een YouTube-, Vimeo- of Facebook-URL hierboven."
              : "Video niet beschikbaar."}
          </div>
        )}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent"
          aria-hidden
        />
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-white/15 shadow-[0_30px_80px_-20px_rgba(63,182,242,0.4)]">
      <EditableMedia path="image" image={image} emptyPlaceholder className="block w-full">
        <FitImage
          image={image}
          aspectClass="aspect-[4/3]"
          className="w-full bg-black/35"
          imgClassName="object-contain object-center"
        />
      </EditableMedia>
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent"
        aria-hidden
      />
    </div>
  );
}

export function HeroSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "hero" as BlockType;
  const image = d.image as CmsImage | undefined;
  const cta = d.cta as CmsButton | undefined;
  const secondaryCta = d.secondaryCta as CmsButton | undefined;
  const alignCenter = d.align === "center";
  const accent = heroAccentParts(d.headingAccent);
  const trustItems = Array.isArray(d.trustItems)
    ? (d.trustItems as HeroTrustItem[]).filter((item) => item.value || item.label)
    : [];
  const highlightStat =
    d.highlightStat && typeof d.highlightStat === "object"
      ? (d.highlightStat as HeroHighlightStat)
      : undefined;
  const certBadge = typeof d.certBadge === "string" ? d.certBadge.trim() : "";
  const title = String(d.title ?? "");
  const subtitle = typeof d.subtitle === "string" ? d.subtitle : "";
  const eyebrow = typeof d.eyebrow === "string" ? d.eyebrow : "";
  const mediaKind = d.mediaKind === "video" ? "video" : "image";
  const videoUrl = typeof d.videoUrl === "string" ? d.videoUrl : "";
  const surface = useCmsEditSurface();
  const editing = Boolean(surface?.enabled);
  const showMediaColumn = mediaKind === "video" || Boolean(image) || editing;

  const showPrimary = cta && isCmsButtonInteractive(cta);
  const showSecondary = secondaryCta && isCmsButtonInteractive(secondaryCta);

  // Offerte / form-page intro — exact FormPageChrome layout (not the Home full-bleed hero).
  // Keep out of storefront critical CSS `[data-cms-block-type=hero]` full-viewport rules via presentation attr.
  if (d.presentation === "formChrome") {
    return (
      <section
        data-cms-block-type={type}
        data-cms-presentation="formChrome"
        className="relative flex min-h-[16rem] items-center py-10 sm:min-h-[18rem] sm:py-14 md:min-h-[20rem] md:py-16"
      >
        <SectionInner>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
              <EditableText path="eyebrow" value={eyebrow}>
                {eyebrow}
              </EditableText>
            </p>
          ) : null}
          <h1 className="font-display mt-4 max-w-3xl text-5xl text-white md:text-7xl">
            <EditableText path="title" value={title}>
              {title}
            </EditableText>
          </h1>
          {subtitle ? (
            <p className="mt-5 max-w-2xl whitespace-pre-line font-bold text-white/65">
              <EditableText path="subtitle" value={subtitle} multiline>
                {subtitle}
              </EditableText>
            </p>
          ) : null}
          {image || editing ? (
            <div className="mt-8 max-w-3xl overflow-hidden rounded-2xl border border-white/10">
              <EditableMedia path="image" image={image} emptyPlaceholder>
                {image ? (
                  <CmsImageView
                    image={image}
                    className="max-h-64 w-full bg-black/35 object-contain object-center"
                  />
                ) : null}
              </EditableMedia>
            </div>
          ) : null}
        </SectionInner>
      </section>
    );
  }

  return (
    <section
      id="home"
      data-cms-block-type={type}
      data-cms-header-mode="block"
      data-cms-surface-mode="none"
      data-cms-width-mode="fullBleed"
      className="relative isolate flex min-h-[100svh] items-center overflow-hidden pt-24"
    >
      <div className="absolute inset-0 -z-10 bg-grid opacity-40" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-background to-background/90" />

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

      <div
        className={cn(
          SECTION_PAGE_RAIL,
          "grid w-full items-center gap-12 py-20 lg:grid-cols-12",
          alignCenter && "justify-items-center text-center",
        )}
      >
        <div className={cn(alignCenter ? "lg:col-span-12 max-w-3xl" : "lg:col-span-7")}>
          {eyebrow ? (
            <div className="group inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-primary shadow-[0_0_40px_-10px_rgba(63,182,242,0.6)] backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full motion-safe:animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <HeroSparklesIcon className="h-3.5 w-3.5" />
              <span>
                <EditableText path="eyebrow" value={eyebrow}>
                  {eyebrow}
                </EditableText>
              </span>
            </div>
          ) : null}

          <h1
            data-testid="hero-heading"
            className="font-display mt-6 text-6xl leading-[0.98] tracking-tight text-white sm:text-7xl lg:text-[5.75rem] xl:text-[6.5rem]"
          >
            <EditableText path="title" value={title}>
              {title}
            </EditableText>
            {accent?.beforeAccent ? (
              <>
                {" "}
                <EditableText path="headingAccent.beforeAccent" value={accent.beforeAccent}>
                  {accent.beforeAccent}
                </EditableText>
              </>
            ) : null}
            {accent?.accent ? (
              <>
                {" "}
                <span className="relative inline-block bg-gradient-to-br from-primary via-primary to-white/90 bg-clip-text text-transparent">
                  <EditableText path="headingAccent.accent" value={accent.accent}>
                    {accent.accent}
                  </EditableText>
                  <span
                    aria-hidden
                    className="absolute -bottom-2 left-0 h-1 w-full rounded-full bg-primary/70"
                  />
                </span>
              </>
            ) : null}
            {accent?.afterAccent ? (
              <>
                {" "}
                <EditableText path="headingAccent.afterAccent" value={accent.afterAccent}>
                  {accent.afterAccent}
                </EditableText>
              </>
            ) : null}
          </h1>

          {subtitle ? (
            <p className="mt-8 max-w-xl whitespace-pre-line text-lg text-white/75 md:text-xl">
              <EditableText path="subtitle" value={subtitle} multiline>
                {subtitle}
              </EditableText>
            </p>
          ) : null}

          {showPrimary || showSecondary ? (
            <div
              className={cn(
                "mt-9 flex flex-wrap gap-3",
                alignCenter && "justify-center",
              )}
            >
              {showPrimary ? (
                <EditableCta path="cta" button={cta}>
                  <CmsButtonView
                    button={cta}
                    pages={pages}
                    className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                </EditableCta>
              ) : null}
              {showSecondary ? (
                <EditableCta path="secondaryCta" button={secondaryCta}>
                  <CmsButtonView
                    button={secondaryCta}
                    pages={pages}
                    className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-7 py-4 text-sm font-semibold text-white backdrop-blur transition hover:border-primary/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  />
                </EditableCta>
              ) : null}
            </div>
          ) : null}

          {trustItems.length > 0 ? (
            <div
              className={cn(
                "mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-xs uppercase tracking-[0.2em] text-white/55",
                alignCenter ? "justify-center" : "justify-center lg:justify-start",
              )}
            >
              {trustItems.map((item) => (
                <span key={item.id} className="flex items-center gap-2">
                  <HeroCheckIcon className="h-3.5 w-3.5 text-primary" />
                  {item.value} {item.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {showMediaColumn && !alignCenter ? (
          <div className="relative lg:col-span-5">
            <div className="relative mx-auto max-w-md">
              <HeroMediaKindChrome mediaKind={mediaKind} videoUrl={videoUrl} />
              <HeroMediaFrame
                image={image}
                mediaKind={mediaKind}
                videoUrl={videoUrl}
                title={title}
              />
              {highlightStat && (highlightStat.value || highlightStat.label) ? (
                <div className="absolute -bottom-6 -left-6 hidden rounded-2xl border border-white/15 bg-card/95 px-5 py-4 shadow-2xl sm:block">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                      <HeroAwardIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-display text-2xl leading-none text-white">
                        <EditableText path="highlightStat.value" value={highlightStat.value}>
                          {highlightStat.value}
                        </EditableText>
                      </div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-white/60">
                        <EditableText path="highlightStat.label" value={highlightStat.label}>
                          {highlightStat.label}
                        </EditableText>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              {certBadge ? (
                <div className="absolute -top-4 -right-4 hidden rounded-2xl border border-primary/30 bg-primary/20 px-4 py-3 sm:block">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white">
                    <HeroShieldIcon className="h-4 w-4 text-primary" />{" "}
                    <EditableText path="certBadge" value={certBadge}>
                      {certBadge}
                    </EditableText>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : showMediaColumn && alignCenter ? (
          <div className="relative w-full max-w-md lg:col-span-12">
            <HeroMediaKindChrome mediaKind={mediaKind} videoUrl={videoUrl} />
            <HeroMediaFrame
              image={image}
              mediaKind={mediaKind}
              videoUrl={videoUrl}
              title={title}
            />
          </div>
        ) : null}
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2" aria-hidden>
        <div className="h-10 w-6 rounded-full border border-white/20 p-1">
          <div className="mx-auto h-2 w-1 rounded-full bg-primary motion-safe:animate-bounce" />
        </div>
      </div>
    </section>
  );
}

export function TitleBodyCtaSectionView({
  data: d,
  pages = [],
  blockType,
}: BlockSectionViewProps & { blockType: "richText" | "centered" | "cta" }) {
  const type = blockType;
  const centered = type === "centered";
  const editing = Boolean(useCmsEditSurface()?.enabled);
  const title = String(d.title ?? "");
  const body = typeof d.body === "string" ? d.body : "";
  const cta = d.cta as CmsButton | undefined;
  const showBody = Boolean(body) || editing;
  return (
    <SectionShell
      blockType={type}
      tone={type === "cta" ? "cta" : "default"}
      innerMaxWidth={centered ? "2xl" : type === "richText" ? "3xl" : "7xl"}
      innerClassName={centered ? "text-center" : undefined}
    >
      <SectionHeader
        title={
          <EditableText path="title" value={title}>
            {title}
          </EditableText>
        }
        body={
          showBody ? (
            <EditableText path="body" value={body} multiline>
              {body}
            </EditableText>
          ) : undefined
        }
        align={centered ? "center" : undefined}
        className={type === "cta" ? "mb-8 sm:mb-10" : undefined}
      />
      <div className={cn(type === "cta" ? "mt-2" : "mt-2", centered && "flex justify-center")}>
        {cta ? (
          <EditableCta path="cta" button={cta}>
            <OptionalCta
              cta={cta}
              pages={pages}
              className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            />
          </EditableCta>
        ) : (
          <OptionalCta
            cta={cta}
            pages={pages}
            className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          />
        )}
      </div>
    </SectionShell>
  );
}

export function RichTextSectionView(props: BlockSectionViewProps) {
  return <TitleBodyCtaSectionView {...props} blockType="richText" />;
}

export function CenteredSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "centered" as BlockType;
  const list = useCmsTypedListEditor<{ id: string; icon?: string; label: string }>("pillars");
  const editing = list.editing || Boolean(useCmsEditSurface()?.enabled);
  const title = String(d.title ?? "");
  const body = typeof d.body === "string" ? d.body : "";
  const eyebrow = typeof d.eyebrow === "string" ? d.eyebrow : "";
  const cta = d.cta as CmsButton | undefined;
  const pillars =
    (d.pillars as Array<{ id: string; icon?: string; label: string }> | undefined) ?? [];
  const showBody = Boolean(body) || editing;
  const showEyebrow = Boolean(eyebrow.trim()) || editing;
  const showPillars = pillars.length > 0 || editing;

  return (
    <SectionShell
      blockType={type}
      innerMaxWidth="2xl"
      innerClassName="text-center"
    >
      {showEyebrow ? (
        <SectionEyebrow className="justify-center">
          <EditableText path="eyebrow" value={eyebrow}>
            {eyebrow}
          </EditableText>
        </SectionEyebrow>
      ) : null}
      <SectionHeader
        title={
          <EditableText path="title" value={title}>
            {title}
          </EditableText>
        }
        body={
          showBody ? (
            <EditableText path="body" value={body} multiline>
              {body}
            </EditableText>
          ) : undefined
        }
        align="center"
      />
      {showPillars ? (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-2">
          {pillars.map((p, index) => (
            <SectionSurface
              key={p.id}
              variant="outlined"
              className="relative flex items-center gap-3 p-4 text-left"
            >
              {list.editing ? (
                <CmsListRemoveButton
                  label={`Pijler verwijderen: ${p.label}`}
                  onRemove={() => list.removeById(pillars, p.id)}
                />
              ) : null}
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-xs font-semibold uppercase text-primary"
                aria-hidden
              >
                {(p.icon ?? "award").slice(0, 2)}
              </span>
              <EditableText path={`pillars.${index}.label`} value={p.label}>
                {p.label}
              </EditableText>
            </SectionSurface>
          ))}
          {list.editing ? (
            <CmsListAddButton
              label="Pijler toevoegen"
              onAdd={() =>
                list.append(pillars, {
                  id: createItemId("pillar"),
                  icon: "award",
                  label: "Nieuwe pijler",
                })
              }
              className="min-h-[4.5rem]"
            />
          ) : null}
        </div>
      ) : null}
      <div className="mt-8 flex justify-center">
        {cta ? (
          <EditableCta path="cta" button={cta}>
            <OptionalCta
              cta={cta}
              pages={pages}
              className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            />
          </EditableCta>
        ) : (
          <OptionalCta
            cta={cta}
            pages={pages}
            className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
          />
        )}
      </div>
    </SectionShell>
  );
}

export function CtaSectionView(props: BlockSectionViewProps) {
  return <TitleBodyCtaSectionView {...props} blockType="cta" />;
}

export function TextImageSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "textImage" as BlockType;
  const list = useCmsTypedListEditor<{ id: string; value: string; label: string }>("metrics");
  const editing = list.editing || Boolean(useCmsEditSurface()?.enabled);
  const image = d.image as CmsImage | undefined;
  const title = String(d.title ?? "");
  const body = typeof d.body === "string" ? d.body : "";
  const eyebrow = typeof d.eyebrow === "string" ? d.eyebrow : "";
  const notice = typeof d.notice === "string" ? d.notice : "";
  const tag = typeof d.tag === "string" ? d.tag : "";
  const metrics =
    (d.metrics as Array<{ id: string; value: string; label: string }> | undefined) ?? [];
  const showBody = Boolean(body) || editing;
  const showEyebrow = Boolean(eyebrow.trim()) || editing;
  const showNotice = Boolean(notice.trim()) || editing;
  const showTag = Boolean(tag.trim()) || editing;
  const showMetrics = metrics.length > 0 || list.editing;

  return (
    <SectionShell blockType={type}>
      <div
        className={cn(
          "grid items-center gap-10 sm:gap-12 md:grid-cols-2 md:gap-14",
          d.reverse === true && "md:[direction:rtl] md:[&>*]:[direction:ltr]",
        )}
      >
        <div className="min-w-0">
          {showEyebrow ? (
            <SectionEyebrow>
              <EditableText path="eyebrow" value={eyebrow}>
                {eyebrow}
              </EditableText>
            </SectionEyebrow>
          ) : null}
          {showTag ? (
            <p className="mb-2 font-display text-sm uppercase tracking-[0.3em] text-primary/80">
              <EditableText path="tag" value={tag}>
                {tag}
              </EditableText>
            </p>
          ) : null}
          <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground break-words sm:text-4xl">
            <EditableText path="title" value={title}>
              {title}
            </EditableText>
          </h2>
          {showBody ? (
            <p className="mt-5 whitespace-pre-wrap text-base leading-relaxed text-muted-foreground break-words">
              <EditableText path="body" value={body} multiline>
                {body}
              </EditableText>
            </p>
          ) : null}
          {showNotice ? (
            <p className="mt-4 rounded-2xl border border-border/60 bg-card/40 px-4 py-3 text-sm text-muted-foreground whitespace-pre-wrap">
              <EditableText path="notice" value={notice} multiline>
                {notice}
              </EditableText>
            </p>
          ) : null}
          {showMetrics ? (
            <div className="mt-8 grid grid-cols-3 gap-3">
              {metrics.map((m, index) => (
                <div key={m.id} className="relative min-w-0">
                  {list.editing ? (
                    <CmsListRemoveButton
                      label={`Metric verwijderen: ${m.label || m.value}`}
                      className="right-0 top-0"
                      onRemove={() => list.removeById(metrics, m.id)}
                    />
                  ) : null}
                  <p className="font-display text-2xl font-semibold text-foreground">
                    <EditableText path={`metrics.${index}.value`} value={m.value}>
                      {m.value}
                    </EditableText>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <EditableText path={`metrics.${index}.label`} value={m.label}>
                      {m.label}
                    </EditableText>
                  </p>
                </div>
              ))}
              {list.editing ? (
                <CmsListAddButton
                  compact
                  label="Metric toevoegen"
                  onAdd={() =>
                    list.append(metrics, {
                      id: createItemId("metric"),
                      value: "0",
                      label: "Label",
                    })
                  }
                  className="col-span-3"
                />
              ) : null}
            </div>
          ) : null}
        </div>
        <SectionSurface variant="media" className="w-full">
          <EditableMedia path="image" image={image}>
            {image ? (
              <FitImage image={image} aspectClass="aspect-[4/3]" className="w-full" />
            ) : (
              <div
                className="flex aspect-[4/3] items-center justify-center rounded-3xl border border-dashed border-border bg-card/30 text-sm text-muted-foreground"
                aria-hidden
              >
                Geen afbeelding
              </div>
            )}
          </EditableMedia>
        </SectionSurface>
      </div>
    </SectionShell>
  );
}

export function FeatureGridSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "featureGrid" as BlockType;
  const list = useCmsTypedListEditor<{
    id: string;
    icon?: string;
    title: string;
    body: string;
    cta?: CmsButton;
  }>("features");
  const editing = list.editing;
  const features =
    (d.features as Array<{
      id: string;
      icon?: string;
      title: string;
      body: string;
      cta?: CmsButton;
    }>) ?? [];
  const title = String(d.title ?? "");
  const eyebrow = typeof d.eyebrow === "string" ? d.eyebrow : "";
  const intro = typeof d.intro === "string" ? d.intro : "";
  const showEyebrow = Boolean(eyebrow.trim()) || editing;
  const showIntro = Boolean(intro.trim()) || editing;
  return (
    <SectionShell blockType={type}>
      {showEyebrow ? (
        <SectionEyebrow>
          <EditableText path="eyebrow" value={eyebrow}>
            {eyebrow}
          </EditableText>
        </SectionEyebrow>
      ) : null}
      <SectionTitle>
        <EditableText path="title" value={title}>
          {title}
        </EditableText>
      </SectionTitle>
      {showIntro ? (
        <p className="mt-3 max-w-2xl text-muted-foreground">
          <EditableText path="intro" value={intro} multiline>
            {intro}
          </EditableText>
        </p>
      ) : null}
      {features.length === 0 && !editing ? (
        <p className="text-sm text-white/55">Nog geen kenmerken.</p>
      ) : (
        <div className={cn(SECTION_GRID, "sm:grid-cols-2")}>
          {features.map((f, index) => (
            <SectionSurface
              key={f.id}
              variant="outlined"
              className="relative flex h-full flex-col p-5 sm:p-6"
            >
              {editing ? (
                <CmsListRemoveButton
                  label={`Kenmerk verwijderen: ${f.title}`}
                  onRemove={() => list.removeById(features, f.id)}
                />
              ) : null}
              {f.icon ? (
                <span className="mb-2 block text-xs uppercase tracking-wider text-primary/80" aria-hidden>
                  {f.icon}
                </span>
              ) : null}
              <h3 className="font-semibold text-foreground break-words">
                <EditableText path={`features.${index}.title`} value={f.title}>
                  {f.title}
                </EditableText>
              </h3>
              <p className="mt-2 text-sm text-muted-foreground break-words">
                <EditableText path={`features.${index}.body`} value={f.body} multiline>
                  {f.body}
                </EditableText>
              </p>
              {f.cta ? (
                <EditableCta path={`features.${index}.cta`} button={f.cta}>
                  <OptionalCta
                    cta={f.cta}
                    pages={pages}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary"
                  />
                </EditableCta>
              ) : (
                <OptionalCta
                  cta={f.cta}
                  pages={pages}
                  className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary"
                />
              )}
            </SectionSurface>
          ))}
          {editing ? (
            <CmsListAddButton
              label="Kenmerk toevoegen"
              onAdd={() =>
                list.append(features, {
                  id: createItemId("feat"),
                  icon: "sparkles",
                  title: "Nieuw kenmerk",
                  body: "Toelichting",
                })
              }
            />
          ) : null}
        </div>
      )}
    </SectionShell>
  );
}
