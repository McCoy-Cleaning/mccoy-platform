import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

import { DELETE_RECORD_LABEL } from "../lib/delete-record";

export const ROW_ACTION_ITEMS = [
  { id: "view", label: "Bekijk details" },
  { id: "remind", label: "Stuur herinnering" },
  { id: "portal", label: "Beheer portaal" },
  { id: "users", label: "Gebruikers beheren" },
  { id: "delete", label: DELETE_RECORD_LABEL },
] as const;

export type RowActionId = (typeof ROW_ACTION_ITEMS)[number]["id"];

type RowActionsMenuProps = {
  companyId: string;
  companyName: string;
  canRemind: boolean;
  reminderBusy?: boolean;
  onOpen: (companyId: string) => void;
  onAction: (action: RowActionId, companyId: string) => void;
};

/**
 * Per-row ⋮ menu. Each instance owns its open state so two companies never
 * share one popup. Selecting an item always reports this row's companyId.
 */
export function RowActionsMenu({
  companyId,
  companyName,
  canRemind,
  reminderBusy = false,
  onOpen,
  onAction,
}: RowActionsMenuProps) {
  const reactId = useId();
  const menuId = `${reactId}-menu`;
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [coords, setCoords] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    width: number;
  } | null>(null);

  const measure = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = 220;
    const gap = 6;
    const spaceBelow = window.innerHeight - r.bottom;
    const openUp = spaceBelow < 280 && r.top > spaceBelow;
    setCoords({
      left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)),
      width,
      top: openUp ? undefined : r.bottom + gap,
      bottom: openUp ? window.innerHeight - r.top + gap : undefined,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    measure();
    const onOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onScroll = () => measure();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    document.addEventListener("mousedown", onOutside);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("mousedown", onOutside);
    };
  }, [open, measure]);

  function close() {
    setOpen(false);
  }

  function choose(action: RowActionId) {
    if (action === "remind" && (!canRemind || reminderBusy)) return;
    close();
    onAction(action, companyId);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        close();
      }
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        onOpen(companyId);
        setOpen(true);
        setHighlighted(event.key === "ArrowUp" ? ROW_ACTION_ITEMS.length - 1 : 0);
        return;
      }
      setHighlighted((index) => {
        if (event.key === "ArrowDown") return Math.min(ROW_ACTION_ITEMS.length - 1, index + 1);
        return Math.max(0, index - 1);
      });
      return;
    }
    if (event.key === "Home") {
      if (!open) return;
      event.preventDefault();
      setHighlighted(0);
      return;
    }
    if (event.key === "End") {
      if (!open) return;
      event.preventDefault();
      setHighlighted(ROW_ACTION_ITEMS.length - 1);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (!open) return;
      event.preventDefault();
      const item = ROW_ACTION_ITEMS[highlighted];
      if (item) choose(item.id);
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        className="grid h-9 w-9 place-items-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e88e5]/50"
        aria-label={`Acties voor ${companyName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-company-id={companyId}
        onClick={(event) => {
          event.stopPropagation();
          onOpen(companyId);
          setOpen((current) => !current);
          setHighlighted(0);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      {open && coords
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={`Acties voor ${companyName}`}
              style={{
                position: "fixed",
                left: coords.left,
                width: coords.width,
                top: coords.top,
                bottom: coords.bottom,
                zIndex: 60,
              }}
              className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1220]/95 p-1.5 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl"
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  close();
                  triggerRef.current?.focus();
                }
              }}
            >
              {ROW_ACTION_ITEMS.map((item, index) => {
                const disabled = item.id === "remind" && (!canRemind || reminderBusy);
                const active = index === highlighted;
                const destructive = item.id === "delete";
                return (
                  <span key={item.id} className="block">
                    {destructive ? (
                      <span role="separator" className="my-1 block h-px bg-white/10" />
                    ) : null}
                    <button
                      type="button"
                      role="menuitem"
                      disabled={disabled}
                      data-action={item.id}
                      data-company-id={companyId}
                      onMouseEnter={() => setHighlighted(index)}
                      onClick={(event) => {
                        event.stopPropagation();
                        choose(item.id);
                      }}
                      className={
                        disabled
                          ? "flex w-full cursor-not-allowed rounded-lg px-3 py-2 text-left text-sm text-white/35"
                          : destructive && active
                            ? "flex w-full rounded-lg bg-red-500/20 px-3 py-2 text-left text-sm text-red-100"
                            : destructive
                              ? "flex w-full rounded-lg px-3 py-2 text-left text-sm text-red-300/90 hover:bg-red-500/15 hover:text-red-100"
                              : active
                                ? "flex w-full rounded-lg bg-white/10 px-3 py-2 text-left text-sm text-white"
                                : "flex w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 hover:text-white"
                      }
                    >
                      {item.id === "remind" && reminderBusy ? "Versturen…" : item.label}
                    </button>
                  </span>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
