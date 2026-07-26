import * as React from "react";
import {
  createItemId,
  localImage,
  type BlockEditorPresentation,
  type CmsImage,
  type GalleryBlockData,
  type GalleryImageItem,
} from "@mccoy/cms-schema";
import { BulkImageAddButton, ImageStripPreview } from "../BulkImageAdd";
import type { CmsImagePickerProps } from "../image-picker-props";
import { blockEnPath, EnDraftFor, NlEnField } from "./en-draft-fields";
import { ObjectListEditor } from "./ObjectListEditor";
import { BlockImageField, EmptyHint, Field, Section, inputClass, selectClass } from "./shared-fields";

export type { GalleryBlockData, GalleryImageItem };

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
  const featured = (value.layout ?? "grid") === "featured";

  React.useEffect(() => {
    if (selectedId && value.images.some((i) => i.id === selectedId)) return;
    setSelectedId(value.images[0]?.id ?? null);
  }, [value.images, selectedId]);

  return (
    <div className="space-y-6">
      <Section title="Kop">
        {featured ? (
          <NlEnField label="Eyebrow" enPath={blockEnPath(blockId, "eyebrow")}>
            <input
              className={inputClass}
              value={value.eyebrow ?? ""}
              onChange={(e) => onChange({ ...value, eyebrow: e.target.value })}
            />
          </NlEnField>
        ) : null}
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </NlEnField>
        {featured ? (
          <NlEnField label="Tekst" enPath={blockEnPath(blockId, "body")} multiline>
            <textarea
              className={`${inputClass} min-h-[3.5rem]`}
              value={value.body ?? ""}
              onChange={(e) => onChange({ ...value, body: e.target.value })}
            />
          </NlEnField>
        ) : null}
        {!compact ? (
          <Field label="Layout">
            <select
              className={selectClass}
              value={value.layout ?? "grid"}
              onChange={(e) => {
                const layout = e.target.value;
                onChange({
                  ...value,
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
        ) : null}
      </Section>
      <Section title="Afbeeldingen">
        <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
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
              }));
              onChange({ ...value, images: [...value.images, ...added] });
              if (added[0]) setSelectedId(added[0].id);
            }}
          />
          {!uploadToMediaLibrary ? (
            <p className="text-[11px] text-amber-200/90" role="status">
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
          createItem={() => ({
            id: createItemId("img"),
            title: "Nieuwe foto",
            image: localImage("/images/hero-placeholder.jpg", "Galerijfoto") as CmsImage,
          })}
          addLabel="Afbeelding toevoegen"
          renderItem={(item, actions, index) => (
            <div
              className={
                selectedId === item.id
                  ? "space-y-3 rounded-lg ring-1 ring-sky-400/35"
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
                <>
                  <Field label="Titel op foto">
                    <input
                      className={inputClass}
                      value={item.title ?? ""}
                      onChange={(e) => actions.update({ ...item, title: e.target.value })}
                    />
                  </Field>
                  <EnDraftFor
                    fieldPath={blockEnPath(blockId, `images.${index}.title`)}
                    label="Titel op foto"
                  />
                  <Field label="Bijschrift (optioneel)">
                    <input
                      className={inputClass}
                      value={item.caption ?? ""}
                      onChange={(e) =>
                        actions.update({ ...item, caption: e.target.value || undefined })
                      }
                    />
                  </Field>
                  <EnDraftFor
                    fieldPath={blockEnPath(blockId, `images.${index}.caption`)}
                    label="Bijschrift"
                  />
                </>
              ) : null}
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
