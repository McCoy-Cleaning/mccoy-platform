import * as React from "react";
import type { ServiceCard, ServicesCardsContent } from "@mccoy/cms-schema";
import type { ImagePickerProps } from "../inspector-types";
import { CardListEditor } from "../CardListEditor";
import { InspectTextField } from "../ai-assist";
import { Section } from "../blocks/field-chrome";

export function ServicesCardsInspector({
  content,
  onPatch,
  projectImages,
  assetBaseUrl,
  uploadToMediaLibrary,
  mediaLibraryItems,
  resolveProjectImage,
}: {
  content: ServicesCardsContent;
  onPatch: (patch: Partial<ServicesCardsContent>) => void;
} & ImagePickerProps) {
  return (
    <div className="space-y-4">
      <Section title="Knopteksten">
        <InspectTextField
          label="Lees meer"
          value={content.readMoreLabel ?? ""}
          onChange={(v) => onPatch({ readMoreLabel: v || undefined })}
          fieldPath="section:services.cards:readMoreLabel"
          fieldHint="readMoreLabel"
          maxChars={40}
          enableAi={false}
          showEnDraft={false}
        />
        <InspectTextField
          label="Sluiten (detailpaneel)"
          value={content.closeLabel ?? ""}
          onChange={(v) => onPatch({ closeLabel: v || undefined })}
          fieldPath="section:services.cards:closeLabel"
          fieldHint="closeLabel"
          maxChars={40}
          enableAi={false}
          showEnDraft={false}
        />
      </Section>
      <CardListEditor
        cards={content.cards}
        projectImages={projectImages}
        assetBaseUrl={assetBaseUrl}
        uploadToMediaLibrary={uploadToMediaLibrary}
        mediaLibraryItems={mediaLibraryItems}
        resolveProjectImage={resolveProjectImage}
        preferTags={["services", "work", "gallery"]}
        enPathPrefix="section:services.cards:cards"
        onChange={(cards) => onPatch({ cards: cards as ServiceCard[] })}
      />
    </div>
  );
}
