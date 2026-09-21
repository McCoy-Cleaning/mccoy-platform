import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { MoreVertical } from "lucide-react";

export const USER_ROW_ACTIONS = [
  { id: "view", label: "Bekijk details" },
  { id: "remind", label: "Herinnering sturen" },
  { id: "reset", label: "Resetten uitnodiging" },
  { id: "block", label: "Blokkeren" },
] as const;

export type UserRowActionId = (typeof USER_ROW_ACTIONS)[number]["id"];

type UsersRowActionsMenuProps = {
  userId: string;
  userName: string;
  canRemind: boolean;
  canReset: boolean;
  canBlock: boolean;
  blocked: boolean;
  reminderBusy?: boolean;
  onOpen: (userId: string) => void;
  onAction: (action: UserRowActionId, userId: string) => void;
};

export function UsersRowActionsMenu({
  userId,
  userName,
  canRemind,
  canReset,
  canBlock,
  blocked,
  reminderBusy = false,
  onOpen,
  onAction,
}: UsersRowActionsMenuProps) {
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
    const openUp = spaceBelow < 220 && r.top > spaceBelow;
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

  function disabledFor(action: UserRowActionId): boolean {
    if (action === "remind") return !canRemind || reminderBusy;
    if (action === "reset") return !canReset || reminderBusy;
    if (action === "block") return !canBlock;
    return false;
  }

  function labelFor(action: UserRowActionId, label: string): string {
    if (action === "remind" && reminderBusy) return "Versturen…";
    if (action === "block" && blocked) return "Deblokkeren";
    return label;
  }

  function choose(action: UserRowActionId) {
    if (disabledFor(action)) return;
    close();
    onAction(action, userId);
  }

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        onOpen(userId);
        setOpen(true);
        setHighlighted(event.key === "ArrowUp" ? USER_ROW_ACTIONS.length - 1 : 0);
      }
    }
  }

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        className="grid h-9 w-9 place-items-center rounded-lg text-white/55 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1e88e5]/50"
        aria-label={`Acties voor ${userName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        data-user-id={userId}
        onClick={(event) => {
          event.stopPropagation();
          onOpen(userId);
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
              aria-label={`Acties voor ${userName}`}
              style={{
                position: "fixed",
                left: coords.left,
                width: coords.width,
                top: coords.top,
                bottom: coords.bottom,
                zIndex: 60,
              }}
              className="overflow-hidden rounded-xl border border-white/10 bg-[#0c1220]/95 p-1.5 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl"
            >
              {USER_ROW_ACTIONS.map((item, index) => {
                const disabled = disabledFor(item.id);
                const active = index === highlighted;
                const destructive = item.id === "block" && !blocked;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    disabled={disabled}
                    data-action={item.id}
                    data-user-id={userId}
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
                    {labelFor(item.id, item.label)}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}
