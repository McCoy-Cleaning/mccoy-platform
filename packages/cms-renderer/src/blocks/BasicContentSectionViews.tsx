/**
 * Stage 5 family A — extracted from RegisteredBlockView switch.
 * Markup inside each view must remain byte-equivalent to the prior case body.
 */
import * as React from "react";
import {
  resolveCmsLinkHref,
  resolveSafeVideoEmbed,
  type BlockType,
  type CmsButton,
  type CmsImage,
  type RoadmapBlockData,
  type TimelineBlockData,
} from "@mccoy/cms-schema";
import { CmsButtonView } from "./CmsButtonView";
import { CmsImageView, type LinkResolverPages } from "./CmsImageView";
import { WorkMosaicGallery } from "./WorkMosaicGallery";
import { GalleryTextAndImageView } from "./GalleryTextAndImageView";
import {
  SECTION_GRID,
  SECTION_TITLE,
  SECTION_TITLE_TIGHT,
} from "../sectionLayout";
import { SectionShell } from "../SectionShell";
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


export function HeroSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "hero" as BlockType;
const image = d.image as CmsImage | undefined;
      const cta = d.cta as CmsButton | undefined;
      const alignCenter = d.align === "center";
      return (
        <SectionShell blockType={type} tone="hero">
          <div
            className={cn(
              "grid items-center gap-10 lg:gap-14",
              image && !alignCenter ? "md:grid-cols-2" : "",
              alignCenter && "justify-items-center text-center",
            )}
          >
            <div className={cn("space-y-5", alignCenter && "flex w-full max-w-3xl flex-col items-center")}>
              {typeof d.eyebrow === "string" && d.eyebrow ? (
                <SectionEyebrow className="inline-flex rounded-full border border-primary/35 bg-primary/10 px-3.5 py-1 tracking-[0.16em]">
                  {d.eyebrow}
                </SectionEyebrow>
              ) : null}
              <h1
                data-testid="hero-heading"
                className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl"
              >
                {String(d.title ?? "")}
              </h1>
              {typeof d.subtitle === "string" && d.subtitle ? (
                <p
                  className={cn(
                    "max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg",
                    alignCenter && "mx-auto",
                  )}
                >
                  {d.subtitle}
                </p>
              ) : null}
              <OptionalCta
                cta={cta}
                pages={pages}
                className="inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
              />
            </div>
            <FitImage
              image={image}
              aspectClass="aspect-[4/3]"
              className={cn("w-full rounded-3xl ring-1 ring-white/10", alignCenter && "max-w-3xl")}
            />
          </div>
        </SectionShell>
      );
}

export function TitleBodyCtaSectionView({
  data: d,
  pages = [],
  blockType,
}: BlockSectionViewProps & { blockType: "richText" | "centered" | "cta" }) {
  const type = blockType;
const centered = type === "centered";
      return (
        <SectionShell
          blockType={type}
          tone={type === "cta" ? "cta" : "default"}
          innerMaxWidth={centered ? "2xl" : type === "richText" ? "3xl" : "7xl"}
          innerClassName={centered ? "text-center" : undefined}
        >
          <SectionHeader
            title={String(d.title ?? "")}
            body={typeof d.body === "string" ? d.body : undefined}
            align={centered ? "center" : undefined}
            className={type === "cta" ? "mb-8 sm:mb-10" : undefined}
          />
          <div className={cn(type === "cta" ? "mt-2" : "mt-2", centered && "flex justify-center")}>
            <OptionalCta
              cta={d.cta as CmsButton | undefined}
              pages={pages}
              className="inline-flex rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            />
          </div>
        </SectionShell>
      );
}

export function RichTextSectionView(props: BlockSectionViewProps) {
  return <TitleBodyCtaSectionView {...props} blockType="richText" />;
}

export function CenteredSectionView(props: BlockSectionViewProps) {
  return <TitleBodyCtaSectionView {...props} blockType="centered" />;
}

export function CtaSectionView(props: BlockSectionViewProps) {
  return <TitleBodyCtaSectionView {...props} blockType="cta" />;
}

export function TextImageSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "textImage" as BlockType;
const image = d.image as CmsImage | undefined;
      return (
        <SectionShell blockType={type}>
          <div
            className={cn(
              "grid items-center gap-10 sm:gap-12 md:grid-cols-2 md:gap-14",
              d.reverse === true && "md:[direction:rtl] md:[&>*]:[direction:ltr]",
            )}
          >
            <div className="min-w-0">
              <h2 className="font-display text-3xl font-semibold tracking-tight text-foreground break-words sm:text-4xl">
                {String(d.title ?? "")}
              </h2>
              {typeof d.body === "string" && d.body ? (
                <p className="mt-5 whitespace-pre-wrap text-base leading-relaxed text-muted-foreground break-words">
                  {d.body}
                </p>
              ) : null}
            </div>
            {image ? (
              <SectionSurface variant="media" className="w-full">
                <FitImage image={image} aspectClass="aspect-[4/3]" className="w-full" />
              </SectionSurface>
            ) : (
              <div
                className="flex aspect-[4/3] items-center justify-center rounded-3xl border border-dashed border-border bg-card/30 text-sm text-muted-foreground"
                aria-hidden
              >
                Geen afbeelding
              </div>
            )}
          </div>
        </SectionShell>
      );
}

export function FeatureGridSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "featureGrid" as BlockType;
  const features =
    (d.features as Array<{
      id: string;
      icon?: string;
      title: string;
      body: string;
      cta?: CmsButton;
    }>) ?? [];
  return (
    <SectionShell blockType={type}>
      <SectionTitle>{String(d.title ?? "")}</SectionTitle>
      {features.length === 0 ? (
        <p className="text-sm text-white/55">Nog geen kenmerken.</p>
      ) : (
        <div className={cn(SECTION_GRID, "sm:grid-cols-2")}>
          {features.map((f) => (
            <SectionSurface key={f.id} variant="outlined" className="flex h-full flex-col p-5 sm:p-6">
              {f.icon ? (
                <span className="mb-2 block text-xs uppercase tracking-wider text-primary/80" aria-hidden>
                  {f.icon}
                </span>
              ) : null}
              <h3 className="font-semibold text-foreground break-words">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground break-words">{f.body}</p>
              <OptionalCta
                cta={f.cta}
                pages={pages}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary"
              />
            </SectionSurface>
          ))}
        </div>
      )}
    </SectionShell>
  );
}
