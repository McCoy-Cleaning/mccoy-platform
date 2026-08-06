import * as React from "react";
import type { FormPageChromeContent } from "@mccoy/cms-schema";
import {
  InspectTextField,
  SectionAiToolbar,
  collectShallowStringFields,
} from "../ai-assist";
import { PrototypeImageField } from "../PrototypeImageField";
import type { ImagePickerProps } from "../inspector-types";
import { Field, addBtnClass } from "../inspector-chrome";
import { PLACEHOLDER_IMAGE } from "../placeholder-image";

export function FormChromeInspector({
  content,
  onPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
  sectionKey = "form.chrome",
}: {
  content: FormPageChromeContent;
  onPatch: (patch: Partial<{ [K in keyof FormPageChromeContent]: FormPageChromeContent[K] | null }>) => void;
  sectionKey?: string;
} & ImagePickerProps) {
  const prefix = `section:${sectionKey}`;
  return (
    <div className="space-y-3">
      <SectionAiToolbar
        pathPrefix={prefix}
        fields={collectShallowStringFields(
          content as unknown as Record<string, unknown>,
          ["eyebrow", "heading", "body"],
          { includeEmpty: true },
        )}
        fieldLabels={{ eyebrow: "Eyebrow", heading: "Kop", body: "Tekst" }}
        onApplyDutch={(nl) => {
          const patch: Partial<{ [K in keyof FormPageChromeContent]: FormPageChromeContent[K] | null }> = {};
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
        fieldPath={`${prefix}:eyebrow`}
        fieldHint="eyebrow"
        maxChars={80}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Kop"
        value={content.heading}
        onChange={(v) => onPatch({ heading: v })}
        fieldPath={`${prefix}:heading`}
        fieldHint="heading"
        maxChars={120}
        enableAi={false}
        showEnDraft={false}
      />
      <InspectTextField
        label="Tekst"
        value={content.body ?? ""}
        onChange={(v) => onPatch({ body: v })}
        fieldPath={`${prefix}:body`}
        fieldHint="body"
        multiline
        maxChars={600}
        enableAi={false}
        showEnDraft={false}
      />
      <Field label="Afbeelding (optioneel)">
        {content.image ? (
          <div className="space-y-2">
            <PrototypeImageField
              label="Sectie-afbeelding"
              value={content.image}
              projectImages={projectImages}
              assetBaseUrl={assetBaseUrl}
              uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
              preferTags={["form", "about"]}
              onChange={(image) => onPatch({ image })}
              onClear={() => onPatch({ image: null })}
            />
          </div>
        ) : (
          <button type="button" className={addBtnClass} onClick={() => onPatch({ image: PLACEHOLDER_IMAGE })}>
            Foto toevoegen
          </button>
        )}
      </Field>
    </div>
  );
}
