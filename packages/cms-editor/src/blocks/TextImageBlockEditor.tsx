import * as React from "react";
import type { BlockEditorPresentation } from "@mccoy/cms-schema";
import type { CmsImage } from "@mccoy/cms-schema";
import type { CmsImagePickerProps } from "../image-picker-props";
import { blockEnPath, NlEnField } from "./en-draft-fields";
import { BlockImageField, Section, inputClass } from "./shared-fields";

export type TextImageBlockData = {
  title: string;
  body?: string;
  image?: CmsImage;
  reverse?: boolean;
};

export function TextImageBlockEditor({
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
  value: TextImageBlockData;
  onChange: (next: TextImageBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
} & CmsImagePickerProps) {
  const compact = presentation === "inline" || presentation === "compact";
  return (
    <div className="space-y-6">
      <Section title="Tekst">
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
          <input
            className={inputClass}
            value={value.title}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </NlEnField>
        <NlEnField label="Tekst" enPath={blockEnPath(blockId, "body")} multiline>
          <textarea
            className={`${inputClass} min-h-[5rem]`}
            value={value.body ?? ""}
            onChange={(e) => onChange({ ...value, body: e.target.value })}
          />
        </NlEnField>
        <label className="flex items-center gap-2 text-xs text-white/70">
          <input
            type="checkbox"
            checked={value.reverse === true}
            onChange={(e) => onChange({ ...value, reverse: e.target.checked })}
          />
          Afbeelding links (omgekeerde layout)
        </label>
      </Section>
      {!compact ? (
        <Section title="Afbeelding">
          <BlockImageField
            label="Sectie-afbeelding"
            value={value.image}
            preferTags={["cms"]}
            enAltPath={blockEnPath(blockId, "image.alt")}
            projectImages={projectImages}
            assetBaseUrl={assetBaseUrl}
            uploadToMediaLibrary={uploadToMediaLibrary}
            mediaLibraryItems={mediaLibraryItems}
            resolveProjectImage={resolveProjectImage}
            onChange={(image) => onChange({ ...value, image })}
          />
        </Section>
      ) : null}
    </div>
  );
}
