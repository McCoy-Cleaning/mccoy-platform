/**
 * Stage 5 family C — extracted from RegisteredBlockView switch.
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


export function GallerySectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "gallery" as BlockType;
const images =
        (d.images as Array<{
          id: string;
          image: CmsImage;
          title?: string;
          caption?: string;
          body?: string;
          shape?: "wide" | "square" | "tall";
        }>) ?? [];
      const contentMode = d.contentMode === "textAndImage" ? "textAndImage" : "imagesOnly";
      const layout = d.layout === "masonry" || d.layout === "featured" ? d.layout : "grid";

      if (contentMode === "textAndImage") {
        const columns =
          d.columns === 3 || d.columns === 4
            ? d.columns
            : images.length === 3
              ? 3
              : 2;
        return (
          <GalleryTextAndImageView
            title={String(d.title ?? "Galerij")}
            eyebrow={typeof d.eyebrow === "string" ? d.eyebrow : undefined}
            intro={typeof d.body === "string" ? d.body : undefined}
            textPlacement={
              d.textPlacement === "above" ||
              d.textPlacement === "left" ||
              d.textPlacement === "right" ||
              d.textPlacement === "below"
                ? d.textPlacement
                : "below"
            }
            columns={columns}
            items={images.map((img) => ({
              id: img.id,
              image: img.image,
              title: img.title,
              caption: img.caption,
              body: img.body,
            }))}
          />
        );
      }

      if (layout === "featured") {
        return (
          <WorkMosaicGallery
            eyebrow={typeof d.eyebrow === "string" ? d.eyebrow : undefined}
            heading={String(d.title ?? "Galerij")}
            body={typeof d.body === "string" ? d.body : undefined}
            items={images.map((img) => ({
              id: img.id,
              title: img.title?.trim() || img.image.alt || "McCoy work",
              caption: img.caption,
              image: img.image,
              shape: img.shape,
            }))}
          />
        );
      }

      return (
        <SectionShell blockType={type}>
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          {images.length === 0 ? (
            <p className="text-sm text-white/55">Nog geen afbeeldingen in deze galerij.</p>
          ) : layout === "masonry" ? (
            <div className="columns-1 gap-6 sm:columns-2 sm:gap-8 lg:columns-3 lg:gap-10">
              {images.map((img) => (
                <div
                  key={img.id}
                  className={cn(
                    "group relative mb-6 break-inside-avoid overflow-hidden rounded-[1.35rem] bg-white/[0.03] sm:mb-8 lg:mb-10",
                    "ring-1 ring-inset ring-white/12",
                    "transition-[box-shadow,ring-color] duration-500",
                    "hover:ring-white/22 hover:shadow-[0_22px_48px_-30px_rgba(0,0,0,0.7)]",
                    "motion-reduce:transition-none motion-reduce:hover:shadow-none",
                  )}
                >
                  <CmsImageView
                    image={img.image}
                    className="block h-auto w-full object-contain"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div
              className={cn(
                SECTION_GRID,
                images.length === 1
                  ? "mx-auto max-w-xl sm:grid-cols-1"
                  : images.length === 2
                    ? "mx-auto max-w-4xl sm:grid-cols-2"
                    : "sm:grid-cols-2 lg:grid-cols-3",
              )}
            >
              {images.map((img) => (
                <div
                  key={img.id}
                  className={cn(
                    "group relative overflow-hidden rounded-[1.35rem] bg-white/[0.03]",
                    "ring-1 ring-inset ring-white/12",
                    "transition-[box-shadow,ring-color] duration-500",
                    "hover:ring-white/22 hover:shadow-[0_22px_48px_-30px_rgba(0,0,0,0.7)]",
                    "motion-reduce:transition-none motion-reduce:hover:shadow-none",
                  )}
                >
                  <CoverFillImage
                    image={img.image}
                    aspectClass="aspect-square"
                    className="w-full"
                    imgClassName="transition duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                </div>
              ))}
            </div>
          )}
        </SectionShell>
      );
}

export function VideoSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "video" as BlockType;
const embed = resolveSafeVideoEmbed(String(d.videoUrl ?? ""));
      return (
        <SectionShell blockType={type}>
          {typeof d.title === "string" && d.title ? <SectionTitle>{d.title}</SectionTitle> : null}
          {embed.ok ? (
            <SectionSurface variant="media" className="aspect-video">
              <iframe
                title={typeof d.title === "string" && d.title ? d.title : "Video"}
                src={embed.embedUrl}
                className="h-full w-full"
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </SectionSurface>
          ) : (
            <p className="text-sm text-amber-200">{embed.reason}</p>
          )}
        </SectionShell>
      );
}

export function BeforeAfterSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "beforeAfter" as BlockType;

      return (
        <SectionShell blockType={type}>
          {typeof d.title === "string" && d.title ? <SectionTitle>{d.title}</SectionTitle> : null}
          <div className={cn(SECTION_GRID, "md:grid-cols-2")}>
            <SectionSurface variant="media">
              <FitImage
                image={d.before as CmsImage | undefined}
                aspectClass="aspect-[4/3]"
                className="w-full"
              />
            </SectionSurface>
            <SectionSurface variant="media">
              <FitImage
                image={d.after as CmsImage | undefined}
                aspectClass="aspect-[4/3]"
                className="w-full"
              />
            </SectionSurface>
          </div>
        </SectionShell>
      );
    
}

export function CarouselSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "carousel" as BlockType;
const slides =
        (d.slides as Array<{ id: string; title: string; body?: string; image?: CmsImage }>) ?? [];
      return (
        <SectionShell blockType={type}>
          {slides.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nog geen slides in deze carousel.</p>
          ) : (
            <div
              className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-4 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:-mx-6 sm:gap-8 sm:px-6 lg:-mx-8 lg:gap-10 lg:px-8"
              role="region"
              aria-label="Carousel"
              tabIndex={0}
            >
              {slides.map((s) => (
                <SectionSurface
                  key={s.id}
                  variant="elevated"
                  className="w-[min(100%,20rem)] shrink-0 snap-start p-5 transition hover:border-primary/35 focus-within:border-primary/40 sm:w-[22rem] sm:p-6"
                >
                  <article>
                    <FitImage
                      image={s.image}
                      aspectClass="aspect-video"
                      className="mb-4 w-full rounded-2xl"
                    />
                    <h3 className="font-display text-lg font-semibold text-foreground">{s.title}</h3>
                    {s.body ? (
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                    ) : null}
                  </article>
                </SectionSurface>
              ))}
            </div>
          )}
        </SectionShell>
      );
}

export function SpacerSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "spacer" as BlockType;
const size =
        d.size === "xs"
          ? "h-4"
          : d.size === "sm"
            ? "h-8"
            : d.size === "lg"
              ? "h-24"
              : d.size === "xl"
                ? "h-32"
                : "h-14";
      return (
        <div data-cms-block-type={type} className={cn(size, "w-full")} aria-hidden>
          {d.divider === true ? <hr className="border-white/10" /> : null}
        </div>
      );
}

export function QuoteSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "quote" as BlockType;
const rawItems = Array.isArray(d.items) ? d.items : [];
      const items =
        rawItems.length > 0
          ? (rawItems as Array<{
              id: string;
              quote?: string;
              author?: string;
              role?: string;
              company?: string;
              avatar?: CmsImage;
            }>)
          : [
              {
                id: "legacy",
                quote: String(d.quote ?? ""),
                author: typeof d.author === "string" ? d.author : undefined,
                role: typeof d.role === "string" ? d.role : undefined,
                company: typeof d.company === "string" ? d.company : undefined,
                avatar: d.avatar as CmsImage | undefined,
              },
            ];

      const renderCard = (
        item: (typeof items)[number],
        opts: { framed: boolean },
      ) => {
        const author = typeof item.author === "string" ? item.author.trim() : "";
        const role = typeof item.role === "string" ? item.role.trim() : "";
        const company = typeof item.company === "string" ? item.company.trim() : "";
        const byline = [role, company].filter(Boolean).join(" · ");
        const body = (
          <div className="space-y-6 text-center">
            <blockquote className="font-display text-2xl text-foreground md:text-3xl">
              &ldquo;{String(item.quote ?? "")}&rdquo;
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <OptionalImage
                image={item.avatar}
                className="h-14 w-14 shrink-0 rounded-full bg-black/35 object-contain p-0.5 ring-1 ring-white/10"
              />
              <div className="min-w-0 text-left">
                {author ? <p className="text-sm font-semibold text-foreground">{author}</p> : null}
                {byline ? <p className="text-xs text-muted-foreground">{byline}</p> : null}
              </div>
            </div>
          </div>
        );
        if (!opts.framed) return body;
        return (
          <SectionSurface key={item.id} variant="elevated" className="px-6 py-10 sm:px-8">
            {body}
          </SectionSurface>
        );
      };

      if (items.length <= 1) {
        return (
          <SectionShell blockType={type} innerMaxWidth="3xl" className="text-center">
            <div className="mx-auto w-full max-w-3xl">
              {renderCard(items[0]!, { framed: true })}
            </div>
          </SectionShell>
        );
      }

      return (
        <SectionShell blockType={type} innerMaxWidth="7xl">
          <div
            className={cn(
              SECTION_GRID,
              items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {items.map((item) => renderCard(item, { framed: true }))}
          </div>
        </SectionShell>
      );
}

export function TeamGridSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "teamGrid" as BlockType;
const members =
        (d.members as Array<{
          id: string;
          name: string;
          role?: string;
          bio?: string;
          photo?: CmsImage;
        }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          <div
            className={cn(
              SECTION_GRID,
              members.length === 1
                ? "mx-auto max-w-sm"
                : members.length === 2
                  ? "mx-auto max-w-4xl sm:grid-cols-2"
                  : "sm:grid-cols-2 lg:grid-cols-3",
            )}
          >
            {members.map((m) => (
              <SectionSurface
                key={m.id}
                variant="elevated"
                className="group flex flex-col overflow-hidden transition duration-300 hover:border-primary/35"
              >
              <article className="flex h-full flex-col">
                <div className="relative overflow-hidden bg-black/30">
                  <FitImage
                    image={m.photo}
                    aspectClass="aspect-[4/5]"
                    className="w-full"
                  />
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent"
                    aria-hidden
                  />
                </div>
                <div className="flex flex-1 flex-col items-center px-5 pb-6 pt-5 text-center">
                  <h3 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-[1.35rem]">
                    {m.name}
                  </h3>
                  {m.role ? (
                    <p className="mt-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
                      {m.role}
                    </p>
                  ) : null}
                  {m.bio ? (
                    <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-muted-foreground">{m.bio}</p>
                  ) : null}
                </div>
              </article>
              </SectionSurface>
            ))}
          </div>
        </SectionShell>
      );
}

export function TeamProfileSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "teamProfile" as BlockType;
const name = String(d.name ?? "").trim();
      const role = typeof d.role === "string" ? d.role.trim() : "";
      const bio = typeof d.bio === "string" ? d.bio.trim() : "";
      const email = typeof d.email === "string" ? d.email.trim() : "";
      const photo = d.photo as CmsImage | undefined;
      const mailto =
        email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          ? `mailto:${encodeURIComponent(email)}`
          : null;

      return (
        <SectionShell blockType={type} tone="muted">
          <article className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-14">
            <div className="relative mx-auto w-full max-w-[20rem] overflow-hidden rounded-3xl border border-white/10 bg-black/25 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] md:mx-0">
              {photo ? (
                <FitImage
                  image={photo}
                  aspectClass="aspect-[4/5]"
                  className="w-full"
                />
              ) : (
                <div
                  className="flex aspect-[4/5] w-full items-center justify-center bg-gradient-to-br from-primary/20 via-white/[0.04] to-transparent"
                  aria-hidden
                >
                  <span className="font-display text-5xl text-white/25">
                    {(name || "?").slice(0, 1).toUpperCase()}
                  </span>
                </div>
              )}
              <div
                className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent"
                aria-hidden
              />
            </div>

            <div className="flex min-w-0 flex-col text-center md:text-left">
              {role ? (
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary">
                  {role}
                </p>
              ) : null}
              <h2
                className={cn(
                  "font-display text-3xl leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.75rem]",
                  role ? "mt-3" : "",
                )}
              >
                {name || "Teamlid"}
              </h2>
              {bio ? (
                <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg md:mx-0">
                  {bio}
                </p>
              ) : null}
              {mailto ? (
                <div className="mt-8 flex justify-center md:justify-start">
                  <a
                    href={mailto}
                    className="inline-flex items-center gap-2.5 rounded-full border border-white/15 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-white/90 transition hover:border-primary/40 hover:bg-primary/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  >
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      className="h-4 w-4 shrink-0 text-primary"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path d="m3 7 9 6 9-6" />
                    </svg>
                    {email}
                  </a>
                </div>
              ) : null}
            </div>
          </article>
        </SectionShell>
      );
}

export function AnnouncementSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "announcement" as BlockType;
const href =
        d.link && typeof d.link === "object"
          ? resolveCmsLinkHref(d.link as Parameters<typeof resolveCmsLinkHref>[0], pages)
          : null;
      return (
        <div
          data-cms-block-type={type}
          className="border-b border-primary/30 bg-primary/15 px-4 py-3 text-center text-sm text-white"
        >
          <span>{String(d.message ?? "")}</span>
          {href && typeof d.linkLabel === "string" && d.linkLabel ? (
            <a href={href} className="ml-3 font-semibold underline">
              {d.linkLabel}
            </a>
          ) : null}
        </div>
      );
}

export function LatestPostsSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "latestPosts" as BlockType;
const posts = (d.posts as Array<{ id: string; title: string; excerpt?: string; date?: string; image?: CmsImage }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          <div className={cn(SECTION_GRID, "md:grid-cols-2")}>
            {posts.map((p) => (
              <SectionSurface key={p.id} variant="outlined" className="p-4">
                <article>
                  <FitImage image={p.image} aspectClass="aspect-video" className="mb-3 w-full rounded-xl" />
                  {p.date ? <p className="text-xs text-muted-foreground">{p.date}</p> : null}
                  <h3 className="font-semibold text-foreground">{p.title}</h3>
                  {p.excerpt ? <p className="mt-1 text-sm text-muted-foreground">{p.excerpt}</p> : null}
                </article>
              </SectionSurface>
            ))}
          </div>
        </SectionShell>
      );
}

export function PartnersMarqueeSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "partnersMarquee" as BlockType;
const items =
        (d.items as Array<{
          id: string;
          name: string;
          logo?: CmsImage;
          href?: string;
        }>) ?? [];
      const animate = d.animate !== false && items.length >= 4;
      return (
        <SectionShell blockType={type} tone="default">
          <SectionHeader
            eyebrow={typeof d.eyebrow === "string" ? d.eyebrow : undefined}
            title={typeof d.heading === "string" ? d.heading : undefined}
            className="mb-10 sm:mb-12"
          />
          <div
            className={cn(
              "grid gap-6",
              items.length <= 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
            )}
          >
            {items.map((item) => (
              <SectionSurface
                key={item.id}
                variant="outlined"
                className="flex min-h-[5rem] items-center justify-center p-4"
              >
                {item.logo ? (
                  <OptionalImage image={item.logo} className="max-h-12 w-auto object-contain" />
                ) : (
                  <span className="text-sm text-muted-foreground">{item.name}</span>
                )}
                <span className="sr-only">{item.name}</span>
              </SectionSurface>
            ))}
          </div>
          {animate ? (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Animatie uitgeschakeld in preview — storefront respecteert reduced-motion.
            </p>
          ) : null}
        </SectionShell>
      );
}

export function StatsCountersSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "statsCounters" as BlockType;
const items =
        (d.items as Array<{
          id: string;
          prefix?: string;
          value: string;
          suffix?: string;
          label: string;
          supportingText?: string;
        }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionHeader
            title={typeof d.heading === "string" ? d.heading : undefined}
            body={typeof d.body === "string" ? d.body : undefined}
            className="mb-10 sm:mb-12"
          />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
              <SectionSurface key={item.id} variant="outlined" className="p-5 sm:p-6">
                <p className="font-display text-4xl font-semibold text-foreground">
                  <span>{item.prefix ?? ""}</span>
                  <span>{item.value}</span>
                  <span>{item.suffix ?? ""}</span>
                </p>
                <p className="mt-2 text-sm font-medium text-muted-foreground">{item.label}</p>
                {item.supportingText ? (
                  <p className="mt-1 text-xs text-muted-foreground/80">{item.supportingText}</p>
                ) : null}
              </SectionSurface>
            ))}
          </div>
        </SectionShell>
      );
}
