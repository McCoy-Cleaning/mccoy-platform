import * as React from "react";
import type { ServiceCard, ServicesCardsContent } from "@mccoy/cms-schema";
import type { ImagePickerProps } from "../inspector-types";
import { CardListEditor } from "../CardListEditor";

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
  );
}
