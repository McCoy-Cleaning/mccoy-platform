/**
 * Stage 5 family C — extracted from RegisteredBlockView switch.
 * Markup inside each view must remain byte-equivalent to the prior case body.
 */
import * as React from "react";
import {
  createDefaultQuoteItem,
  createItemId,
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
  CmsListAddButton,
  CmsListRemoveButton,
  EditableMedia,
  EditableText,
  useCmsBlockEditScope,
  useCmsEditSurface,
  useCmsTypedListEditor,
} from "../edit-surface";
import {
  cn,
  SectionTitle,
  OptionalImage,
  FitImage,
  CoverFillImage,
  OptionalCta,
  type BlockSectionViewProps,
} from "./blockViewShared";

function MediaAddTileButton({
  field,
  listImageKey = "image",
  label = "Afbeelding toevoegen",
  className,
}: {
  field: string;
  listImageKey?: string;
  label?: string;
  className?: string;
}) {
  const surface = useCmsEditSurface();
  const scope = useCmsBlockEditScope();
  if (!surface?.enabled || !scope || !surface.openMediaPicker) {
    return null;
  }
  return (
    <button
      type="button"
      data-cms-editor-chrome
      className={cn(
        "flex min-h-[12rem] w-full flex-col items-center justify-center gap-2 rounded-[1.35rem] border border-dashed border-sky-400/40 bg-sky-500/5 text-sm font-semibold text-sky-200 hover:border-sky-400/70 hover:bg-sky-500/10",
        className,
      )}
      onClick={() => {
        surface.openMediaPicker?.({
          kind: "block",
          blockId: scope.blockId,
          field,
          listAppend: true,
          listImageKey,
        });
      }}
    >
      {label}
    </button>
  );
}

function VideoMediaKindChrome({
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
      className="mb-4 flex flex-col gap-3 rounded-2xl border border-sky-400/25 bg-sky-500/5 p-3 sm:flex-row sm:items-end"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-200/80">Media-type</p>
        <div className="mt-1.5 flex gap-2" role="radiogroup" aria-label="Media-type">
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

export function GallerySectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  void pages;
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
  /** imagesOnly always matches homepage Werkgalerij (featured mosaic + orientation). */
  const surface = useCmsEditSurface();
  const scope = useCmsBlockEditScope();
  const imagesList = useCmsTypedListEditor<(typeof images)[number]>("images");
  const editing = Boolean(surface?.enabled);
  const mosaicSourceItems = images.map((img) => ({
    id: img.id,
    title: img.title?.trim() || img.image.alt || "McCoy work",
    caption: img.caption,
    body: img.body,
    image: img.image,
    shape: img.shape,
  }));

  if (contentMode === "textAndImage") {
    const columns =
      d.columns === 3 || d.columns === 4 ? d.columns : images.length === 3 ? 3 : 2;
    return (
      <>
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
          onRemoveItem={
            imagesList.editing
              ? (id) => imagesList.removeById(images, id)
              : undefined
          }
        />
        {editing ? (
          <div className="mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
            <MediaAddTileButton field="images" label="Afbeelding toevoegen" />
          </div>
        ) : null}
      </>
    );
  }

  const eyebrow = typeof d.eyebrow === "string" ? d.eyebrow : "";
  const heading = String(d.title ?? "Galerij");
  const body = typeof d.body === "string" ? d.body : "";
  const blockId = scope?.blockId;

  return (
    <WorkMosaicGallery
      eyebrow={eyebrow || undefined}
      heading={heading}
      body={body || undefined}
      items={mosaicSourceItems}
      renderEyebrow={
        editing || eyebrow ? (
          <EditableText path="eyebrow" value={eyebrow}>
            {eyebrow}
          </EditableText>
        ) : undefined
      }
      renderHeading={
        <EditableText path="title" value={heading}>
          {heading}
        </EditableText>
      }
      renderBody={
        editing || body ? (
          <EditableText path="body" value={body} multiline>
            {body}
          </EditableText>
        ) : undefined
      }
      renderFigcaption={
        editing && blockId && surface?.renderGalleryMosaicFigcaption
          ? (item) =>
              surface.renderGalleryMosaicFigcaption!({
                blockId,
                item: mosaicSourceItems.find((g) => g.id === item.id) ?? {
                  ...item,
                  body: undefined,
                },
                items: mosaicSourceItems,
              })
          : undefined
      }
      renderTile={
        editing
          ? ({ item, spanClass, figure }) => {
              const source =
                mosaicSourceItems.find((g) => g.id === item.id) ?? {
                  ...item,
                  body: undefined,
                };
              if (blockId && surface?.renderGalleryMosaicTile) {
                return surface.renderGalleryMosaicTile({
                  blockId,
                  item: source,
                  items: mosaicSourceItems,
                  spanClass,
                  figure,
                });
              }
              return (
                <div className={cn("relative h-full min-h-0 w-full", spanClass)}>
                  <EditableMedia
                    path="images"
                    image={item.image}
                    listItemId={item.id}
                    listImageKey="image"
                    className="h-full min-h-0 w-full"
                  >
                    {figure}
                  </EditableMedia>
                </div>
              );
            }
          : undefined
      }
      renderAfterItems={
        editing ? (
          <MediaAddTileButton
            field="images"
            label="Foto toevoegen"
            className="col-span-2 min-h-[220px] md:col-span-1"
          />
        ) : null
      }
    />
  );
}

export function VideoSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "video" as BlockType;
  const editing = Boolean(useCmsEditSurface()?.enabled);
  const mediaKind = d.mediaKind === "image" ? "image" : "video";
  const embed = resolveSafeVideoEmbed(String(d.videoUrl ?? ""));
  const title = typeof d.title === "string" ? d.title : "";
  const description = typeof d.description === "string" ? d.description : "";
  const poster = d.poster as CmsImage | undefined;
  const image = d.image as CmsImage | undefined;
  const showTitle = Boolean(title.trim()) || editing;
  const showDescription = Boolean(description.trim()) || editing;
  return (
    <SectionShell blockType={type}>
      {showTitle ? (
        <SectionTitle>
          <EditableText path="title" value={title}>
            {title}
          </EditableText>
        </SectionTitle>
      ) : null}
      {showDescription ? (
        <p className="mt-3 max-w-2xl text-muted-foreground whitespace-pre-wrap">
          <EditableText path="description" value={description} multiline>
            {description}
          </EditableText>
        </p>
      ) : null}
      <VideoMediaKindChrome mediaKind={mediaKind} videoUrl={String(d.videoUrl ?? "")} />
      {mediaKind === "image" ? (
        <SectionSurface variant="media">
          <EditableMedia path="image" image={image}>
            <FitImage image={image} aspectClass="aspect-video" className="w-full" />
          </EditableMedia>
        </SectionSurface>
      ) : embed.ok ? (
        <SectionSurface variant="media" className="aspect-video">
          <EditableMedia path="poster" image={poster} emptyPlaceholder={false}>
            <iframe
              title={title || "Video"}
              src={embed.embedUrl}
              className="h-full w-full"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          </EditableMedia>
        </SectionSurface>
      ) : (
        <p className="text-sm text-amber-200">{embed.reason}</p>
      )}
    </SectionShell>
  );
}

export function BeforeAfterSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "beforeAfter" as BlockType;
  const editing = Boolean(useCmsEditSurface()?.enabled);
  const title = typeof d.title === "string" ? d.title : "";
  const before = d.before as CmsImage | undefined;
  const after = d.after as CmsImage | undefined;
  const beforeLabel = typeof d.beforeLabel === "string" ? d.beforeLabel : "Voor";
  const afterLabel = typeof d.afterLabel === "string" ? d.afterLabel : "Na";
  const showTitle = Boolean(title.trim()) || editing;

  return (
    <SectionShell blockType={type}>
      {showTitle ? (
        <SectionTitle>
          <EditableText path="title" value={title}>
            {title}
          </EditableText>
        </SectionTitle>
      ) : null}
      <div className={cn(SECTION_GRID, "md:grid-cols-2")}>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <EditableText path="beforeLabel" value={beforeLabel}>
              {beforeLabel}
            </EditableText>
          </p>
          <SectionSurface variant="media">
            <EditableMedia path="before" image={before}>
              <FitImage image={before} aspectClass="aspect-[4/3]" className="w-full" />
            </EditableMedia>
          </SectionSurface>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <EditableText path="afterLabel" value={afterLabel}>
              {afterLabel}
            </EditableText>
          </p>
          <SectionSurface variant="media">
            <EditableMedia path="after" image={after}>
              <FitImage image={after} aspectClass="aspect-[4/3]" className="w-full" />
            </EditableMedia>
          </SectionSurface>
        </div>
      </div>
    </SectionShell>
  );
}

export function CarouselSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "carousel" as BlockType;
  const slides =
    (d.slides as Array<{ id: string; title: string; body?: string; image?: CmsImage }>) ?? [];
  const list = useCmsTypedListEditor<(typeof slides)[number]>("slides");
  const editing = list.editing;

  return (
    <SectionShell blockType={type}>
      {slides.length === 0 && !editing ? (
        <p className="text-sm text-muted-foreground">Nog geen slides in deze carousel.</p>
      ) : (
        <div
          className="-mx-4 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-4 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:-mx-6 sm:gap-8 sm:px-6 lg:-mx-8 lg:gap-10 lg:px-8"
          role="region"
          aria-label="Carousel"
          tabIndex={0}
        >
          {slides.map((s, index) => (
            <SectionSurface
              key={s.id}
              variant="elevated"
              className="relative w-[min(100%,20rem)] shrink-0 snap-start p-5 transition hover:border-primary/35 focus-within:border-primary/40 sm:w-[22rem] sm:p-6"
            >
              {editing ? (
                <CmsListRemoveButton
                  label={`Slide verwijderen: ${s.title || `slide ${index + 1}`}`}
                  onRemove={() => list.removeById(slides, s.id)}
                />
              ) : null}
              <article>
                <EditableMedia path="slides" image={s.image} listItemId={s.id} listImageKey="image">
                  <FitImage
                    image={s.image}
                    aspectClass="aspect-video"
                    className="mb-4 w-full rounded-2xl"
                  />
                </EditableMedia>
                <h3 className="font-display text-lg font-semibold text-foreground">
                  <EditableText path={`slides.${index}.title`} value={s.title}>
                    {s.title}
                  </EditableText>
                </h3>
                {s.body || editing ? (
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    <EditableText path={`slides.${index}.body`} value={s.body ?? ""} multiline>
                      {s.body ?? ""}
                    </EditableText>
                  </p>
                ) : null}
              </article>
            </SectionSurface>
          ))}
          {editing ? (
            <div className="w-[min(100%,20rem)] shrink-0 snap-start sm:w-[22rem]">
              <MediaAddTileButton field="slides" label="Slide toevoegen" className="h-full min-h-[16rem]" />
            </div>
          ) : null}
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
  const list = useCmsTypedListEditor<{
    id: string;
    quote?: string;
    author?: string;
    role?: string;
    company?: string;
    avatar?: CmsImage;
  }>("items");
  const editing = list.editing;
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

  const canonicalItems = () =>
    items.map((item) =>
      item.id === "legacy" ? { ...item, id: createItemId("quote") } : item,
    );

  const renderCard = (
    item: (typeof items)[number],
    index: number,
    opts: { framed: boolean },
  ) => {
    const author = typeof item.author === "string" ? item.author.trim() : "";
    const role = typeof item.role === "string" ? item.role.trim() : "";
    const company = typeof item.company === "string" ? item.company.trim() : "";
    const quote = String(item.quote ?? "");
    const bylineParts = [role, company].filter(Boolean);
    const body = (
      <div className="space-y-6 text-center">
        <blockquote className="font-display text-2xl text-foreground md:text-3xl">
          &ldquo;
          <EditableText path={`items.${index}.quote`} value={quote} multiline>
            {quote}
          </EditableText>
          &rdquo;
        </blockquote>
        <div className="flex items-center justify-center gap-3">
          <EditableMedia
            path="items"
            image={item.avatar}
            listItemId={item.id}
            listImageKey="avatar"
            emptyPlaceholder={editing}
            className="h-14 w-14 shrink-0 overflow-hidden rounded-full"
          >
            <OptionalImage
              image={item.avatar}
              className="h-14 w-14 shrink-0 rounded-full bg-black/35 object-contain p-0.5 ring-1 ring-white/10"
            />
          </EditableMedia>
          <div className="min-w-0 text-left">
            {author || editing ? (
              <p className="text-sm font-semibold text-foreground">
                <EditableText path={`items.${index}.author`} value={author}>
                  {author}
                </EditableText>
              </p>
            ) : null}
            {bylineParts.length || editing ? (
              <p className="text-xs text-muted-foreground">
                <EditableText path={`items.${index}.role`} value={role}>
                  {role}
                </EditableText>
                {role && company ? " · " : null}
                <EditableText path={`items.${index}.company`} value={company}>
                  {company}
                </EditableText>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    );
    if (!opts.framed) return body;
    return (
      <SectionSurface key={item.id} variant="elevated" className="relative px-6 py-10 sm:px-8">
        {editing ? (
          <CmsListRemoveButton
            label={`Quote verwijderen${author ? `: ${author}` : ""}`}
            onRemove={() => {
              const next = canonicalItems().filter((_, i) => i !== index);
              list.patchList(next);
            }}
          />
        ) : null}
        {body}
      </SectionSurface>
    );
  };

  const addControl = editing ? (
    <CmsListAddButton
      label="Quote toevoegen"
      onAdd={() => list.append(canonicalItems(), createDefaultQuoteItem())}
      className="min-h-[10rem]"
    />
  ) : null;

  if (items.length <= 1) {
    return (
      <SectionShell blockType={type} innerMaxWidth="3xl" className="text-center">
        <div className="mx-auto w-full max-w-3xl space-y-6">
          {renderCard(items[0]!, 0, { framed: true })}
          {addControl}
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
        {items.map((item, index) => renderCard(item, index, { framed: true }))}
        {addControl}
      </div>
    </SectionShell>
  );
}

export function TeamGridSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  void pages;
  const type = "teamGrid" as BlockType;
  const list = useCmsTypedListEditor<{
    id: string;
    name: string;
    role?: string;
    bio?: string;
    photo?: CmsImage;
  }>("members");
  const editing = list.editing;
  const members =
    (d.members as Array<{
      id: string;
      name: string;
      role?: string;
      bio?: string;
      photo?: CmsImage;
    }>) ?? [];
  const title = String(d.title ?? "");
  return (
    <SectionShell blockType={type}>
      <SectionTitle>
        <EditableText path="title" value={title}>
          {title}
        </EditableText>
      </SectionTitle>
      <div
        className={cn(
          SECTION_GRID,
          members.length === 1 && !editing
            ? "mx-auto max-w-sm"
            : members.length === 2 && !editing
              ? "mx-auto max-w-4xl sm:grid-cols-2"
              : "sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {members.map((m, index) => (
          <SectionSurface
            key={m.id}
            variant="elevated"
            className="group relative flex flex-col overflow-hidden transition duration-300 hover:border-primary/35"
          >
            {editing ? (
              <CmsListRemoveButton
                label={`Teamlid verwijderen: ${m.name}`}
                onRemove={() => list.removeById(members, m.id)}
              />
            ) : null}
            <article className="flex h-full flex-col">
              <div className="relative overflow-hidden bg-black/30">
                <EditableMedia
                  path="members"
                  image={m.photo}
                  listItemId={m.id}
                  listImageKey="photo"
                  emptyPlaceholder={editing}
                  className="w-full"
                >
                  <FitImage image={m.photo} aspectClass="aspect-[4/5]" className="w-full" />
                </EditableMedia>
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent"
                  aria-hidden
                />
              </div>
              <div className="flex flex-1 flex-col items-center px-5 pb-6 pt-5 text-center">
                <h3 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-[1.35rem]">
                  <EditableText path={`members.${index}.name`} value={m.name}>
                    {m.name}
                  </EditableText>
                </h3>
                {m.role || editing ? (
                  <p className="mt-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-primary">
                    <EditableText path={`members.${index}.role`} value={m.role ?? ""}>
                      {m.role ?? ""}
                    </EditableText>
                  </p>
                ) : null}
                {m.bio || editing ? (
                  <p className="mt-3 max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
                    <EditableText path={`members.${index}.bio`} value={m.bio ?? ""} multiline>
                      {m.bio ?? ""}
                    </EditableText>
                  </p>
                ) : null}
              </div>
            </article>
          </SectionSurface>
        ))}
        {editing ? (
          <CmsListAddButton
            label="Teamlid toevoegen"
            onAdd={() =>
              list.append(members, {
                id: createItemId("mem"),
                name: "Naam",
                role: "Functie",
                bio: "",
              })
            }
          />
        ) : null}
      </div>
    </SectionShell>
  );
}

export function TeamProfileSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  void pages;
  const type = "teamProfile" as BlockType;
  const editing = Boolean(useCmsEditSurface()?.enabled);
  const nameRaw = String(d.name ?? "");
  const name = nameRaw.trim();
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
          <EditableMedia path="photo" image={photo} emptyPlaceholder={editing} className="w-full">
            {photo ? (
              <FitImage image={photo} aspectClass="aspect-[4/5]" className="w-full" />
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
          </EditableMedia>
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent"
            aria-hidden
          />
        </div>

        <div className="flex min-w-0 flex-col text-center md:text-left">
          {role || editing ? (
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-primary">
              <EditableText path="role" value={typeof d.role === "string" ? d.role : ""}>
                {role}
              </EditableText>
            </p>
          ) : null}
          <h2
            className={cn(
              "font-display text-3xl leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.75rem]",
              role || editing ? "mt-3" : "",
            )}
          >
            <EditableText path="name" value={nameRaw}>
              {name || "Teamlid"}
            </EditableText>
          </h2>
          {bio || editing ? (
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-white/65 sm:text-lg md:mx-0">
              <EditableText path="bio" value={typeof d.bio === "string" ? d.bio : ""} multiline>
                {bio}
              </EditableText>
            </p>
          ) : null}
          {mailto && !editing ? (
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
          {editing ? (
            <p className="mt-8 text-sm font-semibold text-white/90">
              <EditableText path="email" value={typeof d.email === "string" ? d.email : ""}>
                {typeof d.email === "string" ? d.email : ""}
              </EditableText>
            </p>
          ) : null}
        </div>
      </article>
    </SectionShell>
  );
}

export function AnnouncementSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  const type = "announcement" as BlockType;
  const message = String(d.message ?? "");
  const linkLabel = typeof d.linkLabel === "string" ? d.linkLabel : "";
  const href =
    d.link && typeof d.link === "object"
      ? resolveCmsLinkHref(d.link as Parameters<typeof resolveCmsLinkHref>[0], pages)
      : null;
  return (
    <div
      data-cms-block-type={type}
      className="border-b border-primary/30 bg-primary/15 px-4 py-3 text-center text-sm text-white"
    >
      <span>
        <EditableText path="message" value={message} multiline>
          {message}
        </EditableText>
      </span>
      {href && linkLabel ? (
        <a href={href} className="ml-3 font-semibold underline">
          <EditableText path="linkLabel" value={linkLabel}>
            {linkLabel}
          </EditableText>
        </a>
      ) : null}
    </div>
  );
}

export function LatestPostsSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  void pages;
  const type = "latestPosts" as BlockType;
  const list = useCmsTypedListEditor<{
    id: string;
    title: string;
    excerpt?: string;
    date?: string;
    image?: CmsImage;
  }>("posts");
  const editing = list.editing;
  const posts =
    (d.posts as Array<{
      id: string;
      title: string;
      excerpt?: string;
      date?: string;
      image?: CmsImage;
    }>) ?? [];
  const title = String(d.title ?? "");
  return (
    <SectionShell blockType={type}>
      <SectionTitle>
        <EditableText path="title" value={title}>
          {title}
        </EditableText>
      </SectionTitle>
      <div className={cn(SECTION_GRID, "md:grid-cols-2")}>
        {posts.map((p, index) => (
          <SectionSurface key={p.id} variant="outlined" className="relative p-4">
            {editing ? (
              <CmsListRemoveButton
                label={`Artikel verwijderen: ${p.title}`}
                onRemove={() => list.removeById(posts, p.id)}
              />
            ) : null}
            <article>
              <EditableMedia
                path="posts"
                image={p.image}
                listItemId={p.id}
                listImageKey="image"
                emptyPlaceholder={editing}
                className="mb-3 w-full"
              >
                <FitImage
                  image={p.image}
                  aspectClass="aspect-video"
                  className="mb-3 w-full rounded-xl"
                />
              </EditableMedia>
              {p.date || editing ? (
                <p className="text-xs text-muted-foreground">
                  <EditableText path={`posts.${index}.date`} value={p.date ?? ""}>
                    {p.date ?? ""}
                  </EditableText>
                </p>
              ) : null}
              <h3 className="font-semibold text-foreground">
                <EditableText path={`posts.${index}.title`} value={p.title}>
                  {p.title}
                </EditableText>
              </h3>
              {p.excerpt || editing ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  <EditableText path={`posts.${index}.excerpt`} value={p.excerpt ?? ""} multiline>
                    {p.excerpt ?? ""}
                  </EditableText>
                </p>
              ) : null}
            </article>
          </SectionSurface>
        ))}
        {editing ? (
          <CmsListAddButton
            label="Artikel toevoegen"
            onAdd={() =>
              list.append(posts, {
                id: createItemId("post"),
                title: "Nieuw artikel",
                excerpt: "",
                date: "",
              })
            }
          />
        ) : null}
      </div>
    </SectionShell>
  );
}

export function PartnersMarqueeSectionView({ data: d, pages = [] }: BlockSectionViewProps) {
  void pages;
  const type = "partnersMarquee" as BlockType;
  const list = useCmsTypedListEditor<{
    id: string;
    name: string;
    logo?: CmsImage;
    href?: string;
  }>("items");
  const editing = list.editing;
  const items =
    (d.items as Array<{
      id: string;
      name: string;
      logo?: CmsImage;
      href?: string;
    }>) ?? [];
  const animate = d.animate !== false && items.length >= 4;
  const eyebrow = typeof d.eyebrow === "string" ? d.eyebrow : "";
  const heading = typeof d.heading === "string" ? d.heading : "";
  return (
    <SectionShell blockType={type} tone="default">
      <SectionHeader
        eyebrow={
          <EditableText path="eyebrow" value={eyebrow}>
            {eyebrow}
          </EditableText>
        }
        title={
          <EditableText path="heading" value={heading} as="span">
            {heading}
          </EditableText>
        }
        className="mb-10 sm:mb-12"
      />
      <div
        className={cn(
          "grid gap-6",
          items.length <= 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
        )}
      >
        {items.map((item, index) => (
          <SectionSurface
            key={item.id}
            variant="outlined"
            className="relative flex min-h-[5rem] flex-col items-center justify-center gap-2 p-4"
          >
            {editing ? (
              <CmsListRemoveButton
                label={`Partner verwijderen: ${item.name}`}
                onRemove={() => list.removeById(items, item.id)}
              />
            ) : null}
            <EditableMedia
              path="items"
              image={item.logo}
              listItemId={item.id}
              listImageKey="logo"
              emptyPlaceholder={editing}
              className="flex max-h-12 items-center justify-center"
            >
              {item.logo ? (
                <OptionalImage image={item.logo} className="max-h-12 w-auto object-contain" />
              ) : (
                <span className="text-sm text-muted-foreground">{item.name}</span>
              )}
            </EditableMedia>
            {editing ? (
              <p className="text-center text-xs text-muted-foreground">
                <EditableText path={`items.${index}.name`} value={item.name}>
                  {item.name}
                </EditableText>
              </p>
            ) : (
              <span className="sr-only">{item.name}</span>
            )}
          </SectionSurface>
        ))}
        {editing ? (
          <CmsListAddButton
            label="Partner toevoegen"
            onAdd={() =>
              list.append(items, {
                id: createItemId("partner"),
                name: "Partner",
              })
            }
            className="min-h-[5rem]"
          />
        ) : null}
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
  const list = useCmsTypedListEditor<{
    id: string;
    prefix?: string;
    value: string;
    suffix?: string;
    label: string;
    supportingText?: string;
  }>("items");
  const editing = list.editing;
  const items =
    (d.items as Array<{
      id: string;
      prefix?: string;
      value: string;
      suffix?: string;
      label: string;
      supportingText?: string;
    }>) ?? [];
  const eyebrow = typeof d.eyebrow === "string" ? d.eyebrow : "";
  const heading = typeof d.heading === "string" ? d.heading : "";
  const body = typeof d.body === "string" ? d.body : "";
  const showEyebrow = Boolean(eyebrow.trim()) || editing;
  const showBody = Boolean(body.trim()) || editing;
  return (
    <SectionShell blockType={type}>
      {showEyebrow ? (
        <SectionEyebrow>
          <EditableText path="eyebrow" value={eyebrow}>
            {eyebrow}
          </EditableText>
        </SectionEyebrow>
      ) : null}
      <SectionHeader
        title={
          <EditableText path="heading" value={heading} as="span">
            {heading}
          </EditableText>
        }
        body={
          showBody ? (
            <EditableText path="body" value={body} multiline>
              {body}
            </EditableText>
          ) : undefined
        }
        className="mb-10 sm:mb-12"
      />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, index) => (
          <SectionSurface key={item.id} variant="outlined" className="relative p-5 sm:p-6">
            {editing ? (
              <CmsListRemoveButton
                label={`Statistiek verwijderen: ${item.label || item.value}`}
                onRemove={() => list.removeById(items, item.id)}
              />
            ) : null}
            <p className="font-display text-4xl font-semibold text-foreground">
              <EditableText path={`items.${index}.prefix`} value={item.prefix ?? ""}>
                {item.prefix ?? ""}
              </EditableText>
              <EditableText path={`items.${index}.value`} value={item.value}>
                {item.value}
              </EditableText>
              <EditableText path={`items.${index}.suffix`} value={item.suffix ?? ""}>
                {item.suffix ?? ""}
              </EditableText>
            </p>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              <EditableText path={`items.${index}.label`} value={item.label}>
                {item.label}
              </EditableText>
            </p>
            {item.supportingText || editing ? (
              <p className="mt-1 text-xs text-muted-foreground/80">
                <EditableText
                  path={`items.${index}.supportingText`}
                  value={item.supportingText ?? ""}
                  multiline
                >
                  {item.supportingText ?? ""}
                </EditableText>
              </p>
            ) : null}
          </SectionSurface>
        ))}
        {editing ? (
          <CmsListAddButton
            label="Statistiek toevoegen"
            onAdd={() =>
              list.append(items, {
                id: createItemId("stat"),
                value: "0",
                label: "Nieuwe statistiek",
              })
            }
          />
        ) : null}
      </div>
    </SectionShell>
  );
}
