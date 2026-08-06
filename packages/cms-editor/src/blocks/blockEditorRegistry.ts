import {
  ALL_BLOCK_TYPES,
  getBlockDataDefinition,
  PUBLISHABLE_BLOCK_TYPES,
  type BlockType,
  type HeroBlockData,
  type JobsBlockData,
  type PlansBlockData,
  type RoadmapBlockData,
} from "@mccoy/cms-schema";
import type { ComponentType } from "react";
import {
  type BlockEditorDefinition,
  type BlockEditorProps,
  type BlockEditorRegistryMap,
} from "./editor-definition";
import { setPopupContentEditorLookup } from "./popup-editor-bridge";
import type { CtaBlockData } from "./CtaBlockEditor";
import type { FeatureGridBlockData } from "./FeatureGridBlockEditor";
import type { TextImageBlockData } from "./TextImageBlockEditor";
import type { GalleryBlockData, CarouselBlockData } from "./GalleryBlockEditor";
import type { TeamGridBlockData } from "./TeamJobsBlockEditor";
import { basicContentEditorRegistry } from "./editor-registry/basic-content";
import { structuralEditorRegistry } from "./editor-registry/structural";
import { mediaSocialEditorRegistry } from "./editor-registry/media-social";
import { informationLegalEditorRegistry } from "./editor-registry/information-legal";
import { conversionEditorRegistry } from "./editor-registry/conversion";
import { specialisedEditorRegistry } from "./editor-registry/specialised";

export type { BlockEditorProps } from "./editor-definition";

type AnyEditor = ComponentType<BlockEditorProps<unknown>>;

/**
 * Typed editor registry — composed from Stage 5 family modules.
 * Presence alone is not enough; `supportedPaths` must cover editable schema fields.
 */
export const blockEditorRegistry: BlockEditorRegistryMap = {
  ...basicContentEditorRegistry,
  ...structuralEditorRegistry,
  ...mediaSocialEditorRegistry,
  ...informationLegalEditorRegistry,
  ...conversionEditorRegistry,
  ...specialisedEditorRegistry,
};

export type DedicatedEditorData =
  | HeroBlockData
  | CtaBlockData
  | FeatureGridBlockData
  | TextImageBlockData
  | GalleryBlockData
  | CarouselBlockData
  | JobsBlockData
  | TeamGridBlockData
  | RoadmapBlockData
  | PlansBlockData;

export function getBlockEditorDefinition(
  type: BlockType,
): BlockEditorDefinition<unknown> | null {
  return (blockEditorRegistry[type] as BlockEditorDefinition<unknown> | undefined) ?? null;
}

export function getRegisteredBlockEditor(type: BlockType): AnyEditor | null {
  return getBlockEditorDefinition(type)?.Editor ?? null;
}

export function listUnsupportedPublishableBlockTypes(): BlockType[] {
  return PUBLISHABLE_BLOCK_TYPES.filter((t) => !blockEditorRegistry[t]);
}

/** @deprecated Prefer {@link listUnsupportedPublishableBlockTypes} / quality checks. */
export function listBlockTypesMissingDedicatedEditor(): BlockType[] {
  return ALL_BLOCK_TYPES.filter((t) => {
    const entry = blockEditorRegistry[t];
    if (!entry) return true;
    return entry.quality !== "dedicated" && entry.quality !== "typed-composed";
  });
}

export function blockEditorSummary(type: BlockType, data: unknown): string | null {
  const defn = getBlockDataDefinition(type);
  return defn.getSummary?.(data) ?? null;
}

export type { BlockEditorDefinition, EditorQuality, BlockEditorRegistryMap } from "./editor-definition";
export { CTA_SUPPORTED_PATHS, imageSupportedPaths } from "./editor-definition";

setPopupContentEditorLookup((type) => getBlockEditorDefinition(type)?.Editor ?? null);
