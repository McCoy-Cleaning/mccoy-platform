import * as React from "react";
import type { ServiceCard, ServicesMainContent } from "@mccoy/cms-schema";
import {
  InspectTextField,
  SectionAiToolbar,
  collectShallowStringFields,
} from "../ai-assist";
import type { ImagePickerProps } from "../inspector-types";
import { CardListEditor } from "../CardListEditor";

export function ServicesMainInspector({
  content,
  onPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
  part,
}: {
  content: ServicesMainContent;
  onPatch: (patch: Partial<ServicesMainContent>) => void;
  part?: string;
} & ImagePickerProps) {
  const showHeader = !part || part === "header";
  const showCards = !part || part === "cards";
  return (
    <div className="space-y-3">
      {showHeader ? (
        <>
          <InspectTextField
            label="Eyebrow"
            value={content.eyebrow ?? ""}
            onChange={(v) => onPatch({ eyebrow: v })}
            fieldPath="section:services.main:eyebrow"
            fieldHint="eyebrow"
            maxChars={80}
            enableAi={false}
            showEnDraft={false}
          />
          <InspectTextField
            label="Kop"
            value={content.heading}
            onChange={(v) => onPatch({ heading: v })}
            fieldPath="section:services.main:heading"
            fieldHint="heading"
            maxChars={120}
            enableAi={false}
            showEnDraft={false}
          />
          <InspectTextField
            label="Intro"
            value={content.intro}
            onChange={(v) => onPatch({ intro: v })}
            fieldPath="section:services.main:intro"
            fieldHint="intro"
            multiline
            maxChars={600}
            enableAi={false}
            showEnDraft={false}
          />
          <SectionAiToolbar
            pathPrefix="section:services.main"
            fields={collectShallowStringFields(
              content as unknown as Record<string, unknown>,
              ["eyebrow", "heading", "intro"],
              { includeEmpty: true },
            )}
            fieldLabels={{ eyebrow: "Eyebrow", heading: "Kop", intro: "Intro" }}
            onApplyDutch={(nl) => {
              const patch: Partial<ServicesMainContent> = {};
              if (typeof nl.eyebrow === "string") patch.eyebrow = nl.eyebrow;
              if (typeof nl.heading === "string") patch.heading = nl.heading;
              if (typeof nl.intro === "string") patch.intro = nl.intro;
              onPatch(patch);
            }}
          />
        </>
      ) : null}
      {showCards ? (
        <CardListEditor
          cards={content.cards}
          projectImages={projectImages}
          assetBaseUrl={assetBaseUrl}
          uploadToMediaLibrary={uploadToMediaLibrary}
              mediaLibraryItems={mediaLibraryItems}
              resolveProjectImage={resolveProjectImage}
          preferTags={["services", "work", "gallery"]}
          enPathPrefix="section:services.main:cards"
          onChange={(cards) => onPatch({ cards: cards as ServiceCard[] })}
        />
      ) : null}
    </div>
  );
}
