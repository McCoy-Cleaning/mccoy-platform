import * as React from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { getBlockDataDefinition } from "@mccoy/cms-schema";
import { cms } from "@/lib/cms/store";
import type { Page } from "@/lib/cms/types";
import { useCmsImagePickerProps } from "@/lib/cms/use-cms-image-picker-props";
import { BlockRenderer } from "./BlockRenderer";
import { TemplatePicker } from "./TemplatePicker";
import { appConfirm } from "@/lib/app-dialogs";

/**
 * @deprecated Unused — builtin pages use BuiltinLayoutEditor + layout blocks.
 * Removal plan: delete after one production publish cycle with no imports (tracked 2026-07).
 *
 * Editor for blocks appended after fixed React sections on builtin pages.
 * Hard constraint: these always render after all fixed sections.
 */
export function ExtraBlocksEditor({ page }: { page: Page }) {
  const [pickerAt, setPickerAt] = React.useState<number | null>(null);
  const blocks = page.extraBlocks ?? [];
  const imagePickerProps = useCmsImagePickerProps();

  return (
    <div className="space-y-3 border-t border-white/10 p-4">
      <div>
        <h3 className="text-sm font-semibold text-white">Extra secties</h3>
        <p className="mt-1 text-xs text-white/50">
          Deze blokken verschijnen altijd onder de vaste pagina-inhoud. Vaste secties kunnen in deze fase niet
          worden herordend of verwijderd.
        </p>
      </div>

      {blocks.map((block, i) => {
        const publishable = getBlockDataDefinition(block.type).capabilities.publishable;
        return (
          <div key={block.id} className="rounded-xl border border-white/10 bg-black/30 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-white/40">{block.type}</span>
              {!publishable ? (
                <span className="rounded border border-amber-400/40 bg-amber-400/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-200">
                  Nog niet publiceerbaar
                </span>
              ) : null}
              <div className="flex-1" />
              <button type="button" className="rounded-lg p-1.5 text-white/50 hover:bg-white/10" onClick={() => cms.moveBlock(page.id, block.id, -1, "extraBlocks")} disabled={i === 0}>
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="rounded-lg p-1.5 text-white/50 hover:bg-white/10" onClick={() => cms.moveBlock(page.id, block.id, 1, "extraBlocks")} disabled={i === blocks.length - 1}>
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="rounded-lg p-1.5 text-red-400/80 hover:bg-red-400/10"
                onClick={() => {
                  void (async () => {
                    if (
                      !(await appConfirm({
                        title: "Sectie verwijderen?",
                        description:
                          "Deze extra sectie verdwijnt uit het concept. Na Opslaan & publiceren verdwijnt ze ook van de live pagina.",
                        confirmLabel: "Verwijderen",
                        tone: "destructive",
                      }))
                    ) {
                      return;
                    }
                    cms.deleteBlock(page.id, block.id, "extraBlocks");
                  })();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <BlockRenderer
              block={block}
              {...imagePickerProps}
              onChange={(patch) => cms.updateBlock(page.id, block.id, patch, "extraBlocks")}
            />
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setPickerAt(blocks.length)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 py-3 text-xs font-medium text-white/60 hover:border-primary/40 hover:text-white"
      >
        <Plus className="h-3.5 w-3.5" /> Sectie toevoegen
      </button>

      {pickerAt !== null && (
        <TemplatePicker
          open
          onClose={() => setPickerAt(null)}
          onPick={(type, templateId) => {
            cms.addBlock(page.id, type, pickerAt, "extraBlocks", { templateId });
            setPickerAt(null);
          }}
        />
      )}
    </div>
  );
}
