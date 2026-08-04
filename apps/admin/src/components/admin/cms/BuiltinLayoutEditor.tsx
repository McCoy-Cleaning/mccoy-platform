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
  parseProductsBlocksMigrationState,
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
export function SectiesOpenButton({
  count,
  onClick,
}: {
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={false}
      aria-controls="cms-sections-panel"
      aria-label="Secties"
      data-cms-toolbar="sections"
      className="absolute bottom-5 right-5 z-40 inline-flex items-center gap-3 rounded-full border border-white/12 bg-[#0d1017]/92 px-5 py-3 text-[15px] font-semibold text-white/90 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl transition hover:border-white/25 hover:bg-[#141824]"
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10">
        <Layers className="h-4 w-4" />
      </span>
      Secties
      <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs tabular-nums text-white/70">
        {count}
      </span>
    </button>
  );
}

export function BuiltinLayoutEditor({
  pageId,
  open,
  onOpenChange,
  canvasSelection,
  onSelectLayoutItem,
  /** When false, host the open FAB outside (grid push layout). Default true. */
  showOpenButton = true,
  /** Desktop: sit inside the shared preview shell (no separate card chrome). */
  docked = false,
}: {
  pageId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvasSelection?: SectiesSelection;
  onSelectLayoutItem?: (selection: SectiesSelection) => void;
  showOpenButton?: boolean;
  docked?: boolean;
}) {
  const page = useEditablePage(pageId);
  const [pickerAt, setPickerAt] = React.useState<number | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [lastSelectionSource, setLastSelectionSource] = React.useState<
    "canvas" | "section-list" | "programmatic"
  >("programmatic");
  const [liveMessage, setLiveMessage] = React.useState("");
  const imagePickerProps = useCmsImagePickerProps();

  React.useEffect(() => {
    if (!page || !canvasSelection) return;
    // Canvas-driven selection expands inspector; do not reopen after manual collapse
    // unless the selected target changed.
    let nextId: string | null = null;
    if (canvasSelection.kind === "fixed") {
      const match = page.layout.find((i) => i.kind === "fixed" && i.key === canvasSelection.sectionKey);
      if (!match) return;
      nextId = canvasSelection.part ? `${match.id}#${canvasSelection.part}` : match.id;
    } else {
      nextId = canvasSelection.layoutItemId;
    }
    setLastSelectionSource("canvas");
    setExpandedId(nextId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally ignore `page` identity
  }, [canvasSelection]);

  // Repair incomplete Producten drafts when Secties opens (pageId-only ensure can miss HMR).
  const lastEnsureAttemptKey = React.useRef("");
  React.useEffect(() => {
    if (!page || page.kind !== "builtin" || page.pageKey !== "products") return;
    const presentations = page.layout.map((item) => {
      if (item.kind === "fixed") return `fixed:${item.key}`;
      const block = page.blocks.find((b) => b.id === item.blockId);
      const data =
        block?.data && typeof block.data === "object"
          ? (block.data as Record<string, unknown>)
          : {};
      return `${block?.type ?? "missing"}:${String(data.presentation ?? "none")}`;
    });
    const hasIntro = presentations.some((p) => p.includes(":productsIntro"));
    const hasAssortment = presentations.some((p) => p.includes(":productsAssortment"));
    if (hasIntro && hasAssortment) return;
    const key = JSON.stringify({
      presentations,
      migration: page.productsBlocksMigration ?? null,
    });
    if (lastEnsureAttemptKey.current === key) return;
    lastEnsureAttemptKey.current = key;
    cms.ensureProductsBlocksMigration(pageId);
  }, [page, pageId]);

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
  const productsMigration =
    page.kind === "builtin" ? parseProductsBlocksMigrationState(page.productsBlocksMigration) : null;
  const productsMigrated =
    productsMigration?.status === "migrated" || productsMigration?.status === "verified";
  const missingFixed = (
    page.pageKey ? missingFixedSectionKeys(page.pageKey, page.layout) : []
  ).filter((key) => {
    // After Producten migration, restore via Sectie toevoegen (blocks), not fixed keys.
    if (productsMigrated && (key === "products.main" || key === "products.info")) return false;
    return true;
  });
  const showProductsEmptyHelper =
    page.kind === "builtin" &&
    page.pageKey === "products" &&
    productsMigrated &&
    page.layout.length === 0;
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
    } else if (layoutItem?.kind === "fixed" && layoutItem.key === "vacatures.application") {
      summary = r.hidden ? undefined : "Formulier en video/foto";
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
    setLastSelectionSource("section-list");
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
      {showOpenButton && !open ? (
        <SectiesOpenButton count={rows.length} onClick={() => onOpenChange(true)} />
      ) : null}

      {/* Mobile sheet overlay — desktop uses push layout from parent */}
      <div
        className={cn(
          "absolute inset-0 z-10 bg-black/40 backdrop-blur-[2px] transition-opacity duration-200 xl:hidden",
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
        data-cms-selection-source={lastSelectionSource}
        className={cn(
          "z-30 flex h-full flex-col overflow-hidden",
          // <xl: slide-over sheet. xl+: fills the shared shell column (clamp width from parent).
          "absolute inset-y-0 right-0 w-[min(100%,min(40rem,96vw))] shadow-[-24px_0_80px_-30px_rgba(0,0,0,0.85)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          docked
            ? "border-0 bg-[#0b0d12] xl:static xl:inset-auto xl:w-full xl:max-w-none xl:bg-transparent xl:shadow-none xl:transition-none"
            : "border-l border-white/[0.08] bg-[#0b0d12] xl:static xl:inset-auto xl:w-full xl:max-w-none xl:shadow-none xl:transition-none",
          open
            ? "translate-x-0 pointer-events-auto"
            : "translate-x-full pointer-events-none xl:translate-x-0",
        )}
      >
        {!docked ? (
          <>
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-sky-500/[0.14] via-transparent to-transparent"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-16 top-24 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl"
              aria-hidden
            />
          </>
        ) : (
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-sky-500/[0.1] via-transparent to-transparent xl:from-sky-500/[0.08]"
            aria-hidden
          />
        )}

        <header
          className={cn(
            "relative shrink-0 border-b border-white/[0.07]",
            docked ? "px-4 pb-3 pt-3.5" : "px-5 pb-5 pt-5",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {!docked ? (
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-300/80">
                  Website editor
                </p>
              ) : null}
              <h3
                className={cn(
                  "font-display font-semibold tracking-tight text-white",
                  docked ? "text-xl" : "mt-1 text-2xl",
                )}
              >
                Secties
              </h3>
              <p
                className={cn(
                  "leading-relaxed text-white/55",
                  docked ? "mt-1 text-xs" : "mt-2 max-w-[22rem] text-sm",
                )}
              >
                {docked
                  ? "Tik op een sectie — het voorbeeld links werkt mee."
                  : "Uw pagina bestaat uit blokken (\"secties\"). Tik op een sectie om de tekst of foto's aan te passen — u ziet het resultaat meteen in het voorbeeld."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Secties sluiten"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className={cn("flex gap-2.5", docked ? "mt-3" : "mt-4")}>
            <StatChip label="Totaal" value={rows.length} />
            <StatChip label="Zichtbaar" value={visibleCount} tone="ok" />
            {hiddenCount > 0 ? <StatChip label="Verborgen" value={hiddenCount} tone="warn" /> : null}
          </div>
        </header>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4">
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

        <footer className="relative shrink-0 border-t border-white/[0.07] bg-[#0b0d12]/95 px-4 py-4 backdrop-blur-md">
          {missingFixed.length > 0 ? (
            <div className="mb-3 space-y-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3.5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                Verwijderde vaste secties
              </p>
              <ul className="flex flex-col gap-2">
                {missingFixed.map((key) => (
                  <li key={key} className="flex items-center justify-between gap-3">
                    <span className="text-sm text-white/75">
                      {FIXED_SECTION_DEFS[key]?.label ?? key}
                    </span>
                    <button
                      type="button"
                      className="rounded-xl border border-sky-400/30 bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
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
          {showProductsEmptyHelper ? (
            <p className="mb-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm text-white/70">
              Voeg ‘Assortiment / kenmerken’ toe via Sectie toevoegen.
            </p>
          ) : null}
          <button
            type="button"
            onClick={openPicker}
            aria-label="Sectie toevoegen"
            data-cms-action="add-section"
            className="inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-sky-500 px-4 text-base font-semibold text-white shadow-[0_10px_30px_-12px_rgba(14,165,233,0.8)] transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0d12]"
          >
            <Plus className="h-5 w-5" />
            Sectie toevoegen
          </button>
          <p className="mt-2.5 text-center text-xs text-white/40">
            Voeg een nieuw blok toe aan deze pagina — bijvoorbeeld tekst, foto's of een galerij.
          </p>
        </footer>
      </aside>

      {pickerAt !== null && (
        <TemplatePicker
          open
          page={page}
          onClose={() => setPickerAt(null)}
          onPick={(type, templateId) => {
            const min = page.pageKey ? minInsertIndex(page.pageKey) : 0;
            const at = Math.max(pickerAt, min);
            const beforeIds = new Set(page.blocks.map((b) => b.id));
            const result = cms.addLayoutBlock(pageId, type, at, { templateId });
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
        "flex min-w-0 flex-1 flex-col rounded-xl border px-3 py-2.5",
        tone === "neutral" && "border-white/[0.07] bg-white/[0.03]",
        tone === "ok" && "border-emerald-400/20 bg-emerald-400/[0.08]",
        tone === "warn" && "border-amber-400/20 bg-amber-400/[0.08]",
      )}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">{label}</span>
      <span
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
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
