import * as React from "react";
import {
  FIXED_SECTION_DEFS,
  buildEditorLayoutRows,
  canAddBlockType,
  canRemoveBlockType,
  ensureBuiltinSectionContent,
  getBlockDataDefinition,
  layoutItemSupportsContentAlign,
  minInsertIndex,
  missingFixedSectionKeys,
  parseCompositeEditorRowId,
  resolveLayoutItemContentAlign,
  type FixedSectionKey,
} from "@mccoy/cms-schema";
import { ContentAlignControl, SelectedSectionInspector } from "@mccoy/cms-editor";
import { LayoutList, type LayoutListRow } from "@mccoy/ui";
import { Layers, Plus, X } from "lucide-react";
import { cms, useEditablePage } from "@/lib/cms/store";
import { useCmsImagePickerProps } from "@/lib/cms/use-cms-image-picker-props";
import { AdminCmsContentAiProvider } from "./AdminCmsContentAiProvider";
import { BlockRenderer } from "./BlockRenderer";
import { TemplatePicker } from "./TemplatePicker";
import { cn } from "@/lib/utils";
import { appConfirm } from "@/lib/app-dialogs";
import { notifyToast } from "@/lib/notify-toast";

export type SectiesSelection =
  | { kind: "fixed"; sectionKey: FixedSectionKey; part?: string }
  | { kind: "block"; blockId: string; layoutItemId: string }
  | null;

/**
 * Premium slide-over section inspector — layout + typed content editing.
 * Composite pages (about/services/products) expand into per-part rows.
 */
export function BuiltinLayoutEditor({
  pageId,
  open,
  onOpenChange,
  canvasSelection,
  onSelectLayoutItem,
}: {
  pageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvasSelection?: SectiesSelection;
  onSelectLayoutItem?: (selection: SectiesSelection) => void;
}) {
  const page = useEditablePage(pageId);
  const [pickerAt, setPickerAt] = React.useState<number | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [liveMessage, setLiveMessage] = React.useState("");
  const imagePickerProps = useCmsImagePickerProps();

  React.useEffect(() => {
    if (!page || !canvasSelection) return;
    if (canvasSelection.kind === "fixed") {
      const match = page.layout.find((i) => i.kind === "fixed" && i.key === canvasSelection.sectionKey);
      if (!match) return;
      if (canvasSelection.part) {
        setExpandedId(`${match.id}#${canvasSelection.part}`);
      } else {
        setExpandedId(match.id);
      }
      return;
    }
    setExpandedId(canvasSelection.layoutItemId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally ignore `page` identity
  }, [canvasSelection]);

  if (!page || page.kind !== "builtin") return null;

  const editorRows = buildEditorLayoutRows(page.layout, {
    blockLabel: (blockId) => {
      const block = page.blocks.find((b) => b.id === blockId);
      if (!block) return "Paginasectie";
      try {
        return getBlockDataDefinition(block.type).label;
      } catch {
        return block.type;
      }
    },
    minMovableIndex: page.pageKey ? minInsertIndex(page.pageKey) : 0,
  });
  const missingFixed = page.pageKey ? missingFixedSectionKeys(page.pageKey, page.layout) : [];
  const rows: LayoutListRow[] = editorRows.map((r) => {
    const layoutId = r.layoutItemId;
    const layoutItem = page.layout.find((i) => i.id === layoutId);
    let summary: string | undefined;
    let canDuplicate = false;
    let canDelete = r.canDelete;
    if (layoutItem?.kind === "block") {
      const block = page.blocks.find((b) => b.id === layoutItem.blockId);
      if (block) {
        try {
          const def = getBlockDataDefinition(block.type);
          summary = def.getSummary?.(block.data);
          canDuplicate = def.capabilities.duplicable && canAddBlockType(page, block.type);
          canDelete = r.canDelete && canRemoveBlockType(page, block.type);
        } catch {
          /* ignore */
        }
      }
    } else if (!r.hidden) {
      summary = "Zichtbaar";
    }
    return {
      id: r.id,
      label: r.label,
      kindLabel: r.kindLabel,
      summary,
      hidden: r.hidden,
      canMoveUp: r.canMoveUp,
      canMoveDown: r.canMoveDown,
      canHide: r.canHide,
      canDelete,
      canEdit: r.canEdit,
      canDuplicate,
    };
  });

  const sectionContent = ensureBuiltinSectionContent(page, cms.getDraft(pageId));
  const visibleCount = rows.filter((r) => !r.hidden).length;
  const hiddenCount = rows.length - visibleCount;

  const announce = (msg: string) => {
    setLiveMessage("");
    requestAnimationFrame(() => setLiveMessage(msg));
  };

  const layoutItemIdForRow = (rowId: string) => {
    const parsed = parseCompositeEditorRowId(rowId);
    return parsed?.layoutItemId ?? rowId;
  };

  const onMoveUp = (id: string) => {
    const result = cms.moveLayoutItem(pageId, layoutItemIdForRow(id), "up");
    if (result.ok) announce("Sectie omhoog verplaatst");
  };
  const onMoveDown = (id: string) => {
    const result = cms.moveLayoutItem(pageId, layoutItemIdForRow(id), "down");
    if (result.ok) announce("Sectie omlaag verplaatst");
  };
  const onToggleHide = (id: string) => {
    const result = cms.toggleLayoutItemHidden(pageId, layoutItemIdForRow(id));
    if (result.ok) announce("Zichtbaarheid bijgewerkt");
  };
  const onDelete = (id: string) => {
    void (async () => {
      const layoutId = layoutItemIdForRow(id);
      const item = page.layout.find((i) => i.id === layoutId);
      if (!item) return;

      if (item.kind === "fixed") {
        if (
          !(await appConfirm({
            title: "Vaste sectie verwijderen?",
            description:
              "De sectie verdwijnt uit de pagina-indeling. De inhoud blijft bewaard en kan later weer worden toegevoegd. Na Opslaan verdwijnt deze uit de gepubliceerde pagina.",
            confirmLabel: "Verwijderen",
            tone: "destructive",
          }))
        ) {
          return;
        }
        const idx = page.layout.findIndex((i) => i.id === layoutId);
        const neighbor = page.layout[idx + 1] ?? page.layout[idx - 1];
        const result = cms.removeFixedLayoutItem(pageId, item.key);
        if (result.ok) {
          setExpandedId(neighbor?.id ?? null);
          if (neighbor?.kind === "fixed") {
            onSelectLayoutItem?.({ kind: "fixed", sectionKey: neighbor.key });
          } else if (neighbor?.kind === "block") {
            onSelectLayoutItem?.({
              kind: "block",
              blockId: neighbor.blockId,
              layoutItemId: neighbor.id,
            });
          } else {
            onSelectLayoutItem?.(null);
          }
          announce("Vaste sectie verwijderd uit het concept");
        }
        return;
      }

      if (
        !(await appConfirm({
          title: "Sectie permanent verwijderen?",
          description:
            "Na Opslaan verdwijnt deze sectie uit de gepubliceerde pagina (niet alleen verbergen). Dit kan niet ongedaan worden gemaakt vanuit dit dialoogvenster.",
          confirmLabel: "Verwijderen",
          tone: "destructive",
        }))
      ) {
        return;
      }
      const idx = page.layout.findIndex((i) => i.id === layoutId);
      const neighbor = page.layout[idx + 1] ?? page.layout[idx - 1];
      const result = cms.removeLayoutBlock(pageId, item.blockId);
      if (result.ok) {
        setExpandedId(neighbor?.id ?? null);
        if (neighbor?.kind === "fixed") {
          onSelectLayoutItem?.({ kind: "fixed", sectionKey: neighbor.key });
        } else if (neighbor?.kind === "block") {
          onSelectLayoutItem?.({
            kind: "block",
            blockId: neighbor.blockId,
            layoutItemId: neighbor.id,
          });
        } else {
          onSelectLayoutItem?.(null);
        }
        announce("Sectie permanent verwijderd uit het concept");
      }
    })();
  };

  const onDuplicate = (id: string) => {
    const layoutId = layoutItemIdForRow(id);
    const item = page.layout.find((i) => i.id === layoutId);
    if (!item || item.kind !== "block") return;
    const result = cms.duplicateLayoutBlock(pageId, item.blockId);
    if (result.ok) {
      const added = result.page.layout.find(
        (i) => i.kind === "block" && i.blockId !== item.blockId && !page.layout.some((x) => x.id === i.id),
      );
      if (added && added.kind === "block") {
        setExpandedId(added.id);
        onSelectLayoutItem?.({
          kind: "block",
          blockId: added.blockId,
          layoutItemId: added.id,
        });
      }
      announce("Sectie gedupliceerd");
    }
  };

  const onEdit = (id: string) => {
    const nextExpanded = expandedId === id ? null : id;
    setExpandedId(nextExpanded);
    if (!nextExpanded) return;

    const composite = editorRows.find((r) => r.id === id)?.composite;
    if (composite) {
      onSelectLayoutItem?.({
        kind: "fixed",
        sectionKey: composite.sectionKey,
        part: composite.partId,
      });
      return;
    }

    const layoutId = layoutItemIdForRow(id);
    const item = page.layout.find((i) => i.id === layoutId);
    if (!item) return;
    if (item.kind === "fixed") {
      onSelectLayoutItem?.({ kind: "fixed", sectionKey: item.key });
    } else {
      onSelectLayoutItem?.({
        kind: "block",
        blockId: item.blockId,
        layoutItemId: item.id,
      });
    }
  };

  const openPicker = () => setPickerAt(page.layout.length);

  return (
    <AdminCmsContentAiProvider pageId={pageId}>
    <>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls="cms-sections-panel"
        aria-label="Secties"
        data-cms-toolbar="sections"
        className={cn(
          "absolute bottom-5 right-5 z-40 inline-flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-xs font-semibold shadow-[0_18px_50px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl transition",
          open
            ? "border-sky-400/50 bg-sky-500 text-white"
            : "border-white/12 bg-[#0d1017]/92 text-white/90 hover:border-white/25 hover:bg-[#141824]",
        )}
      >
        <span
          className={cn(
            "grid h-7 w-7 place-items-center rounded-full",
            open ? "bg-white/20" : "bg-white/10",
          )}
        >
          <Layers className="h-3.5 w-3.5" />
        </span>
        Secties
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] tabular-nums",
            open ? "bg-black/20 text-white" : "bg-white/10 text-white/70",
          )}
        >
          {rows.length}
        </span>
      </button>

      <div
        className={cn(
          "absolute inset-0 z-10 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!open}
        onClick={() => onOpenChange(false)}
      />

      <aside
        id="cms-sections-panel"
        role="dialog"
        aria-label="Paginaindeling"
        aria-hidden={!open}
        className={cn(
          "absolute inset-y-0 right-0 z-30 flex w-[min(100%,min(28rem,90vw))] flex-col overflow-hidden border-l border-white/[0.08] transition-transform duration-300 ease-out",
          "bg-[#0b0d12] shadow-[-24px_0_80px_-30px_rgba(0,0,0,0.85)]",
          open ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none",
        )}
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-sky-500/[0.14] via-transparent to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -right-16 top-24 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl"
          aria-hidden
        />

        <header className="relative shrink-0 border-b border-white/[0.07] px-4 pb-4 pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-300/80">
                Website editor
              </p>
              <h3 className="mt-1 font-display text-xl font-semibold tracking-tight text-white">
                Secties
              </h3>
              <p className="mt-1.5 max-w-[16rem] text-[12px] leading-relaxed text-white/45">
                Bewerk tekst en afbeeldingen per sectie. Wijzigingen zie je direct op het canvas.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Secties sluiten"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/55 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-4 flex gap-2">
            <StatChip label="Totaal" value={rows.length} />
            <StatChip label="Zichtbaar" value={visibleCount} tone="ok" />
            {hiddenCount > 0 ? <StatChip label="Verborgen" value={hiddenCount} tone="warn" /> : null}
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <LayoutList
            compact
            rows={rows}
            liveMessage={liveMessage}
            expandedId={expandedId}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onToggleHide={onToggleHide}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onEdit={onEdit}
            renderExpanded={(id) => {
              const editorRow = editorRows.find((r) => r.id === id);
              if (!editorRow) return null;

              const layoutItem = page.layout.find((i) => i.id === editorRow.layoutItemId);
              const blockType =
                layoutItem?.kind === "block"
                  ? page.blocks.find((b) => b.id === layoutItem.blockId)?.type
                  : null;
              const supportsAlign = layoutItem
                ? layoutItemSupportsContentAlign(layoutItem, blockType)
                : false;
              const alignControl = layoutItem ? (
                <div className="mb-4 border-b border-white/10 pb-4">
                  <ContentAlignControl
                    value={resolveLayoutItemContentAlign(layoutItem)}
                    disabled={!supportsAlign}
                    disabledReason={
                      supportsAlign
                        ? undefined
                        : "Volledige breedte — uitlijning is niet van toepassing op deze sectie."
                    }
                    onChange={(align) => {
                      const result = cms.setLayoutItemContentAlign(
                        pageId,
                        layoutItem.id,
                        align,
                      );
                      if (result.ok) announce("Uitlijning bijgewerkt");
                    }}
                  />
                </div>
              ) : null;

              if (editorRow.composite) {
                return (
                  <div className="space-y-4">
                    {alignControl}
                    <SelectedSectionInspector
                      selection={{
                        kind: "fixed",
                        sectionKey: editorRow.composite.sectionKey,
                        part: editorRow.composite.partId,
                      }}
                      part={editorRow.composite.partId}
                      sectionContent={sectionContent}
                      {...imagePickerProps}
                      onSectionPatch={(sectionKey, patch) => {
                        const result = cms.patchSectionContent(pageId, sectionKey, patch);
                        if (!result.ok) {
                          notifyToast({
                            kind: "error",
                            title: "Wijziging mislukt",
                            description: result.reason,
                          });
                        }
                      }}
                    />
                  </div>
                );
              }

              const item = layoutItem;
              if (!item) return null;

              if (item.kind === "fixed") {
                return (
                  <div className="space-y-4">
                    {alignControl}
                    <SelectedSectionInspector
                      selection={{ kind: "fixed", sectionKey: item.key }}
                      sectionContent={sectionContent}
                      {...imagePickerProps}
                      onSectionPatch={(sectionKey, patch) => {
                        const result = cms.patchSectionContent(pageId, sectionKey, patch);
                        if (!result.ok) {
                          notifyToast({
                            kind: "error",
                            title: "Wijziging mislukt",
                            description: result.reason,
                          });
                        }
                      }}
                    />
                  </div>
                );
              }

              const block = page.blocks.find((b) => b.id === item.blockId);
              if (!block) {
                return (
                  <p className="text-xs text-amber-200">
                    Blok ontbreekt in de inhoud — controleer orphans.
                  </p>
                );
              }
              // Single editor surface — do not also mount SelectedSectionInspector /
              // RegisteredBlockEditor again under a "Veldlijst" accordion (duplicate fields).
              return (
                <div className="space-y-4">
                  {alignControl}
                  <BlockRenderer
                    block={block}
                    {...imagePickerProps}
                    onChange={(patch) => cms.updateLayoutBlock(pageId, block.id, patch)}
                  />
                </div>
              );
            }}
          />
        </div>

        <footer className="relative shrink-0 border-t border-white/[0.07] bg-[#0b0d12]/95 px-3 py-3 backdrop-blur-md">
          {missingFixed.length > 0 ? (
            <div className="mb-3 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
                Verwijderde vaste secties
              </p>
              <ul className="flex flex-col gap-1.5">
                {missingFixed.map((key) => (
                  <li key={key} className="flex items-center justify-between gap-2">
                    <span className="text-xs text-white/70">
                      {FIXED_SECTION_DEFS[key]?.label ?? key}
                    </span>
                    <button
                      type="button"
                      className="rounded-lg border border-sky-400/30 bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                      onClick={() => {
                        const result = cms.addFixedLayoutItem(pageId, key);
                        if (result.ok) {
                          const added = result.page.layout.find(
                            (i) => i.kind === "fixed" && i.key === key,
                          );
                          if (added) {
                            setExpandedId(added.id);
                            onSelectLayoutItem?.({ kind: "fixed", sectionKey: key });
                          }
                          announce("Vaste sectie hersteld");
                        }
                      }}
                    >
                      Terugzetten
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <button
            type="button"
            onClick={openPicker}
            aria-label="Sectie toevoegen"
            data-cms-action="add-section"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-3 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_30px_-12px_rgba(14,165,233,0.8)] transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d12]"
          >
            <Plus className="h-4 w-4" />
            Sectie toevoegen
          </button>
          <p className="mt-2 text-center text-[10px] text-white/30">
            Herbruikbare paginasecties — zelfde sectietypes als op de website.
          </p>
        </footer>
      </aside>

      {pickerAt !== null && (
        <TemplatePicker
          open
          page={page}
          onClose={() => setPickerAt(null)}
          onPick={(type) => {
            const min = page.pageKey ? minInsertIndex(page.pageKey) : 0;
            const at = Math.max(pickerAt, min);
            const beforeIds = new Set(page.blocks.map((b) => b.id));
            const result = cms.addLayoutBlock(pageId, type, at);
            if (result.ok) {
              const nextPage = result.page;
              const added = nextPage.blocks.find((b) => !beforeIds.has(b.id));
              const layoutItem = nextPage.layout.find(
                (i) => i.kind === "block" && added && i.blockId === added.id,
              );
              if (added && layoutItem && layoutItem.kind === "block") {
                setExpandedId(layoutItem.id);
                onSelectLayoutItem?.({
                  kind: "block",
                  blockId: added.id,
                  layoutItemId: layoutItem.id,
                });
              }
              announce("Sectie toegevoegd");
              onOpenChange(true);
            }
            setPickerAt(null);
          }}
        />
      )}
    </>
    </AdminCmsContentAiProvider>
  );
}

function StatChip({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "ok" | "warn";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col rounded-xl border px-2.5 py-2",
        tone === "neutral" && "border-white/[0.07] bg-white/[0.03]",
        tone === "ok" && "border-emerald-400/20 bg-emerald-400/[0.08]",
        tone === "warn" && "border-amber-400/20 bg-amber-400/[0.08]",
      )}
    >
      <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">{label}</span>
      <span
        className={cn(
          "mt-0.5 text-sm font-semibold tabular-nums",
          tone === "ok" && "text-emerald-200",
          tone === "warn" && "text-amber-200",
          tone === "neutral" && "text-white/85",
        )}
      >
        {value}
      </span>
    </div>
  );
}
