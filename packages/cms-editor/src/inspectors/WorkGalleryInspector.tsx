import * as React from "react";
import { createItemId, type WorkGalleryContent } from "@mccoy/cms-schema";
import { cn } from "@mccoy/ui";
import {
  InspectTextField,
  ManualEnDraftField,
  SectionAiToolbar,
  collectShallowStringFields,
} from "../ai-assist";
import { BulkImageAddButton, ImageStripPreview } from "../BulkImageAdd";
import { PrototypeImageField } from "../PrototypeImageField";
import type { ImagePickerProps } from "../inspector-types";
import { Field, inputClass, addBtnClass, listItemClass } from "../inspector-chrome";
import { RemoveIconButton, removeById } from "../list-helpers";
import { PLACEHOLDER_IMAGE } from "../placeholder-image";

export function WorkGalleryInspector({
  content,
  onPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  content: WorkGalleryContent;
  onPatch: (patch: Partial<WorkGalleryContent>) => void;
} & ImagePickerProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(content.items[0]?.id ?? null);
  const itemRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());

  React.useEffect(() => {
    if (selectedId && content.items.some((i) => i.id === selectedId)) return;
    setSelectedId(content.items[0]?.id ?? null);
  }, [content.items, selectedId]);

  const selectItem = (id: string) => {
    setSelectedId(id);
    itemRefs.current.get(id)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  return (
    <div className="space-y-3">
      <SectionAiToolbar
        pathPrefix="section:home.workGallery"
        fields={collectShallowStringFields(
          content as unknown as Record<string, unknown>,
          ["eyebrow", "heading", "body"],
          { includeEmpty: true },
        )}
        fieldLabels={{ eyebrow: "Eyebrow", heading: "Kop", body: "Tekst" }}
        onApplyDutch={(nl) => {
          const patch: Partial<WorkGalleryContent> = {};
          if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
          if (typeof nl.heading === "string") patch.heading = nl.heading;
          if (typeof nl.body === "string") patch.body = nl.body;
          onPatch(patch);
        }}
      />
      <InspectTextField
        label="Eyebrow"
        value={content.eyebrow ?? ""}
        onChange={(v) => onPatch({ eyebrow: v })}
        fieldPath="section:home.workGallery:eyebrow"
        fieldHint="eyebrow"
        maxChars={80}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Kop"
        value={content.heading}
        onChange={(v) => onPatch({ heading: v })}
        fieldPath="section:home.workGallery:heading"
        fieldHint="heading"
        maxChars={120}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Tekst"
        value={content.body ?? ""}
        onChange={(v) => onPatch({ body: v })}
        fieldPath="section:home.workGallery:body"
        fieldHint="body"
        multiline
        maxChars={600}
        enableAi={false}
        showEnDraft={false}
      />

      <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-white/55">
          Foto&apos;s in sectie ({content.items.length})
        </p>
        <ImageStripPreview
          assetBaseUrl={assetBaseUrl}
          selectedId={selectedId}
          onSelect={selectItem}
          emptyLabel="Nog geen foto's — upload er hieronder meerdere tegelijk."
          items={content.items.map((item) => ({
            id: item.id,
            src: item.image.src,
            alt: item.image.alt,
            title: item.title,
          }))}
        />
        <BulkImageAddButton
          label="Meerdere foto's uploaden"
          profile="photo"
          tags={["gallery", "work"]}
          uploadToMediaLibrary={uploadToMediaLibrary}
          onAdded={(uploaded) => {
            const added = uploaded.map((u) => ({
              id: createItemId("gallery"),
              title: u.label,
              image: { ...u.image, alt: u.label, decorative: false },
            }));
            onPatch({ items: [...content.items, ...added] });
            if (added[0]) setSelectedId(added[0].id);
          }}
        />
      </div>

      <p className="text-[11px] font-medium text-white/50">Bewerken ({content.items.length})</p>
      {content.items.map((item, index) => (
        <div
          key={item.id}
          ref={(node) => {
            if (node) itemRefs.current.set(item.id, node);
            else itemRefs.current.delete(item.id);
          }}
          className={cn(
            listItemClass,
            selectedId === item.id && "border-sky-400/40 ring-1 ring-sky-400/25",
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="text-[11px] text-white/40 hover:text-white/70"
              onClick={() => selectItem(item.id)}
            >
              #{index + 1}
            </button>
            <RemoveIconButton
              label={`Foto ${index + 1} verwijderen`}
              onClick={() => onPatch({ items: removeById(content.items, item.id) })}
            />
          </div>
          <PrototypeImageField
            label={`Foto — ${item.title || `#${index + 1}`}`}
            compact
            value={item.image}
            projectImages={projectImages}
            assetBaseUrl={assetBaseUrl}
            uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
            preferTags={["gallery", "work"]}
            onChange={(image) =>
              onPatch({
                items: content.items.map((g) => (g.id === item.id ? { ...g, image } : g)),
              })
            }
          />
          <Field label="Vorm (tegel)">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tegelvorm">
              {(
                [
                  { id: "wide" as const, label: "Breed", hint: "2×2 groot" },
                  { id: "square" as const, label: "Vierkant", hint: "1×1" },
                  { id: "tall" as const, label: "Hoog", hint: "2 rijen" },
                ] as const
              ).map((opt) => {
                const selected = item.shape === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() =>
                      onPatch({
                        items: content.items.map((g) =>
                          g.id === item.id ? { ...g, shape: opt.id } : g,
                        ),
                      })
                    }
                    className={
                      selected
                        ? "rounded-xl border border-sky-400/50 bg-sky-400/15 px-2 py-2 text-left"
                        : "rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2 text-left hover:border-white/25"
                    }
                  >
                    <span
                      className="mb-1.5 block w-full rounded-md border border-white/15 bg-white/5"
                      style={{
                        aspectRatio:
                          opt.id === "wide" ? "1/1" : opt.id === "tall" ? "3/4" : "1/1",
                        maxWidth: opt.id === "square" ? "50%" : undefined,
                      }}
                      aria-hidden
                    />
                    <span className="block text-xs font-semibold text-white">{opt.label}</span>
                    <span className="block text-[10px] text-white/45">{opt.hint}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-white/45">
              Laat leeg voor de klassieke collage-indeling. Kies een vorm om deze tegel zelf te
              plaatsen. Breed = zelfde grootte als Reguliere schoonmaak (2×2).
            </p>
            {item.shape ? (
              <button
                type="button"
                className="mt-1.5 text-[11px] font-medium text-sky-300/90 hover:text-sky-200"
                onClick={() =>
                  onPatch({
                    items: content.items.map((g) => {
                      if (g.id !== item.id) return g;
                      const { shape: _shape, ...rest } = g;
                      return rest;
                    }),
                  })
                }
              >
                Herstel klassieke plaatsing
              </button>
            ) : null}
          </Field>
          <Field label="Titel">
            <input
              className={inputClass}
              value={item.title}
              onChange={(e) =>
                onPatch({
                  items: content.items.map((g) => (g.id === item.id ? { ...g, title: e.target.value } : g)),
                })
              }
            />
          </Field>
          <ManualEnDraftField
            fieldPath={`section:home.workGallery:items.${index}.title`}
            label="Titel"
          />
          <Field label="Bijschrift">
            <input
              className={inputClass}
              value={item.caption ?? ""}
              onChange={(e) =>
                onPatch({
                  items: content.items.map((g) => (g.id === item.id ? { ...g, caption: e.target.value } : g)),
                })
              }
            />
          </Field>
          <ManualEnDraftField
            fieldPath={`section:home.workGallery:items.${index}.caption`}
            label="Bijschrift"
          />
        </div>
      ))}
      <button
        type="button"
        className={addBtnClass}
        onClick={() => {
          const id = createItemId("gallery");
          onPatch({
            items: [
              ...content.items,
              {
                id,
                title: "Nieuwe foto",
                image: PLACEHOLDER_IMAGE,
              },
            ],
          });
          setSelectedId(id);
        }}
      >
        Lege foto toevoegen
      </button>
    </div>
  );
}
