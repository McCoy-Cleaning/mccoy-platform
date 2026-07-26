import type { z } from "zod";
import type { BlockCategory, BlockType } from "../types";

export type BlockCapabilities = {
  duplicable: boolean;
  removable: boolean;
  /** false → drafts allowed; publish gate rejects until configured */
  publishable: boolean;
};

/**
 * Authoritative data-layer definition (no React).
 * Editors/renderers are registered in cms-editor / cms-renderer and joined via compose.
 */
export type CmsBlockDataDefinition<TType extends BlockType = BlockType, TData = unknown> = {
  type: TType;
  label: string;
  category: BlockCategory;
  description?: string;
  dataVersion: number;
  schema: z.ZodType<TData>;
  createDefault: () => TData;
  /** Legacy → canonical for this type only. */
  normalize: (value: unknown) => unknown;
  capabilities: BlockCapabilities;
  /** Compact admin list summary (no React). */
  getSummary?: (data: unknown) => string;
};

export type BlockEditorPresentation = "inspector" | "inline" | "compact";
