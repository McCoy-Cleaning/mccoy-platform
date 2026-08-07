import * as React from "react";
import { cn } from "./cn";

export type LayoutListRow = {
  id: string;
  label: string;
  kindLabel: string;
  /** Compact section-specific summary under the title */
  summary?: string;
  hidden?: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canHide: boolean;
  canDelete: boolean;
  canEdit?: boolean;
  canDuplicate?: boolean;
  /** Fixed section key for E2E inventory (`data-cms-fixed-key`). */
  fixedKey?: string;
  /** Block type for E2E inventory (`data-cms-block-type`). */
  blockType?: string;
};

export type LayoutListProps = {
  rows: LayoutListRow[];
  addLabel?: string;
  liveMessage?: string;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onToggleHide?: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onAdd?: () => void;
  renderExpanded?: (id: string) => React.ReactNode;
  expandedId?: string | null;
  className?: string;
  /** Dense inspector style for slide-over panels */
  compact?: boolean;
};

/**
 * Ordered layout list (fixed + page sections interleaved) — premium inspector styling.
 */
export function LayoutList({
  rows,
  addLabel = "Sectie toevoegen",
  liveMessage = "",
  onMoveUp,
  onMoveDown,
  onToggleHide,
  onDelete,
  onEdit,
  onDuplicate,
  onAdd,
  renderExpanded,
  expandedId,
  className,
  compact = true,
}: LayoutListProps) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div
        aria-live="polite"
        aria-atomic="true"
        className="absolute h-px w-px overflow-hidden whitespace-nowrap"
        style={{ clip: "rect(0, 0, 0, 0)" }}
      >
        {liveMessage}
      </div>

      <ol className="flex flex-col gap-2">
        {rows.map((row, index) => {
          const expanded = expandedId === row.id;
          const isAddable = row.kindLabel !== "Vast";
          return (
            <li
              key={row.id}
              data-cms-layout-row={row.id}
              data-cms-layout-label={row.label}
              {...(row.fixedKey ? { "data-cms-fixed-key": row.fixedKey } : {})}
              {...(row.blockType ? { "data-cms-block-type": row.blockType } : {})}
              className={cn(
                "group relative overflow-hidden rounded-2xl border transition-all duration-200",
                expanded
                  ? "border-sky-400/35 bg-gradient-to-b from-sky-400/[0.12] to-[#12151c] shadow-[0_12px_40px_-18px_rgba(14,165,233,0.45)]"
                  : "border-white/[0.07] bg-[#12151c]/90 hover:border-white/15 hover:bg-[#161a22]",
                row.hidden && !expanded && "opacity-55",
              )}
            >
              <div
                className={cn(
                  "absolute inset-y-0 left-0 w-0.5 transition-colors",
                  expanded ? "bg-sky-400" : "bg-transparent group-hover:bg-white/20",
                  isAddable && !expanded && "group-hover:bg-sky-300/40",
                )}
                aria-hidden
              />

              <div
                className={cn(
                  "relative z-0",
                  compact ? "flex flex-col gap-2.5 px-3.5 py-3" : "flex items-center gap-3 p-4",
                )}
              >
                <div className={cn("flex min-w-0 items-start gap-2.5", !compact && "min-w-0 flex-1")}>
                  <span
                    className={cn(
                      "grid shrink-0 place-items-center rounded-xl text-sm font-bold tabular-nums",
                      compact ? "h-8 w-8 text-[13px]" : "h-9 w-9",
                      expanded ? "bg-sky-400/20 text-sky-200" : "bg-white/[0.05] text-white/40",
                    )}
                  >
                    {index + 1}
                  </span>

                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onEdit?.(row.id)}
                    disabled={!row.canEdit || !onEdit}
                    aria-expanded={expanded}
                  >
                    <p className="truncate text-[15px] font-semibold leading-tight tracking-tight text-white">
                      {row.label}
                    </p>
                    <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                          isAddable
                            ? "bg-sky-400/12 text-sky-200/90 ring-1 ring-inset ring-sky-400/20"
                            : "bg-white/[0.05] text-white/50 ring-1 ring-inset ring-white/10",
                        )}
                      >
                        {isAddable ? "Sectie" : "Vast"}
                      </span>
                      {row.hidden ? (
                        <span className="inline-flex shrink-0 items-center rounded-md bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200/90 ring-1 ring-inset ring-amber-400/25">
                          Verborgen
                        </span>
                      ) : (
                        <span className="sr-only">Zichtbaar</span>
                      )}
                      <span className="min-w-0 truncate text-[12px] text-white/40">
                        {row.summary
                          ? row.summary
                          : expanded
                            ? "Inhoud bewerken"
                            : row.canEdit
                              ? "Tik om te bewerken"
                              : "Alleen volgorde"}
                      </span>
                    </div>
                  </button>
                </div>

                <div
                  className={cn(
                    "flex items-center gap-0.5 rounded-xl border border-white/[0.06] bg-black/25 p-0.5",
                    compact ? "self-end" : "shrink-0",
                  )}
                >
                  {row.canMoveUp ? (
                    <IconButton
                      label={`${row.label} omhoog`}
                      compact={compact}
                      onClick={() => onMoveUp(row.id)}
                    >
                      <ChevronUpIcon />
                    </IconButton>
                  ) : null}
                  {row.canMoveDown ? (
                    <IconButton
                      label={`${row.label} omlaag`}
                      compact={compact}
                      onClick={() => onMoveDown(row.id)}
                    >
                      <ChevronDownIcon />
                    </IconButton>
                  ) : null}
                  {row.canHide && onToggleHide ? (
                    <IconButton
                      label={row.hidden ? `${row.label} tonen` : `${row.label} verbergen`}
                      compact={compact}
                      onClick={() => onToggleHide(row.id)}
                      tone={row.hidden ? "warn" : "default"}
                    >
                      {row.hidden ? <EyeOffIcon /> : <EyeIcon />}
                    </IconButton>
                  ) : null}
                  {row.canDuplicate && onDuplicate ? (
                    <IconButton
                      label={`${row.label} dupliceren`}
                      compact={compact}
                      onClick={() => onDuplicate(row.id)}
                    >
                      <CopyIcon />
                    </IconButton>
                  ) : null}
                  {row.canEdit && onEdit ? (
                    <IconButton
                      label={`${row.label} bewerken`}
                      compact={compact}
                      onClick={() => onEdit(row.id)}
                      active={expanded}
                    >
                      <PencilIcon />
                    </IconButton>
                  ) : null}
                  {row.canDelete && onDelete ? (
                    <IconButton
                      label={`${row.label} verwijderen`}
                      compact={compact}
                      danger
                      onClick={() => onDelete(row.id)}
                    >
                      <TrashIcon />
                    </IconButton>
                  ) : null}
                </div>
              </div>

              {expanded && renderExpanded ? (
                <div className="relative z-10 border-t border-white/[0.06] bg-black/15 px-4 py-4 pointer-events-auto">
                  {renderExpanded(row.id)}
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>

      {onAdd ? (
        <button
          type="button"
          onClick={onAdd}
          className="group mt-1 inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-4 text-[15px] font-semibold text-white/60 transition hover:border-sky-400/45 hover:bg-sky-400/[0.08] hover:text-sky-100"
        >
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/[0.06] text-white/70 transition group-hover:bg-sky-400/20 group-hover:text-sky-200">
            <PlusIcon />
          </span>
          {addLabel}
        </button>
      ) : null}
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
  danger,
  active,
  tone = "default",
  compact = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
  tone?: "default" | "warn";
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid place-items-center rounded-lg text-white/55 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60 disabled:cursor-not-allowed disabled:opacity-25",
        compact ? "h-9 w-9" : "h-11 w-11 rounded-xl",
        "hover:bg-white/10 hover:text-white",
        danger && "hover:bg-red-500/15 hover:text-red-300",
        tone === "warn" && "text-amber-200/80 hover:bg-amber-400/10 hover:text-amber-100",
        active && "bg-sky-400/20 text-sky-200 hover:bg-sky-400/25 hover:text-sky-100",
      )}
    >
      {children}
    </button>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 15l6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.1A10.4 10.4 0 0112 5c6.5 0 10 7 10 7a18.4 18.4 0 01-4.2 4.8M6.1 6.1C3.7 7.8 2 12 2 12s3.5 7 10 7c1.3 0 2.5-.2 3.6-.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="2" />
      <path
        d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
