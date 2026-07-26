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
  planFeatureInclusionLabel,
  type PlansBlockData,
  type RoadmapBlockData,
  type TimelineBlockData,
} from "@mccoy/cms-schema";
import { CmsButtonView, CmsImageView, type LinkResolverPages } from "./primitives";
import { WorkMosaicGallery } from "./WorkMosaicGallery";
import { blockViewRegistry } from "./blockViewRegistry";
import {
  ContactFormSectionView,
  NewsletterSectionView,
  PopupSectionView,
} from "./ConversionSectionViews";
import {
  SECTION_GRID,
  SECTION_PAGE_RAIL,
  SECTION_SHELL_Y,
  SECTION_SHELL_Y_HERO,
  SECTION_TITLE,
  SECTION_TITLE_TIGHT,
  sectionInnerAlignRowClass,
  sectionInnerColumnClass,
  type SectionInnerMaxWidth,
} from "../sectionLayout";
import { useContentAlign } from "../contentAlign";

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function SectionShell({
  children,
  className,
  tone = "default",
  blockType,
  innerMaxWidth = "7xl",
  innerClassName,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "muted" | "hero" | "cta";
  blockType: string;
  /** Narrow columns (richText / centered) must live on the inner, not the section. */
  innerMaxWidth?: SectionInnerMaxWidth;
  innerClassName?: string;
}) {
  const contentAlign = useContentAlign();
  const framed =
    tone === "muted"
      ? "rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-12 sm:px-10 sm:py-16"
      : tone === "cta"
        ? "my-4 overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 py-16 sm:px-12 sm:py-24"
        : null;

  return (
    <section
      data-cms-block-type={blockType}
      data-cms-content-align={contentAlign}
      className={cn(
        tone === "hero" ? SECTION_SHELL_Y_HERO : SECTION_SHELL_Y,
        className,
      )}
    >
      <div className={SECTION_PAGE_RAIL} data-cms-section-rail="">
        <div className={sectionInnerAlignRowClass(contentAlign)} data-cms-section-align="">
          <div
            className={cn(sectionInnerColumnClass(innerMaxWidth), innerClassName)}
            data-cms-section-inner=""
          >
            {framed ? <div className={framed}>{children}</div> : children}
          </div>
        </div>
      </div>
    </section>
  );
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
                <span className="inline-flex rounded-full border border-primary/35 bg-primary/10 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                  {d.eyebrow}
                </span>
              ) : null}
              <h1
                data-testid="hero-heading"
                className="font-display text-4xl font-semibold tracking-tight text-white sm:text-5xl"
              >
                {String(d.title ?? "")}
              </h1>
              {typeof d.subtitle === "string" && d.subtitle ? (
                <p
                  className={cn(
                    "max-w-xl text-base leading-relaxed text-white/70 sm:text-lg",
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
            <OptionalImage
              image={image}
              className={cn(
                "aspect-[4/3] w-full rounded-3xl object-cover ring-1 ring-white/10",
                alignCenter && "max-w-3xl",
              )}
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
          <h2 className="font-display text-3xl font-semibold text-white sm:text-4xl">{String(d.title ?? "")}</h2>
          {typeof d.body === "string" && d.body ? (
            <p className="mt-5 whitespace-pre-wrap text-base leading-relaxed text-white/70">{d.body}</p>
          ) : null}
          <div className="mt-8">
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
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white break-words sm:text-4xl">
                {String(d.title ?? "")}
              </h2>
              {typeof d.body === "string" && d.body ? (
                <p className="mt-5 whitespace-pre-wrap text-base leading-relaxed text-white/70 break-words">
                  {d.body}
                </p>
              ) : null}
            </div>
            {image ? (
              <OptionalImage
                image={image}
                className="aspect-[4/3] w-full rounded-3xl object-cover ring-1 ring-white/10"
              />
            ) : (
              <div
                className="flex aspect-[4/3] items-center justify-center rounded-3xl border border-dashed border-white/15 bg-white/[0.02] text-sm text-white/40"
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
              <div key={c.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <h3 className="text-lg font-semibold text-white">{c.title}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">{c.body}</p>
              </div>
            ))}
          </div>
        </SectionShell>
      );
    }
    case "benefits": {
      const items = (d.items as Array<{ id: string; text: string }>) ?? [];
      return (
        <SectionShell blockType={type} tone="muted">
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 text-white/80">
                <span className="text-primary" aria-hidden>
                  ✓
                </span>
                <span>{item.text}</span>
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
          <ol className="relative space-y-8 border-l-2 border-primary/35 pl-6 sm:pl-8">
            {data.milestones.map((m) => (
              <li key={m.id} className="relative">
                <span
                  className="absolute -left-[1.7rem] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-primary bg-[#0b0d12] sm:-left-[2.05rem]"
                  aria-hidden
                />
                {m.year ? (
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">{m.year}</p>
                ) : null}
                <h3 className="text-xl font-semibold text-white break-words">{m.title}</h3>
                {m.body ? <p className="mt-1 text-white/70 break-words">{m.body}</p> : null}
                {m.bullets.length ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-white/75">
                    {m.bullets.map((b) => (
                      <li key={b.id} className="break-words">
                        {b.text}
                      </li>
                    ))}
                  </ul>
                ) : null}
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
          <ol className="space-y-6 border-l border-white/15 pl-6">
            {data.milestones.map((m) => (
              <li key={m.id}>
                {m.year ? <p className="text-xs text-primary">{m.year}</p> : null}
                <h3 className="text-lg font-semibold text-white">{m.title}</h3>
                {m.body ? <p className="text-white/70">{m.body}</p> : null}
              </li>
            ))}
          </ol>
        </SectionShell>
      );
    }
    case "plans": {
      const data = d as unknown as PlansBlockData;
      if (!data.plans.length) {
        return (
          <SectionShell blockType={type}>
            <h2 className={cn(SECTION_TITLE_TIGHT, "text-center")}>{data.title}</h2>
            <p className="text-center text-sm text-white/55">Nog geen plannen toegevoegd.</p>
          </SectionShell>
        );
      }
      return (
        <SectionShell blockType={type}>
          <SectionTitle className="text-center">{data.title}</SectionTitle>
          <div className="-mx-1 overflow-x-auto px-1 pb-2">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm text-white/80">
              <caption className="sr-only">{data.title} — kenmerkenmatrix</caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-[1] bg-[#0b0d12] p-3 font-medium text-white/55">
                    Kenmerk
                  </th>
                  {data.plans.map((plan) => (
                    <th
                      key={plan.id}
                      scope="col"
                      className={cn(
                        "min-w-[9rem] p-3 align-bottom font-semibold text-white",
                        plan.highlighted && "bg-primary/10",
                      )}
                    >
                      <span className="block break-words">{plan.name}</span>
                      {plan.price ? (
                        <span className="mt-1 block text-base font-bold text-primary">{plan.price}</span>
                      ) : null}
                      {plan.description ? (
                        <span className="mt-1 block text-xs font-normal text-white/55 break-words">
                          {plan.description}
                        </span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.features.length === 0 ? (
                  <tr>
                    <td colSpan={data.plans.length + 1} className="p-3 text-white/55">
                      Nog geen kenmerken.
                    </td>
                  </tr>
                ) : (
                  data.features.map((f) => (
                    <tr key={f.id} className="border-t border-white/10">
                      <th
                        scope="row"
                        className="sticky left-0 z-[1] bg-[#0b0d12] p-3 font-medium text-white break-words"
                      >
                        {f.label}
                      </th>
                      {data.plans.map((plan) => {
                        const ok = plan.includedFeatureIds.includes(f.id);
                        const label = planFeatureInclusionLabel(plan.name, f.label, ok);
                        return (
                          <td
                            key={`${plan.id}-${f.id}`}
                            className={cn("p-3 text-center", plan.highlighted && "bg-primary/5")}
                          >
                            <span className="inline-flex items-center justify-center gap-2">
                              <span
                                aria-hidden
                                className={ok ? "text-emerald-400" : "text-white/35"}
                              >
                                {ok ? "✓" : "✗"}
                              </span>
                              <span className="sr-only">{label}</span>
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
              {data.plans.some((p) => p.cta) ? (
                <tfoot>
                  <tr className="border-t border-white/10">
                    <td className="sticky left-0 z-[1] bg-[#0b0d12] p-3" />
                    {data.plans.map((plan) => (
                      <td key={`cta-${plan.id}`} className={cn("p-3", plan.highlighted && "bg-primary/5")}>
                        <OptionalCta
                          cta={plan.cta}
                          pages={pages}
                          className="inline-flex w-full justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
                        />
                      </td>
                    ))}
                  </tr>
                </tfoot>
              ) : null}
            </table>
          </div>
        </SectionShell>
      );
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
                <div key={f.id} className="rounded-2xl border border-white/10 p-5">
                  {f.icon ? (
                    <span className="mb-2 block text-xs uppercase tracking-wider text-primary/80" aria-hidden>
                      {f.icon}
                    </span>
                  ) : null}
                  <h3 className="font-semibold text-white break-words">{f.title}</h3>
                  <p className="mt-2 text-sm text-white/70 break-words">{f.body}</p>
                </div>
              ))}
            </div>
          )}
        </SectionShell>
      );
    }
    case "steps": {
      const steps = (d.steps as Array<{ id: string; title: string; body: string }>) ?? [];
      return (
        <SectionShell blockType={type}>
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          <ol className="space-y-5">
            {steps.map((s, i) => (
              <li key={s.id} className="flex gap-4 rounded-2xl border border-white/10 p-4">
                <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div>
                  <h3 className="font-semibold text-white">{s.title}</h3>
                  <p className="text-sm text-white/70">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </SectionShell>
      );
    }
    case "comparisonTable": {
      const columns = (d.columns as string[]) ?? [];
      const rows = (d.rows as Array<{ id: string; feature: string; values: boolean[] }>) ?? [];
      return (
        <SectionShell blockType={type} className="overflow-x-auto">
          <SectionTitle>{String(d.title ?? "")}</SectionTitle>
          <table className="w-full min-w-[32rem] border-collapse text-left text-sm text-white/80">
            <thead>
              <tr>
                <th className="border-b border-white/10 p-3" />
                {columns.map((c) => (
                  <th key={c} className="border-b border-white/10 p-3 font-semibold text-white">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="border-b border-white/5 p-3">{r.feature}</td>
                  {columns.map((_, i) => (
                    <td key={`${r.id}-${i}`} className="border-b border-white/5 p-3">
                      {r.values[i] ? "✓" : "✗"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
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
        }>) ?? [];
      const layout = d.layout === "masonry" || d.layout === "featured" ? d.layout : "grid";

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
                <div key={img.id} className="mb-6 break-inside-avoid sm:mb-8 lg:mb-10">
                  <OptionalImage
                    image={img.image}
                    className="block w-full rounded-3xl object-cover ring-1 ring-white/10 transition duration-500 hover:ring-white/20"
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
                  className="group relative overflow-hidden rounded-3xl ring-1 ring-white/10 transition duration-500 hover:ring-white/20"
                >
                  <OptionalImage
                    image={img.image}
                    className="aspect-square w-full object-cover transition duration-700 group-hover:scale-105"
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
            <div className="aspect-video overflow-hidden rounded-3xl border border-white/10">
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
            </div>
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
            <OptionalImage
              image={d.before as CmsImage | undefined}
              className="aspect-[4/3] w-full rounded-3xl object-cover ring-1 ring-white/10"
            />
            <OptionalImage
              image={d.after as CmsImage | undefined}
              className="aspect-[4/3] w-full rounded-3xl object-cover ring-1 ring-white/10"
            />
          </div>
        </SectionShell>
      );
    case "carousel": {
      const slides =
        (d.slides as Array<{ id: string; title: string; body?: string; image?: CmsImage }>) ?? [];
      return (
        <SectionShell blockType={type}>
          {slides.length === 0 ? (
            <p className="text-sm text-white/55">Nog geen slides in deze carousel.</p>
          ) : (
            <div
              className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-4 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:-mx-6 sm:gap-8 sm:px-6 lg:-mx-8 lg:gap-10 lg:px-8"
              role="region"
              aria-label="Carousel"
              tabIndex={0}
            >
              {slides.map((s) => (
                <article
                  key={s.id}
                  className="w-[min(100%,20rem)] shrink-0 snap-start rounded-3xl border border-white/10 bg-white/[0.02] p-5 transition hover:border-white/20 focus-within:border-white/25 sm:w-[22rem] sm:p-6"
                >
                  <OptionalImage
                    image={s.image}
                    className="mb-4 aspect-video w-full rounded-2xl object-cover ring-1 ring-white/10"
                  />
                  <h3 className="font-display text-lg font-semibold text-white">{s.title}</h3>
                  {s.body ? <p className="mt-2 text-sm leading-relaxed text-white/70">{s.body}</p> : null}
                </article>
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
            <blockquote className="font-display text-2xl text-white md:text-3xl">
              &ldquo;{String(item.quote ?? "")}&rdquo;
            </blockquote>
            <div className="flex items-center justify-center gap-3">
              <OptionalImage
                image={item.avatar}
                className="h-14 w-14 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0 text-left">
                {author ? <p className="text-sm font-semibold text-white">{author}</p> : null}
                {byline ? <p className="text-xs text-white/50">{byline}</p> : null}
              </div>
            </div>
          </div>
        );
        if (!opts.framed) return body;
        return (
          <div
            key={item.id}
            className="rounded-3xl border border-white/10 bg-white/[0.02] px-6 py-10 sm:px-8"
          >
            {body}
          </div>
        );
      };

      if (items.length <= 1) {
        return (
          <SectionShell blockType={type} tone="muted" innerMaxWidth="3xl" className="text-center">
            <div className="mx-auto w-full max-w-3xl">
              {renderCard(items[0]!, { framed: false })}
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
              <article
                key={m.id}
                className="group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] transition duration-300 hover:border-white/20 hover:bg-white/[0.045]"
              >
                <div className="relative overflow-hidden bg-black/30">
                  <OptionalImage
                    image={m.photo}
                    className="aspect-[4/5] w-full object-cover transition duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                  />
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent"
                    aria-hidden
                  />
                </div>
                <div className="flex flex-1 flex-col items-center px-5 pb-6 pt-5 text-center">
                  <h3 className="font-display text-xl font-semibold tracking-tight text-white sm:text-[1.35rem]">
                    {m.name}
                  </h3>
                  {m.role ? (
                    <p className="mt-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
                      {m.role}
                    </p>
                  ) : null}
                  {m.bio ? (
                    <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-white/60">{m.bio}</p>
                  ) : null}
                </div>
              </article>
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
                <OptionalImage
                  image={photo}
                  className="aspect-[4/5] w-full object-cover"
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
            {values.map((v) => (
              <div key={v.id} className="rounded-2xl border border-white/10 p-5">
                <h3 className="font-semibold text-white">{v.title}</h3>
                <p className="mt-2 text-sm text-white/70">{v.body}</p>
              </div>
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
              <div key={p.id} className="overflow-hidden rounded-2xl border border-white/10">
                <OptionalImage image={p.image} className="aspect-video w-full object-cover" />
                <div className="p-4">
                  <h3 className="font-semibold text-white">{p.title}</h3>
                  {p.category ? <p className="text-xs text-white/50">{p.category}</p> : null}
                </div>
              </div>
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
              <article key={p.id} className="rounded-2xl border border-white/10 p-4">
                <OptionalImage image={p.image} className="mb-3 aspect-video w-full rounded-xl object-cover" />
                {p.date ? <p className="text-xs text-white/45">{p.date}</p> : null}
                <h3 className="font-semibold text-white">{p.title}</h3>
                {p.excerpt ? <p className="mt-1 text-sm text-white/70">{p.excerpt}</p> : null}
              </article>
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
