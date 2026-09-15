import * as React from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INQUIRY_STATUS_LABELS_NL,
  INQUIRY_STATUSES,
  type InquiryStatus,
} from "@/lib/requests/labels";

type StatusMeta = {
  /** Pill face: border + bg + text. */
  pill: string;
  /** Hover layer on top of pill. */
  hover: string;
  /** Leading dot: bg + subtle glow for active statuses. */
  dot: string;
};

const STATUS_META: Record<InquiryStatus, StatusMeta> = {
  new: {
    pill: "border-white/10 bg-white/[0.05] text-white/75",
    hover: "hover:border-white/25 hover:bg-white/[0.08] hover:text-white",
    dot: "bg-white/45",
  },
  in_progress: {
    pill: "border-amber-400/30 bg-amber-400/10 text-amber-100",
    hover: "hover:border-amber-400/50 hover:bg-amber-400/15",
    dot: "bg-amber-400 shadow-[0_0_0_3px_rgba(251,191,36,0.18)]",
  },
  invoiced: {
    pill: "border-emerald-400/30 bg-emerald-500/10 text-emerald-100",
    hover: "hover:border-emerald-400/50 hover:bg-emerald-500/15",
    dot: "bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.18)]",
  },
};

/** Per-option accent inside the dropdown: dot color + highlighted/selected tint. */
const OPTION_ACCENT: Record<InquiryStatus, { dot: string; tint: string }> = {
  new: { dot: "bg-white/50", tint: "bg-white/[0.08] text-white ring-white/10" },
  in_progress: { dot: "bg-amber-400", tint: "bg-amber-400/15 text-amber-100 ring-amber-400/25" },
  invoiced: {
    dot: "bg-emerald-400",
    tint: "bg-emerald-500/15 text-emerald-100 ring-emerald-400/25",
  },
};

export function inquiryStatusLabel(status: InquiryStatus | null | undefined): string {
  return INQUIRY_STATUS_LABELS_NL[status ?? "new"];
}

/**
 * Staff triage label setter (Nieuw / In behandeling / Gefactureerd).
 *
 * Renders a colored pill trigger that opens a custom-styled, portaled listbox
 * (so it escapes the list's overflow-hidden section and never gets clipped).
 * The listbox follows the WAI-ARIA "Listbox-button" pattern: the trigger is a
 * <button> with aria-haspopup/aria-expanded/aria-controls/aria-activedescendant,
 * and the popup is a role="listbox" with role="option" items. Focus stays on
 * the trigger while open; arrow keys move the highlighted option and Enter
 * selects it (WCAG 2.2 AA). The parent applies the optimistic update instantly
 * and passes the (already-updated) status back in, so the user sees the new
 * status immediately; on failure the parent rolls back and the pill reverts.
 * "invoiced" is a manual label only — it never creates invoices or financial
 * records.
 */
export function InquiryStatusControl({
  status,
  saving = false,
  error = null,
  disabled = false,
  size = "sm",
  onUpdate,
  className,
}: {
  status: InquiryStatus | null | undefined;
  saving?: boolean;
  error?: string | null;
  disabled?: boolean;
  size?: "sm" | "md";
  onUpdate: (next: InquiryStatus) => void;
  className?: string;
}) {
  const current: InquiryStatus = status ?? "new";
  const meta = STATUS_META[current];
  const isDisabled = disabled || saving;
  const id = React.useId();
  const listboxId = `${id}-listbox`;

  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const listboxRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [highlighted, setHighlighted] = React.useState<number>(() =>
    Math.max(0, INQUIRY_STATUSES.indexOf(current)),
  );
  const [coords, setCoords] = React.useState<{
    left: number;
    width: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  const measure = React.useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const gap = 6;
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < 224 && r.top > spaceBelow;
    setCoords({
      left: r.left,
      width: Math.max(r.width, 180),
      top: openUp ? undefined : r.bottom + gap,
      bottom: openUp ? window.innerHeight - r.top + gap : undefined,
    });
  }, []);

  React.useEffect(() => {
    if (!open) return;
    measure();
    const onScroll = () => measure();
    const onResize = () => measure();
    const onOutside = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (triggerRef.current?.contains(t) || listboxRef.current?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    document.addEventListener("mousedown", onOutside);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [open, measure]);

  React.useEffect(() => {
    if (open) setHighlighted(Math.max(0, INQUIRY_STATUSES.indexOf(current)));
  }, [open, current]);

  const select = React.useCallback(
    (next: InquiryStatus) => {
      setOpen(false);
      if (next !== current) onUpdate(next);
    },
    [current, onUpdate],
  );

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
      e.preventDefault();
      if (open) select(INQUIRY_STATUSES[highlighted]);
      else setOpen(true);
      return;
    }
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(INQUIRY_STATUSES.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(0, h - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setHighlighted(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setHighlighted(INQUIRY_STATUSES.length - 1);
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  };

  const highlightedId = `${id}-opt-${INQUIRY_STATUSES[highlighted]}`;

  return (
    <span className={cn("relative inline-flex items-center", className)}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        disabled={isDisabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open ? highlightedId : undefined}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        onClick={() => {
          if (!isDisabled) setOpen((o) => !o);
        }}
        onKeyDown={onTriggerKeyDown}
        data-state={open ? "open" : "closed"}
        className={cn(
          "group inline-flex items-center gap-2 rounded-full border shadow-sm backdrop-blur-sm transition-all duration-150 outline-none",
          size === "sm" ? "pl-2.5 pr-2 py-1" : "pl-3 pr-2.5 py-1.5",
          meta.pill,
          !isDisabled && meta.hover,
          "focus-visible:border-[#1e88e5] focus-visible:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-[#1e88e5]/30",
          open && "border-[#1e88e5] ring-2 ring-[#1e88e5]/30",
          error &&
            "border-red-400/50 bg-red-500/10 focus-visible:border-red-400 focus-visible:ring-red-400/30",
          isDisabled && "cursor-not-allowed opacity-60",
        )}
      >
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
            meta.dot,
            saving && "animate-pulse",
          )}
          aria-hidden
        />
        <span
          aria-hidden
          className={cn("font-semibold leading-none", size === "sm" ? "text-xs" : "text-sm")}
        >
          {INQUIRY_STATUS_LABELS_NL[current]}
        </span>
        {saving ? (
          <Loader2
            className="h-3.5 w-3.5 shrink-0 animate-spin text-current opacity-80"
            aria-hidden
          />
        ) : (
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-current opacity-60 transition-transform duration-150 group-hover:opacity-90",
              open && "rotate-180",
            )}
            aria-hidden
          />
        )}
        <span className="sr-only">Status van deze aanvraag</span>
      </button>

      {error ? (
        <>
          <span id={`${id}-error`} className="sr-only">
            {error}
          </span>
          <span title={error} className="ml-1 inline-flex shrink-0 items-center">
            <AlertCircle className="h-3.5 w-3.5 text-red-300" aria-hidden />
          </span>
        </>
      ) : null}

      {open && coords
        ? createPortal(
            <div
              ref={listboxRef}
              role="listbox"
              id={listboxId}
              aria-label="Status van deze aanvraag"
              style={{
                position: "fixed",
                left: coords.left,
                width: coords.width,
                top: coords.top,
                bottom: coords.bottom,
                zIndex: 50,
              }}
              className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1220]/95 p-1.5 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl"
            >
              {INQUIRY_STATUSES.map((value, i) => {
                const accent = OPTION_ACCENT[value];
                const selected = value === current;
                const isHighlighted = i === highlighted;
                return (
                  <div
                    key={value}
                    id={`${id}-opt-${value}`}
                    role="option"
                    aria-selected={selected}
                    data-highlighted={isHighlighted || undefined}
                    onClick={() => select(value)}
                    onMouseEnter={() => setHighlighted(i)}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg py-2 pl-2.5 pr-8 text-sm outline-none transition-colors",
                      isHighlighted ? cn(accent.tint, "ring-1 ring-inset") : "text-white/80",
                    )}
                  >
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", accent.dot)} aria-hidden />
                    <span className="font-medium">{INQUIRY_STATUS_LABELS_NL[value]}</span>
                    {selected ? (
                      <Check
                        className="absolute right-2.5 h-4 w-4 text-current opacity-90"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
