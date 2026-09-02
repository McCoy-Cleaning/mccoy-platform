import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  EyeOff,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { useLiveEditApi } from "@/lib/cms/live-edit-api-context";
import { cn } from "@/lib/utils";

export type WysiwygSectionChromeProps = {
  label: string;
  layoutItemId: string;
  selected: boolean;
  children: React.ReactNode;
  onSelect: () => void;
  /** Ignore pointer-down select when target matches (composite parts). */
  ignoreSelector?: string;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canDuplicate?: boolean;
  canHide?: boolean;
  canDelete?: boolean;
  hidden?: boolean;
  blockId?: string;
  selectAttr?: { "data-cms-select": string } | { "data-cms-select-block": string };
  onOpenAdvanced?: () => void;
};

/**
 * Absolute-positioned editor overlays around the real section renderer.
 * Does not add layout padding — chrome floats above the published visual.
 */
export function WysiwygSectionChrome({
  label,
  layoutItemId,
  selected,
  children,
  onSelect,
  ignoreSelector,
  canMoveUp = true,
  canMoveDown = true,
  canDuplicate = false,
  canHide = true,
  canDelete = false,
  hidden = false,
  blockId,
  selectAttr,
  onOpenAdvanced,
}: WysiwygSectionChromeProps) {
  const { showEditorChrome, sendMutation, sendUiCommand } = useLiveEditApi();
  const [hovered, setHovered] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  if (!showEditorChrome) {
    return <>{children}</>;
  }

  const showChrome = hovered || selected;

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${label} sectie`}
      {...selectAttr}
      data-cms-layout-item={layoutItemId}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={(e) => {
        const t = e.target as HTMLElement | null;
        if (t?.closest("[data-cms-editor-chrome]")) return;
        if (ignoreSelector && t?.closest(ignoreSelector)) return;
        onSelect();
        if (t?.closest("[data-cms-inline-edit]")) return;
        if (t?.closest("a, button, [data-cms-nav], [data-cms-navigate]")) {
          e.preventDefault();
        }
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const t = e.target as HTMLElement | null;
        // Space/Enter in nested inputs must type text — not select the section.
        if (
          t &&
          (t.tagName === "INPUT" ||
            t.tagName === "TEXTAREA" ||
            t.tagName === "SELECT" ||
            t.isContentEditable ||
            t.closest("[data-cms-editor-chrome]") ||
            t.closest("[data-cms-inline-edit]"))
        ) {
          return;
        }
        e.preventDefault();
        onSelect();
      }}
      className={cn(
        // Zero layout chrome: relative for absolute overlays only — no padding,
        // borders, or ring-offset (ring-offset can move descendants under focus).
        "relative outline-none",
        showChrome &&
          "z-[1] shadow-[inset_0_0_0_2px_rgba(14,165,233,0.85)]",
        selected && "shadow-[inset_0_0_0_2px_rgba(14,165,233,1),0_0_0_4px_rgba(56,189,248,0.2)]",
      )}
    >
      {children}

      {showChrome ? (
        <div
          data-cms-editor-chrome
          className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-between gap-2 p-2"
        >
          <div className="pointer-events-auto inline-flex max-w-[calc(100%-0.5rem)] flex-wrap items-center gap-0.5 rounded-md bg-sky-500 px-1.5 py-1 text-white shadow-lg">
            <span className="truncate px-1.5 text-[11px] font-semibold tracking-wide">
              {label}
            </span>
            <ChromeIconButton
              label="Sectie omhoog"
              disabled={!canMoveUp}
              onClick={() =>
                sendMutation({
                  kind: "layout",
                  op: "move",
                  layoutItemId,
                  direction: "up",
                })
              }
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </ChromeIconButton>
            <ChromeIconButton
              label="Sectie omlaag"
              disabled={!canMoveDown}
              onClick={() =>
                sendMutation({
                  kind: "layout",
                  op: "move",
                  layoutItemId,
                  direction: "down",
                })
              }
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </ChromeIconButton>
            {canDuplicate && blockId ? (
              <ChromeIconButton
                label="Sectie dupliceren"
                onClick={() =>
                  sendMutation({
                    kind: "layout",
                    op: "duplicate",
                    blockId,
                  })
                }
              >
                <Copy className="h-3.5 w-3.5" />
              </ChromeIconButton>
            ) : null}
            {canHide ? (
              <ChromeIconButton
                label={hidden ? "Sectie tonen" : "Sectie verbergen"}
                onClick={() =>
                  sendMutation({
                    kind: "layout",
                    op: "toggle",
                    layoutItemId,
                  })
                }
              >
                {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              </ChromeIconButton>
            ) : null}
            {canDelete || canHide ? (
              <ChromeIconButton
                label={canDelete ? "Sectie verwijderen" : "Sectie verbergen"}
                onClick={() =>
                  sendMutation({
                    kind: "layout",
                    op: "remove",
                    layoutItemId,
                    blockId,
                  })
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
              </ChromeIconButton>
            ) : null}
            {onOpenAdvanced ? (
              <ChromeIconButton label="Sectie-opties" onClick={onOpenAdvanced}>
                <MoreHorizontal className="h-3.5 w-3.5" />
              </ChromeIconButton>
            ) : (
              <ChromeIconButton
                label="Sectie-opties"
                onClick={() => {
                  if (blockId) {
                    sendUiCommand({
                      kind: "openAdvanced",
                      selection: { kind: "block", blockId, layoutItemId },
                    });
                  }
                }}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </ChromeIconButton>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChromeIconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "grid h-7 w-7 place-items-center rounded text-white/95 transition hover:bg-sky-600",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white",
        disabled && "pointer-events-none opacity-35",
      )}
    >
      {children}
    </button>
  );
}

/** Subtle + between sections; opens parent TemplatePicker via UI command. */
export function SectionInsertGap({ atIndex }: { atIndex: number }) {
  const { showEditorChrome, sendUiCommand } = useLiveEditApi();
  const [hovered, setHovered] = React.useState(false);

  if (!showEditorChrome) return null;

  // Zero-height slot: the + control floats on the section boundary without
  // adding margin/padding that would shift published layout.
  return (
    <div
      data-cms-editor-chrome
      className="relative z-20 h-0"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-x-8 top-0 h-px -translate-y-1/2 transition",
          hovered ? "bg-sky-400/70" : "bg-sky-400/25",
        )}
        aria-hidden
      />
      <button
        type="button"
        aria-label={`Sectie toevoegen op positie ${atIndex + 1}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          sendUiCommand({ kind: "openAddPicker", atIndex });
        }}
        className={cn(
          "absolute left-1/2 top-0 z-20 grid h-8 w-8 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-sky-400/50 bg-sky-500 text-white shadow-md transition",
          "opacity-70 scale-100 hover:opacity-100 hover:scale-110",
          hovered && "opacity-100 scale-110",
          "focus-visible:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300",
        )}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export function EmptyPageAddSection() {
  const { showEditorChrome, sendUiCommand } = useLiveEditApi();
  if (!showEditorChrome) return null;
  return (
    <div
      data-cms-editor-chrome
      className="mx-auto my-16 flex max-w-lg flex-col items-center gap-4 px-6 text-center"
    >
      <p className="text-base text-white/70">Deze pagina heeft nog geen secties.</p>
      <button
        type="button"
        aria-label="Eerste sectie toevoegen"
        onClick={() => sendUiCommand({ kind: "openAddPicker", atIndex: 0 })}
        className="inline-flex items-center gap-2 rounded-full bg-sky-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-sky-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
      >
        <Plus className="h-4 w-4" aria-hidden />
        Voeg uw eerste sectie toe
      </button>
    </div>
  );
}
