import type { BlockType } from "@mccoy/cms-schema";
import type { ComponentType } from "react";
import { JobsSectionView, type JobsSectionViewProps } from "./JobsSectionView";
import { OffersSectionView, type OffersSectionViewProps } from "./OffersSectionView";
import { StepsSectionView, type StepsSectionViewProps } from "./StepsSectionView";

/**
 * Dedicated view components for block types that need more than the shared switch.
 * RegisteredBlockView prefers these when present.
 */
export const blockViewRegistry: Partial<
  Record<BlockType, ComponentType<Record<string, unknown>>>
> = {
  jobs: JobsSectionView as unknown as ComponentType<Record<string, unknown>>,
  offers: OffersSectionView as unknown as ComponentType<Record<string, unknown>>,
  steps: StepsSectionView as unknown as ComponentType<Record<string, unknown>>,
};

export type { JobsSectionViewProps, OffersSectionViewProps, StepsSectionViewProps };
