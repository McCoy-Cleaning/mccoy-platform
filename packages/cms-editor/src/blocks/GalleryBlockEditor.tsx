import * as React from "react";
import {
  createItemId,
  localImage,
  normalizeGalleryColumns,
  normalizeGalleryContentMode,
  normalizeGalleryTextPlacement,
  type BlockEditorPresentation,
  type CmsImage,
  type GalleryBlockData,
  type GalleryColumns,
  type GalleryContentMode,
  type GalleryImageItem,
  type GalleryTextPlacement,
} from "@mccoy/cms-schema";
import { BulkImageAddButton, ImageStripPreview } from "../BulkImageAdd";
import type { CmsImagePickerProps } from "../image-picker-props";
import { blockEnPath, EnDraftFor, NlEnField } from "./en-draft-fields";
import { ObjectListEditor } from "./ObjectListEditor";
import { BlockImageField, EmptyHint, Field, Section, inputClass, selectClass } from "./shared-fields";

export type { GalleryBlockData, GalleryImageItem };

const CONTENT_MODE_OPTIONS: Array<{
  id: GalleryContentMode;
  label: string;
  hint: string;
}> = [
  {
    id: "imagesOnly",
    label: "Alleen afbeeldingen",
    hint: "Mozaïek of raster — optionele tekst blijft bewerkbaar (bijv. overlay)",
  },
  {
    id: "textAndImage",
    label: "Tekst bij afbeeldingen",
    hint: "Lay-out met titel, bijschrift en tekst naast of bij elke foto",
  },
];

const TEXT_PLACEMENT_OPTIONS: Array<{
  id: GalleryTextPlacement;
  label: string;
  hint: string;
}> = [
  { id: "above", label: "Boven", hint: "Meerdere per rij" },
  { id: "below", label: "Onder", hint: "Meerdere per rij" },
  { id: "left", label: "Links", hint: "Één per rij" },
  { id: "right", label: "Rechts", hint: "Één per rij" },
];

function PlacementChoice({
  value,
  onChange,
}: {
  value: GalleryTextPlacement;
  onChange: (next: GalleryTextPlacement) => void;
}) {
  return (
    <Field
      label="Positie van de tekst"
      hint="Boven/onder: raster met meerdere foto’s per rij. Links/rechts: volle rij met foto en tekst naast elkaar."
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Positie van de tekst">
        {TEXT_PLACEMENT_OPTIONS.map((opt) => {
          const selected = value === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(opt.id)}
              className={
                selected
                  ? "rounded-xl border border-sky-400/50 bg-sky-400/15 px-3 py-3 text-left"
                  : "rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left hover:border-white/25"
              }
            >
              <span className="block text-sm font-semibold text-white">{opt.label}</span>
              <span className="mt-0.5 block text-xs text-white/45">{opt.hint}</span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

export function GalleryBlockEditor({
  value,
  onChange,
  presentation = "inspector",
  blockId,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  value: GalleryBlockData;
  onChange: (next: GalleryBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
} & CmsImagePickerProps) {
  const compact = presentation === "inline" || presentation === "compact";
  const [selectedId, setSelectedId] = React.useState<string | null>(value.images[0]?.id ?? null);
  const imageProps: CmsImagePickerProps = {
    projectImages,
    assetBaseUrl,
    uploadToMediaLibrary,
    mediaLibraryItems,
    resolveProjectImage,
  };
  const contentMode = normalizeGalleryContentMode(value.contentMode);
  const textAndImage = contentMode === "textAndImage";
  const textPlacement = normalizeGalleryTextPlacement(value.textPlacement);
  const columns = normalizeGalleryColumns(value.columns);
  const featured = !textAndImage && (value.layout ?? "grid") === "featured";
  const sideBySide = textPlacement === "left" || textPlacement === "right";

  React.useEffect(() => {
    if (selectedId && value.images.some((i) => i.id === selectedId)) return;
    setSelectedId(value.images[0]?.id ?? null);
  }, [value.images, selectedId]);

  const patch = (partial: Partial<GalleryBlockData>) => onChange({ ...value, ...partial });

  const createGalleryItem = (): GalleryImageItem => ({
    id: createItemId("img"),
    title: "Nieuwe foto",
    image: localImage("/images/hero-placeholder.jpg", "Galerijfoto") as CmsImage,
    // Shape only matters for featured mosaic; omit otherwise so classic spans stay possible.
    ...(!textAndImage && !featured ? { shape: "square" as const } : {}),
  });

  return (
    <div className="space-y-6">
      <Section title="Kop">
        {featured || textAndImage ? (
          <NlEnField label="Eyebrow" enPath={blockEnPath(blockId, "eyebrow")}>
            <input
              className={inputClass}
              value={value.eyebrow ?? ""}
              onChange={(e) => patch({ eyebrow: e.target.value })}
            />
          </NlEnField>
        ) : null}
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => patch({ title: e.target.value })}
          />
        </NlEnField>
        {featured || textAndImage ? (
          <NlEnField label="Introductie" enPath={blockEnPath(blockId, "body")} multiline>
            <textarea
              className={`${inputClass} min-h-[3.5rem]`}
              value={value.body ?? ""}
              onChange={(e) => patch({ body: e.target.value })}
            />
          </NlEnField>
        ) : null}
      </Section>

      {!compact ? (
        <Section title="Weergave">
          <Field label="Inhoud">
            <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Inhoudsmodus">
              {CONTENT_MODE_OPTIONS.map((opt) => {
                const selected = contentMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      const nextMode = opt.id;
                      patch({
                        contentMode: nextMode,
                        ...(nextMode === "textAndImage"
                          ? {
                              textPlacement: value.textPlacement ?? "below",
                              columns: value.columns ?? 2,
                            }
                          : {}),
                      });
                    }}
                    className={
                      selected
                        ? "rounded-xl border border-sky-400/50 bg-sky-400/15 px-4 py-3 text-left"
                        : "rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left hover:border-white/25"
                    }
                  >
                    <span className="block text-sm font-semibold text-white">{opt.label}</span>
                    <span className="mt-1 block text-xs leading-snug text-white/45">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
          </Field>

          {textAndImage ? (
            <>
              <PlacementChoice
                value={textPlacement}
                onChange={(next) => patch({ textPlacement: next })}
              />
              {!sideBySide ? (
                <Field label="Kolommen" hint="Aantal foto’s naast elkaar bij tekst boven of onder.">
                  <select
                    className={selectClass}
                    value={columns}
                    onChange={(e) =>
                      patch({ columns: Number(e.target.value) as GalleryColumns })
                    }
                  >
                    <option value={2}>2 kolommen</option>
                    <option value={3}>3 kolommen</option>
                    <option value={4}>4 kolommen</option>
                  </select>
                </Field>
              ) : null}
            </>
          ) : (
            <Field label="Layout">
              <select
                className={selectClass}
                value={value.layout ?? "grid"}
                onChange={(e) => {
                  const layout = e.target.value;
                  patch({
                    layout:
                      layout === "masonry" || layout === "featured" || layout === "grid"
                        ? layout
                        : "grid",
                  });
                }}
              >
                <option value="featured">Werkgalerij (mozaïek)</option>
                <option value="grid">Raster</option>
                <option value="masonry">Masonry</option>
              </select>
            </Field>
          )}
        </Section>
      ) : null}

      <Section title="Afbeeldingen">
        <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
          <p className="text-[13px] font-medium text-white/65">
            In deze sectie ({value.images.length})
          </p>
          <ImageStripPreview
            assetBaseUrl={assetBaseUrl}
            selectedId={selectedId}
            onSelect={setSelectedId}
            emptyLabel="Nog geen afbeeldingen — upload er meerdere tegelijk."
            items={value.images.map((item) => ({
              id: item.id,
              src: item.image.src,
              alt: item.image.alt,
              title: item.title,
            }))}
          />
          <BulkImageAddButton
            label="Meerdere afbeeldingen uploaden"
            profile="photo"
            tags={["gallery", "work"]}
            uploadToMediaLibrary={uploadToMediaLibrary}
            onAdded={(uploaded) => {
              const added = uploaded.map((u) => ({
                id: createItemId("img"),
                title: u.label,
                image: { ...u.image, alt: u.label, decorative: false },
                ...(!textAndImage && !featured ? { shape: "square" as const } : {}),
              }));
              onChange({ ...value, images: [...value.images, ...added] });
              if (added[0]) setSelectedId(added[0].id);
            }}
          />
          {!uploadToMediaLibrary ? (
            <p className="text-xs leading-relaxed text-amber-200/90" role="status">
              Zonder mediabibliotheek-upload worden bestanden niet opgeslagen — open deze editor via
              de admin website-pagina.
            </p>
          ) : null}
        </div>
        {value.images.length === 0 ? (
          <EmptyHint>Nog geen afbeeldingen — voeg er een toe voor de galerij.</EmptyHint>
        ) : null}
        <ObjectListEditor
          items={value.images}
          onChange={(images) => onChange({ ...value, images })}
          createItem={createGalleryItem}
          addLabel="Afbeelding toevoegen"
          renderItem={(item, actions, index) => (
            <div
              className={
                selectedId === item.id
                  ? "space-y-3 rounded-xl ring-1 ring-sky-400/35"
                  : "space-y-3"
              }
            >
              <BlockImageField
                label="Foto"
                value={item.image}
                preferTags={["gallery", "work"]}
                enAltPath={blockEnPath(blockId, `images.${index}.image.alt`)}
                {...imageProps}
                onChange={(image) => {
                  if (!image) return;
                  setSelectedId(item.id);
                  actions.update({ ...item, image });
                }}
              />
              {featured ? (
                <Field label="Vorm (tegel)">
                  <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tegelvorm">
                    {(
                      [
                        { id: "wide", label: "Breed", hint: "2×2 groot" },
                        { id: "square", label: "Vierkant", hint: "1×1" },
                        { id: "tall", label: "Hoog", hint: "2 rijen" },
                      ] as const
                    ).map((opt) => {
                      const selected = item.shape === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => actions.update({ ...item, shape: opt.id })}
                          className={
                            selected
                              ? "rounded-xl border border-sky-400/50 bg-sky-400/15 px-3 py-2.5 text-left"
                              : "rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left hover:border-white/25"
                          }
                        >
                          <span
                            className="mb-2 block w-full rounded-md border border-white/15 bg-white/5"
                            style={{
                              aspectRatio:
                                opt.id === "wide" ? "1/1" : opt.id === "tall" ? "3/4" : "1/1",
                              maxWidth: opt.id === "square" ? "50%" : undefined,
                            }}
                            aria-hidden
                          />
                          <span className="block text-sm font-semibold text-white">{opt.label}</span>
                          <span className="block text-xs text-white/45">{opt.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs leading-snug text-white/45">
                    Geen keuze = klassieke collage-indeling. Breed = 2×2 (zoals Reguliere schoonmaak).
                  </p>
                  {item.shape ? (
                    <button
                      type="button"
                      className="mt-2 text-sm font-medium text-sky-300/90 hover:text-sky-200"
                      onClick={() => {
                        const { shape: _removed, ...rest } = item;
                        actions.update(rest);
                      }}
                    >
                      Herstel klassieke plaatsing
                    </button>
                  ) : null}
                </Field>
              ) : null}
              <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  Tekst bij deze foto (optioneel)
                </p>
                <NlEnField
                  label={featured ? "Titel op foto" : "Titel"}
                  enPath={blockEnPath(blockId, `images.${index}.title`)}
                >
                  <input
                    className={inputClass}
                    value={item.title ?? ""}
                    onChange={(e) => actions.update({ ...item, title: e.target.value })}
                    placeholder="Optioneel"
                  />
                </NlEnField>
                <NlEnField
                  label="Bijschrift"
                  enPath={blockEnPath(blockId, `images.${index}.caption`)}
                >
                  <input
                    className={inputClass}
                    value={item.caption ?? ""}
                    onChange={(e) =>
                      actions.update({ ...item, caption: e.target.value || undefined })
                    }
                    placeholder="Optioneel"
                  />
                </NlEnField>
                <NlEnField
                  label="Tekst"
                  enPath={blockEnPath(blockId, `images.${index}.body`)}
                  multiline
                >
                  <textarea
                    className={`${inputClass} min-h-[4.5rem]`}
                    value={item.body ?? ""}
                    onChange={(e) =>
                      actions.update({ ...item, body: e.target.value || undefined })
                    }
                    placeholder={
                      textAndImage
                        ? "Optioneel — zichtbaar bij ‘Tekst bij afbeeldingen’"
                        : "Optioneel — zichtbaar als overlay bij mozaïek, of bij tekst-lay-out"
                    }
                  />
                </NlEnField>
              </div>
            </div>
          )}
        />
      </Section>
    </div>
  );
}

export type CarouselSlide = {
  id: string;
  title: string;
  body?: string;
  image?: CmsImage;
};

export type CarouselBlockData = {
  slides: CarouselSlide[];
};

export function CarouselBlockEditor({
  value,
  onChange,
  presentation = "inspector",
  blockId,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  value: CarouselBlockData;
  onChange: (next: CarouselBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
} & CmsImagePickerProps) {
  void presentation;
  const imageProps: CmsImagePickerProps = {
    projectImages,
    assetBaseUrl,
    uploadToMediaLibrary,
    mediaLibraryItems,
    resolveProjectImage,
  };
  return (
    <div className="space-y-6">
      <Section title="Slides">
        {value.slides.length === 0 ? (
          <EmptyHint>Nog geen slides — voeg er een toe.</EmptyHint>
        ) : null}
        <ObjectListEditor
          items={value.slides}
          onChange={(slides) => onChange({ ...value, slides })}
          createItem={() => ({
            id: createItemId("slide"),
            title: "Nieuwe slide",
            body: "",
          })}
          addLabel="Slide toevoegen"
          renderItem={(slide, actions, index) => (
            <div className="space-y-3">
              <Field label="Titel">
                <input
                  className={inputClass}
                  value={slide.title}
                  onChange={(e) => actions.update({ ...slide, title: e.target.value })}
                />
              </Field>
              <EnDraftFor
                fieldPath={blockEnPath(blockId, `slides.${index}.title`)}
                label="Titel"
              />
              <NlEnField label="Tekst" enPath={blockEnPath(blockId, `slides.${index}.body`)} multiline>
                <textarea
                  className={`${inputClass} min-h-[3rem]`}
                  value={slide.body ?? ""}
                  onChange={(e) => actions.update({ ...slide, body: e.target.value })}
                />
              </NlEnField>
              <BlockImageField
                label="Afbeelding"
                value={slide.image}
                preferTags={["gallery", "carousel"]}
                enAltPath={blockEnPath(blockId, `slides.${index}.image.alt`)}
                {...imageProps}
                onChange={(image) => actions.update({ ...slide, image: image ?? undefined })}
              />
            </div>
          )}
        />
      </Section>
    </div>
  );
}
