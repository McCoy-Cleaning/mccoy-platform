import * as React from "react";
import { parseBlockData, type Block, type BlockType } from "@mccoy/cms-schema";
import type { LinkResolverPages } from "./CmsImageView";
import { blockViewRegistry } from "./blockViewRegistry";
import { registerPopupBlockView } from "./popupBlockRenderer";

export type RegisteredBlockViewProps = {
  block: Block;
  pages?: LinkResolverPages;
  /** When true, show admin-visible warnings for invalid data instead of silent skip. */
  adminMode?: boolean;
};

/**
 * Stage 5 orchestrator — validates block data, then dispatches to
 * {@link blockViewRegistry}. Publishable markup lives in dedicated section views.
 */
export function RegisteredBlockView({
  block,
  pages = [],
  adminMode = false,
}: RegisteredBlockViewProps) {
  const parsed = parseBlockData(block.type, block.data);
  if (!parsed.ok) {
    // Public storefront stays quiet; admin canvas keeps diagnostics.
    if (!adminMode) return null;
    console.error("[cms-renderer] invalid block", {
      type: block.type,
      id: block.id,
      error: parsed.error,
    });
    return (
      <div
        className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100"
        role="alert"
      >
        Ongeldige sectie ({block.type}): {parsed.error}
      </div>
    );
  }

  const type = block.type as BlockType;
  const View = blockViewRegistry[type];
  if (!View) {
    if (!adminMode) return null;
    console.error("[cms-renderer] missing registry view", type);
    return (
      <div className="rounded-xl border border-amber-400/40 p-4 text-amber-100" role="alert">
        Geen renderer voor {type}
      </div>
    );
  }

  const mode = adminMode ? "preview" : "storefront";
  return (
    <View
      data={parsed.data as Record<string, unknown>}
      pages={pages}
      blockId={block.id}
      adminMode={adminMode}
      mode={mode}
      showHidden={adminMode}
    />
  );
}

/** @deprecated Prefer RegisteredBlockView — kept for gradual migration. */
export function CmsBlockView({ type, data }: { type: string; data: Record<string, unknown> }) {
  return (
    <RegisteredBlockView
      block={{ id: "legacy", type: type as BlockType, data }}
      adminMode
    />
  );
}

registerPopupBlockView(RegisteredBlockView);
