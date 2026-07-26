import type { ComponentType } from "react";
import type { BlockType } from "@mccoy/cms-schema";
import type { BlockEditorProps } from "./blockEditorRegistry";

/** Editor maturity for a block type. */
export type EditorQuality = "dedicated" | "typed-composed" | "unsupported";

/**
 * Complete typed editor registration — registry presence alone is not enough;
 * `supportedPaths` must cover editable schema fields (or document a non-editable reason).
 */
export type BlockEditorDefinition<T = any> = {
  Editor: ComponentType<BlockEditorProps<T>>;
  quality: "dedicated" | "typed-composed";
  /** Dot paths of schema fields this inspector actually edits. */
  supportedPaths: readonly string[];
  /**
   * Rare: editable schema path intentionally not exposed in the inspector.
   * Key = path, value = reason (for tests / docs).
   */
  nonEditablePaths?: Readonly<Record<string, string>>;
};

export type BlockEditorRegistryMap = Partial<Record<BlockType, BlockEditorDefinition>>;

/** Nested CmsButton paths edited by CmsButtonEditor. */
export const CTA_SUPPORTED_PATHS = ["cta", "cta.label", "cta.link"] as const;

/** Nested CmsImage paths edited by BlockImageField. */
export function imageSupportedPaths(prefix: string): string[] {
  return [
    prefix,
    `${prefix}.alt`,
    `${prefix}.decorative`,
    `${prefix}.src`,
    `${prefix}.assetId`,
  ];
}
