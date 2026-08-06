import * as React from "react";
import type { AboutMainContent } from "@mccoy/cms-schema";
import {
  InspectTextField,
  SectionAiToolbar,
  collectShallowStringFields,
} from "../ai-assist";
import { PrototypeImageField } from "../PrototypeImageField";
import type { ImagePickerProps } from "../inspector-types";
import { addBtnClass } from "../inspector-chrome";
import { PLACEHOLDER_IMAGE } from "../placeholder-image";

export function AboutMainInspector({
  content,
  onPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
  part,
}: {
  content: AboutMainContent;
  onPatch: (patch: Partial<{ [K in keyof AboutMainContent]: AboutMainContent[K] | null }>) => void;
  /** When set, only that visual part’s fields are shown (Secties per-part rows). */
  part?: string;
} & ImagePickerProps) {
  const show = (id: string) => !part || part === id;
  const aiKeys = (
    [
      ...(show("header") ? (["eyebrow", "heading"] as const) : []),
      ...(show("mission") ? (["missionTitle", "missionBody"] as const) : []),
      ...(show("vision") ? (["visionTitle", "visionBody"] as const) : []),
      ...(show("history") ? (["historyTitle", "historyBody"] as const) : []),
    ] as const
  ).slice();

  return (
    <div className="space-y-3">
      {show("header") ? (
        <>
          <InspectTextField
            label="Eyebrow"
            value={content.eyebrow ?? ""}
            onChange={(v) => onPatch({ eyebrow: v })}
            fieldPath="section:about.main:eyebrow"
            fieldHint="eyebrow"
            maxChars={80}
            enableAi={false}
            showEnDraft={false}
          />
          <InspectTextField
            label="Kop"
            value={content.heading}
            onChange={(v) => onPatch({ heading: v })}
            fieldPath="section:about.main:heading"
            fieldHint="heading"
            maxChars={120}
            enableAi={false}
            showEnDraft={false}
          />
        </>
      ) : null}

      {show("mission") ? (
        <>
          <InspectTextField
            label="Missie — titel"
            value={content.missionTitle ?? ""}
            onChange={(v) => onPatch({ missionTitle: v })}
            fieldPath="section:about.main:missionTitle"
            fieldHint="missionTitle"
            maxChars={80}
            enableAi={false}
            showEnDraft={false}
          />
          <InspectTextField
            label="Missie — tekst"
            value={content.missionBody ?? ""}
            onChange={(v) => onPatch({ missionBody: v })}
            fieldPath="section:about.main:missionBody"
            fieldHint="missionBody"
            multiline
            maxChars={1200}
            enableAi={false}
            showEnDraft={false}
          />
          {content.missionImage || content.image ? (
            <PrototypeImageField
              label="Missie — afbeelding"
              value={content.missionImage ?? content.image ?? PLACEHOLDER_IMAGE}
              projectImages={projectImages}
              assetBaseUrl={assetBaseUrl}
              uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
              preferTags={["about"]}
              onChange={(missionImage) => onPatch({ missionImage, image: missionImage })}
              onClear={() => onPatch({ missionImage: null, image: null })}
            />
          ) : (
            <button
              type="button"
              className={addBtnClass}
              onClick={() => onPatch({ missionImage: PLACEHOLDER_IMAGE, image: PLACEHOLDER_IMAGE })}
            >
              Foto toevoegen (missie)
            </button>
          )}
        </>
      ) : null}

      {show("vision") ? (
        <>
          <InspectTextField
            label="Visie — titel"
            value={content.visionTitle ?? ""}
            onChange={(v) => onPatch({ visionTitle: v })}
            fieldPath="section:about.main:visionTitle"
            fieldHint="visionTitle"
            maxChars={80}
            enableAi={false}
            showEnDraft={false}
          />
          <InspectTextField
            label="Visie — tekst"
            value={content.visionBody ?? ""}
            onChange={(v) => onPatch({ visionBody: v })}
            fieldPath="section:about.main:visionBody"
            fieldHint="visionBody"
            multiline
            maxChars={1200}
            enableAi={false}
            showEnDraft={false}
          />
          {content.visionImage ? (
            <PrototypeImageField
              label="Visie — afbeelding"
              value={content.visionImage}
              projectImages={projectImages}
              assetBaseUrl={assetBaseUrl}
              uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
              preferTags={["about"]}
              onChange={(visionImage) => onPatch({ visionImage })}
              onClear={() => onPatch({ visionImage: null })}
            />
          ) : (
            <button type="button" className={addBtnClass} onClick={() => onPatch({ visionImage: PLACEHOLDER_IMAGE })}>
              Foto toevoegen (visie)
            </button>
          )}
        </>
      ) : null}

      {show("history") ? (
        <>
          <InspectTextField
            label="Historie — titel"
            value={content.historyTitle ?? ""}
            onChange={(v) => onPatch({ historyTitle: v })}
            fieldPath="section:about.main:historyTitle"
            fieldHint="historyTitle"
            maxChars={80}
            enableAi={false}
            showEnDraft={false}
          />
          <InspectTextField
            label="Historie — tekst"
            value={content.historyBody ?? ""}
            onChange={(v) => onPatch({ historyBody: v })}
            fieldPath="section:about.main:historyBody"
            fieldHint="historyBody"
            multiline
            maxChars={1200}
            enableAi={false}
            showEnDraft={false}
          />
          {content.historyImage ? (
            <PrototypeImageField
              label="Historie — afbeelding"
              value={content.historyImage}
              projectImages={projectImages}
              assetBaseUrl={assetBaseUrl}
              uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
              preferTags={["about"]}
              onChange={(historyImage) => onPatch({ historyImage })}
              onClear={() => onPatch({ historyImage: null })}
            />
          ) : (
            <button type="button" className={addBtnClass} onClick={() => onPatch({ historyImage: PLACEHOLDER_IMAGE })}>
              Foto toevoegen (historie)
            </button>
          )}
        </>
      ) : null}

      {aiKeys.length > 0 ? (
        <SectionAiToolbar
          pathPrefix="section:about.main"
          fields={collectShallowStringFields(content as unknown as Record<string, unknown>, [...aiKeys], {
            includeEmpty: true,
          })}
          fieldLabels={{
            eyebrow: "Eyebrow",
            heading: "Kop",
            missionTitle: "Missie — titel",
            missionBody: "Missie — tekst",
            visionTitle: "Visie — titel",
            visionBody: "Visie — tekst",
            historyTitle: "Historie — titel",
            historyBody: "Historie — tekst",
          }}
          onApplyDutch={(nl) => {
            const patch: Partial<{ [K in keyof AboutMainContent]: AboutMainContent[K] | null }> = {};
            for (const key of aiKeys) {
              if (typeof nl[key] === "string") patch[key] = nl[key];
            }
            onPatch(patch);
          }}
        />
      ) : null}
    </div>
  );
}
