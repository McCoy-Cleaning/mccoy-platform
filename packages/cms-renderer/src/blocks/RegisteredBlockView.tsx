import * as React from "react";
import {
  getBlockDataDefinition,
  parseBlockData,
  resolveCmsLinkHref,
  resolveSafeVideoEmbed,
  type Block,
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
import { blockViewRegistry } from "./blockViewRegistry";
import { registerPopupBlockView } from "./popupBlockRenderer";
import {
  ContactFormSectionView,
  NewsletterSectionView,
  PopupSectionView,
} from "./ConversionSectionViews";
import {
  SECTION_GRID,
  SECTION_TITLE,
  SECTION_TITLE_TIGHT,
} from "../sectionLayout";
import { SectionShell } from "../SectionShell";
import { SectionEyebrow, SectionHeader, SectionIndex, SectionSurface } from "../sectionChromeUi";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function SectionTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={cn(SECTION_TITLE, className)}>
      {children}
    </h2>
  );
}

function OptionalImage({ image, className }: { image?: CmsImage; className?: string }) {
  if (!image) return null;
  return <CmsImageView image={image} className={className} />;
}

/**
 * Framed content image that always fits — the whole photo stays visible inside
 * a fixed aspect box (object-contain on a soft backdrop), never cropped/zoomed.
 */
function FitImage({
  image,
  aspectClass,
  className,
  imgClassName,
}: {
  image?: CmsImage;
  /** Aspect-ratio frame, e.g. "aspect-[4/3]". */
  aspectClass: string;
  className?: string;
  imgClassName?: string;
}) {
  if (!image) return null;
  return (
    <div
      className={cn(
        "flex items-center justify-center overflow-hidden bg-white/[0.03]",
        aspectClass,
        className,
      )}
    >
      <CmsImageView image={image} className={cn("h-full w-full object-contain", imgClassName)} />
    </div>
  );
}

/**
 * Gallery / media tile: image crops to fill the entire frame edge-to-edge (no letterboxing).
 */
function CoverFillImage({
  image,
  aspectClass,
  className,
  imgClassName,
}: {
  image?: CmsImage;
  aspectClass: string;
  className?: string;
  imgClassName?: string;
}) {
  if (!image) return null;
  return (
    <div className={cn("relative overflow-hidden bg-white/[0.04]", aspectClass, className)}>
      <CmsImageView
        image={image}
        className={cn(
          "absolute inset-0 h-full w-full object-cover object-center",
          imgClassName,
        )}
      />
    </div>
  );
}

function OptionalCta({
  cta,
  pages,
  className,
}: {
  cta?: CmsButton;
  pages: LinkResolverPages;
  className?: string;
}) {
  if (!cta) return null;
  return <CmsButtonView button={cta} pages={pages} className={className} />;
}

export type RegisteredBlockViewProps = {
  block: Block;
  pages?: LinkResolverPages;
  /** When true, show admin-visible warnings for invalid data instead of silent skip. */
  adminMode?: boolean;
};

export function RegisteredBlockView({
  block,
  pages = [],
  adminMode = false,
}: RegisteredBlockViewProps) {
  const parsed = parseBlockData(block.type, block.data);
  if (!parsed.ok) {
    console.error("[cms-renderer] invalid block", {
      type: block.type,
      id: block.id,
      error: parsed.error,
    });
    if (adminMode) {
      return (
        <div
          className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100"
          role="alert"
        >
          Ongeldige sectie ({block.type}): {parsed.error}
        </div>
      );
    }
    return null;
  }

  const d = parsed.data as Record<string, unknown>;
  const type = block.type as BlockType;

  switch (type) {
    case "hero": {
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
    case "richText":
    case "centered":
    case "cta": {
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
    case "textImage": {
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
    case "columns": {
      const columns = (d.columns as Array<{ id: string; title: string; body: string }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          <div className={cn(SECTION_GRID, "md:grid-cols-2 lg:grid-cols-3")}>
            {columns.map((c) => (
              <SectionSurface key={c.id} variant="outlined" className="p-5 sm:p-6">
                <h3 className="text-lg font-semibold text-foreground">{c.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{c.body}</p>
              </SectionSurface>
            ))}
          </div>
        </SectionShell>
      );
    }
    case "benefits": {
      const items = (d.items as Array<{ id: string; text: string }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          <ul className={cn(SECTION_GRID, "sm:grid-cols-2")}>
            {items.map((item, index) => (
              <li key={item.id}>
                <SectionSurface variant="outlined" className="flex h-full gap-3 p-5">
                  <SectionIndex value={String(index + 1).padStart(2, "0")} />
                  <span className="text-foreground/90">{item.text}</span>
                </SectionSurface>
              </li>
            ))}
          </ul>
        </SectionShell>
      );
    }
    case "roadmap": {
      const data = d as unknown as RoadmapBlockData;
      if (!data.milestones.length) {
        return (
          <SectionShell blockType={type}>
            <h2 className={SECTION_TITLE_TIGHT}>{data.title}</h2>
            <p className="text-sm text-white/55">Nog geen mijlpalen toegevoegd.</p>
          </SectionShell>
        );
      }
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{data.title}</SectionTitle>
          <ol className="relative space-y-6 border-l border-border pl-6 sm:pl-8">
            {data.milestones.map((m, i) => (
              <li key={m.id} className="relative">
                <SectionSurface variant="outlined" className="p-5 sm:p-6">
                  <div className="mb-2 flex items-center gap-3">
                    <SectionIndex value={String(i + 1).padStart(2, "0")} />
                    {m.year ? (
                      <SectionEyebrow className="tracking-wider">{m.year}</SectionEyebrow>
                    ) : null}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground break-words">{m.title}</h3>
                  {m.body ? <p className="mt-1 text-muted-foreground break-words">{m.body}</p> : null}
                  {m.bullets.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                      {m.bullets.map((b) => (
                        <li key={b.id} className="break-words">
                          {b.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </SectionSurface>
              </li>
            ))}
          </ol>
        </SectionShell>
      );
    }
    case "timeline": {
      const data = d as unknown as TimelineBlockData;
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{data.title}</SectionTitle>
          <ol className="space-y-4 border-l border-border pl-6">
            {data.milestones.map((m, i) => (
              <li key={m.id}>
                <SectionSurface variant="outlined" className="p-4 sm:p-5">
                  <div className="mb-2 flex items-center gap-3">
                    <SectionIndex value={i + 1} />
                    {m.year ? <SectionEyebrow>{m.year}</SectionEyebrow> : null}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{m.title}</h3>
                  {m.body ? <p className="mt-1 text-muted-foreground">{m.body}</p> : null}
                </SectionSurface>
              </li>
            ))}
          </ol>
        </SectionShell>
      );
    }
    case "plans": {
      const PlansView = blockViewRegistry.plans;
      if (PlansView) {
        return <PlansView data={d} pages={pages} />;
      }
      return null;
    }
    case "featureGrid": {
      const features = (d.features as Array<{ id: string; icon?: string; title: string; body: string }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          {features.length === 0 ? (
            <p className="text-sm text-white/55">Nog geen kenmerken.</p>
          ) : (
            <div className={cn(SECTION_GRID, "sm:grid-cols-2")}>
              {features.map((f) => (
                <SectionSurface key={f.id} variant="outlined" className="p-5 sm:p-6">
                  {f.icon ? (
                    <span className="mb-2 block text-xs uppercase tracking-wider text-primary/80" aria-hidden>
                      {f.icon}
                    </span>
                  ) : null}
                  <h3 className="font-semibold text-foreground break-words">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground break-words">{f.body}</p>
                </SectionSurface>
              ))}
            </div>
          )}
        </SectionShell>
      );
    }
    case "steps": {
      const StepsView = blockViewRegistry.steps;
      if (StepsView) {
        return <StepsView data={d} />;
      }
      return null;
    }
    case "comparisonTable": {
      const columns = (d.columns as string[]) ?? [];
      const rows = (d.rows as Array<{ id: string; feature: string; values: boolean[] }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          <div className="-mx-1 overflow-x-auto px-1 pb-2">
            <table className="w-full min-w-[32rem] border-collapse text-left text-sm text-muted-foreground">
              <thead>
                <tr>
                  <th className="border-b border-border p-3" />
                  {columns.map((c) => (
                    <th key={c} className="border-b border-border p-3 font-semibold text-foreground">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="border-b border-border/60 p-3 text-foreground">{r.feature}</td>
                    {columns.map((_, i) => (
                      <td key={`${r.id}-${i}`} className="border-b border-border/60 p-3">
                        {r.values[i] ? "✓" : "✗"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionShell>
      );
    }
    case "gallery": {
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
    case "video": {
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
    case "beforeAfter":
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
    case "carousel": {
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
    case "spacer": {
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
    case "quote": {
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
    case "teamGrid": {
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
    case "teamProfile": {
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
    case "values": {
      const values = (d.values as Array<{ id: string; title: string; body: string }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          <div className={cn(SECTION_GRID, "md:grid-cols-2")}>
            {values.map((v, i) => (
              <SectionSurface key={v.id} variant="outlined" className="p-5 sm:p-6">
                <div className="mb-3 flex items-center gap-3">
                  <SectionIndex value={String(i + 1).padStart(2, "0")} />
                  <h3 className="font-semibold text-foreground">{v.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground">{v.body}</p>
              </SectionSurface>
            ))}
          </div>
        </SectionShell>
      );
    }
    case "announcement": {
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
    case "portfolio": {
      const projects = (d.projects as Array<{ id: string; title: string; category?: string; image?: CmsImage }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          <div className={cn(SECTION_GRID, "sm:grid-cols-2 lg:grid-cols-3")}>
            {projects.map((p) => (
              <SectionSurface key={p.id} variant="media" className="overflow-hidden">
                <FitImage image={p.image} aspectClass="aspect-video" className="w-full" />
                <div className="p-4">
                  <h3 className="font-semibold text-foreground">{p.title}</h3>
                  {p.category ? <p className="text-xs text-muted-foreground">{p.category}</p> : null}
                </div>
              </SectionSurface>
            ))}
          </div>
        </SectionShell>
      );
    }
    case "jobs": {
      const JobsView = blockViewRegistry.jobs;
      if (JobsView) {
        return (
          <JobsView
            data={d}
            pages={pages}
            mode={adminMode ? "preview" : "storefront"}
            showHidden={adminMode}
          />
        );
      }
      return null;
    }
    case "latestPosts": {
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
    case "newsletter": {
      return (
        <NewsletterSectionView
          data={d}
          blockId={block.id}
          mode={adminMode ? "preview" : "storefront"}
        />
      );
    }
    case "contactForm": {
      return (
        <ContactFormSectionView
          data={d}
          blockId={block.id}
          mode={adminMode ? "preview" : "storefront"}
        />
      );
    }
    case "popup": {
      return (
        <PopupSectionView
          data={d}
          blockId={block.id}
          mode={adminMode ? "preview" : "storefront"}
          pages={pages}
        />
      );
    }
    case "partnersMarquee": {
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
    case "statsCounters": {
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
    case "contactInfoCards": {
      const items =
        (d.items as Array<{
          id: string;
          label: string;
          value: string;
          secondaryValue?: string;
          action?: { kind: string; href: string; label?: string };
        }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionHeader
            title={typeof d.heading === "string" ? d.heading : undefined}
            className="mb-10 sm:mb-12"
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const href = item.action?.href;
              const safe =
                href &&
                (href.startsWith("/") ||
                  href.startsWith("https://") ||
                  href.startsWith("http://") ||
                  href.startsWith("mailto:") ||
                  href.startsWith("tel:"))
                  ? href
                  : null;
              const inner = (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-2 text-lg font-medium text-foreground">{item.value}</p>
                  {item.secondaryValue ? (
                    <p className="mt-1 text-sm text-muted-foreground">{item.secondaryValue}</p>
                  ) : null}
                </>
              );
              return safe ? (
                <a key={item.id} href={safe} className="block transition hover:opacity-95">
                  <SectionSurface variant="outlined" className="h-full p-5 hover:border-primary/35">
                    {inner}
                  </SectionSurface>
                </a>
              ) : (
                <SectionSurface key={item.id} variant="outlined" className="p-5">
                  {inner}
                </SectionSurface>
              );
            })}
          </div>
        </SectionShell>
      );
    }
    case "quoteRequestForm": {
      return (
        <SectionShell blockType={type}>
          <SectionHeader
            title={String(d.heading ?? "Offerte")}
            body={typeof d.description === "string" ? d.description : undefined}
            className="mb-8 sm:mb-10"
          />
          <p className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground">
            Offerteformulier (presentatie) — server bepaalt bron en scope. Knop:{" "}
            {String(d.submitLabel ?? "Verstuur")}
          </p>
        </SectionShell>
      );
    }
    case "legalArticles": {
      const articles =
        (d.articles as Array<{ id: string; heading: string; anchor: string; content: string }>) ??
        [];
      return (
        <SectionShell blockType={type} innerMaxWidth="3xl">
          <h1 className="font-display text-4xl text-foreground">{String(d.heading ?? "")}</h1>
          {typeof d.updatedLabel === "string" && d.updatedAt ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {d.updatedLabel}: {String(d.updatedAt)}
            </p>
          ) : null}
          {articles.length > 1 ? (
            <SectionSurface variant="outlined" className="mt-8 p-4">
              <nav aria-label="Inhoudsopgave">
                <ol className="space-y-2 text-sm">
                  {articles.map((a) => (
                    <li key={a.id}>
                      <a className="text-primary hover:underline" href={`#${a.anchor}`}>
                        {a.heading}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </SectionSurface>
          ) : null}
          <div className="mt-10 space-y-10">
            {articles.map((a) => (
              <SectionSurface key={a.id} variant="outlined" className="p-5 sm:p-6">
                <article id={a.anchor}>
                  <h2 className="font-display text-2xl text-foreground">{a.heading}</h2>
                  <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-muted-foreground">
                    {a.content}
                  </p>
                </article>
              </SectionSurface>
            ))}
          </div>
        </SectionShell>
      );
    }
    case "offers": {
      const OffersView = blockViewRegistry.offers;
      if (OffersView) {
        return <OffersView data={d} />;
      }
      return null;
    }
    default: {
      console.error("[cms-renderer] missing renderer case", type);
      if (adminMode) {
        return (
          <div className="rounded-xl border border-amber-400/40 p-4 text-amber-100" role="alert">
            Geen renderer voor {type}
          </div>
        );
      }
      return null;
    }
  }
}

/** @deprecated Prefer RegisteredBlockView — kept for gradual migration. */
export function CmsBlockView({ type, data }: { type: string; data: Record<string, unknown> }) {
  return (
    <RegisteredBlockView
      block={{ id: "legacy", type: type as BlockType, data }}
      adminMode
    />
  );
}

registerPopupBlockView(RegisteredBlockView);
