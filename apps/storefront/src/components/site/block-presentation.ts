/**
 * Pure helpers for storefront presentation-adapter detection (no React).
 * Dual-read Producten/About presentations until MG5.
 */

import { parseBlockData, type Block } from "@mccoy/cms-schema";

/** True when this block uses a storefront brand presentation adapter (not generic registry view). */
export function usesStorefrontPresentationAdapter(block: Block): boolean {
  const parsed = parseBlockData(block.type, block.data);
  if (!parsed.ok) return false;
  const presentation = (parsed.data as { presentation?: string }).presentation;
  return (
    (block.type === "textImage" &&
      (presentation === "productsIntro" || presentation === "aboutPillar")) ||
    (block.type === "featureGrid" && presentation === "productsAssortment") ||
    (block.type === "centered" && presentation === "aboutIntro")
  );
}
