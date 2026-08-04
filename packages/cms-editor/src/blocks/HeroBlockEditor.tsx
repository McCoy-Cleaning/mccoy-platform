import * as React from "react";
import type { BlockEditorPresentation, HeroBlockData } from "@mccoy/cms-schema";
import type { CmsImagePickerProps } from "../image-picker-props";
import { blockEnPath, NlEnField } from "./en-draft-fields";
import { BlockImageField, CmsButtonEditor, Field, Section, inputClass, selectClass } from "./shared-fields";

export function HeroBlockEditor({
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
  value: HeroBlockData;
  onChange: (next: HeroBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
} & CmsImagePickerProps) {
  const compact = presentation === "inline" || presentation === "compact";
  return (
    <div className="space-y-6">
      <Section title="Koptekst">
        <NlEnField label="Eyebrow" enPath={blockEnPath(blockId, "eyebrow")}>
          <input
            className={inputClass}
            value={value.eyebrow ?? ""}
            onChange={(e) => onChange({ ...value, eyebrow: e.target.value })}
          />
        </NlEnField>
        <NlEnField
          label="Titel"
          enPath={blockEnPath(blockId, "title")}
          hint={!value.title.trim() ? "Titel is verplicht voor publicatie" : undefined}
        >
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </NlEnField>
        <NlEnField label="Ondertitel" enPath={blockEnPath(blockId, "subtitle")} multiline>
          <textarea
            className={`${inputClass} min-h-[4rem]`}
            value={value.subtitle ?? ""}
            onChange={(e) => onChange({ ...value, subtitle: e.target.value })}
          />
        </NlEnField>
        {!compact ? (
          <Field label="Uitlijning">
            <select
              className={selectClass}
              value={value.align ?? "left"}
              onChange={(e) =>
                onChange({ ...value, align: e.target.value === "center" ? "center" : "left" })
              }
            >
              <option value="left">Links</option>
              <option value="center">Gecentreerd</option>
            </select>
          </Field>
        ) : null}
      </Section>
      {!compact ? (
        <>
          <CmsButtonEditor
            label="Call-to-action"
            value={value.cta}
            enLabelPath={blockEnPath(blockId, "cta.label")}
            onChange={(cta) => onChange({ ...value, cta })}
            blockId={blockId}
            projectImages={projectImages}
            assetBaseUrl={assetBaseUrl}
            uploadToMediaLibrary={uploadToMediaLibrary}
            mediaLibraryItems={mediaLibraryItems}
            resolveProjectImage={resolveProjectImage}
          />
          <Section title="Afbeelding">
            <BlockImageField
              label="Hero-afbeelding"
              value={value.image}
              preferTags={["hero"]}
              enAltPath={blockEnPath(blockId, "image.alt")}
              projectImages={projectImages}
              assetBaseUrl={assetBaseUrl}
              uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
              onChange={(image) => onChange({ ...value, image })}
            />
          </Section>
        </>
      ) : null}
    </div>
  );
}
