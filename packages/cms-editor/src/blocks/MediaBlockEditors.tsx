import * as React from "react";
import type {
  BeforeAfterBlockData,
  BlockEditorPresentation,
  VideoBlockData,
} from "@mccoy/cms-schema";
import { resolveSafeVideoEmbed } from "@mccoy/cms-schema";
import type { CmsImagePickerProps } from "../image-picker-props";
import { blockEnPath, NlEnField } from "./en-draft-fields";
import { BlockImageField, Field, Section, inputClass } from "./shared-fields";

export function VideoBlockEditor({
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
  value: VideoBlockData;
  onChange: (next: VideoBlockData) => void;
  presentation?: BlockEditorPresentation;
  blockId?: string;
} & CmsImagePickerProps) {
  void presentation;
  const embed = resolveSafeVideoEmbed(value.videoUrl ?? "");
  const imageProps: CmsImagePickerProps = {
    projectImages,
    assetBaseUrl,
    uploadToMediaLibrary,
    mediaLibraryItems,
    resolveProjectImage,
  };
  return (
    <div className="space-y-6">
      <Section title="Video">
        <NlEnField
          label="Titel"
          enPath={blockEnPath(blockId, "title")}
          hint={!value.title?.trim() ? "Titel is verplicht voor publicatie" : undefined}
        >
          <input
            className={inputClass}
            value={value.title ?? ""}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </NlEnField>
        <NlEnField label="Beschrijving" enPath={blockEnPath(blockId, "description")} multiline>
          <textarea
            className={`${inputClass} min-h-[3rem]`}
            value={value.description ?? ""}
            onChange={(e) => onChange({ ...value, description: e.target.value })}
          />
        </NlEnField>
        <Field
          label="Video-URL"
          hint={
            embed.ok
              ? `Embed: ${embed.provider}`
              : embed.reason || "Alleen YouTube, Vimeo, Facebook of McCoy-host"
          }
        >
          <input
            className={inputClass}
            value={value.videoUrl}
            onChange={(e) => onChange({ ...value, videoUrl: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </Field>
      </Section>
      <Section title="Poster (optioneel)">
        <BlockImageField
          label="Posterafbeelding"
          value={value.poster}
          preferTags={["cms", "video"]}
          enAltPath={blockEnPath(blockId, "poster.alt")}
          {...imageProps}
          onChange={(poster) => onChange({ ...value, poster })}
        />
      </Section>
    </div>
  );
}

export function BeforeAfterBlockEditor({
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
  value: BeforeAfterBlockData;
  onChange: (next: BeforeAfterBlockData) => void;
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
      <Section title="Kop">
        <NlEnField label="Titel" enPath={blockEnPath(blockId, "title")}>
          <input
            className={inputClass}
            value={value.title ?? ""}
            onChange={(e) => onChange({ ...value, title: e.target.value })}
          />
        </NlEnField>
      </Section>
      <Section title="Voor">
        <NlEnField label="Label" enPath={blockEnPath(blockId, "beforeLabel")}>
          <input
            className={inputClass}
            value={value.beforeLabel ?? ""}
            onChange={(e) => onChange({ ...value, beforeLabel: e.target.value })}
          />
        </NlEnField>
        <BlockImageField
          label="Voor-afbeelding"
          value={value.before}
          preferTags={["cms", "before-after"]}
          enAltPath={blockEnPath(blockId, "before.alt")}
          {...imageProps}
          onChange={(before) => onChange({ ...value, before })}
        />
      </Section>
      <Section title="Na">
        <NlEnField label="Label" enPath={blockEnPath(blockId, "afterLabel")}>
          <input
            className={inputClass}
            value={value.afterLabel ?? ""}
            onChange={(e) => onChange({ ...value, afterLabel: e.target.value })}
          />
        </NlEnField>
        <BlockImageField
          label="Na-afbeelding"
          value={value.after}
          preferTags={["cms", "before-after"]}
          enAltPath={blockEnPath(blockId, "after.alt")}
          {...imageProps}
          onChange={(after) => onChange({ ...value, after })}
        />
      </Section>
    </div>
  );
}
