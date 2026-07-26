import * as React from "react";
import { createItemId } from "@mccoy/cms-schema";

export type ObjectListActions<T extends { id: string }> = {
  update: (next: T) => void;
  remove: () => void;
  moveUp: () => void;
  moveDown: () => void;
  duplicate: () => void;
};

export type ObjectListEditorProps<T extends { id: string }> = {
  items: T[];
  onChange: (items: T[]) => void;
  createItem: () => T;
  /** When set, used for duplicate (inserts copy directly after source). */
  cloneItem?: (item: T) => T;
  renderItem: (item: T, actions: ObjectListActions<T>, index: number) => React.ReactNode;
  addLabel?: string;
  className?: string;
};

function announce(message: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById("cms-list-live-region");
  if (el) el.textContent = message;
}

export function ObjectListEditor<T extends { id: string }>({
  items,
  onChange,
  createItem,
  cloneItem,
  renderItem,
  addLabel = "Item toevoegen",
  className,
}: ObjectListEditorProps<T>) {
  const listRef = React.useRef<HTMLDivElement>(null);

  const setItems = (next: T[], message?: string) => {
    onChange(next);
    if (message) announce(message);
  };

  return (
    <div className={className}>
      <div id="cms-list-live-region" className="sr-only" aria-live="polite" />
      <div ref={listRef} className="space-y-3">
        {items.map((item, index) => {
          const actions: ObjectListActions<T> = {
            update: (next) => {
              setItems(
                items.map((it) => (it.id === item.id ? next : it)),
                "Item bijgewerkt",
              );
            },
            remove: () => {
              const next = items.filter((it) => it.id !== item.id);
              setItems(next, "Item verwijderd");
              queueMicrotask(() => {
                const focusId = next[Math.max(0, index - 1)]?.id ?? next[0]?.id;
                if (focusId && listRef.current) {
                  const node = listRef.current.querySelector(
                    `[data-list-item-id="${focusId}"]`,
                  ) as HTMLElement | null;
                  node?.focus();
                }
              });
            },
            moveUp: () => {
              if (index <= 0) return;
              const next = [...items];
              [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
              setItems(next, "Item omhoog verplaatst");
            },
            moveDown: () => {
              if (index >= items.length - 1) return;
              const next = [...items];
              [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
              setItems(next, "Item omlaag verplaatst");
            },
            duplicate: () => {
              const copy = cloneItem
                ? cloneItem(item)
                : ({ ...item, id: createItemId("item") } as T);
              const next = [...items];
              next.splice(index + 1, 0, copy);
              setItems(next, "Item gedupliceerd");
            },
          };
          return (
            <div
              key={item.id}
              data-list-item-id={item.id}
              tabIndex={-1}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
            >
              {renderItem(item, actions, index)}
              <div className="mt-2 flex flex-wrap gap-1">
                <button
                  type="button"
                  className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/70 hover:bg-white/5"
                  onClick={actions.moveUp}
                  disabled={index === 0}
                >
                  Omhoog
                </button>
                <button
                  type="button"
                  className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/70 hover:bg-white/5"
                  onClick={actions.moveDown}
                  disabled={index === items.length - 1}
                >
                  Omlaag
                </button>
                <button
                  type="button"
                  className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/70 hover:bg-white/5"
                  onClick={actions.duplicate}
                >
                  Dupliceer
                </button>
                <button
                  type="button"
                  className="rounded-md border border-red-400/30 px-2 py-1 text-[11px] text-red-300 hover:bg-red-400/10"
                  onClick={actions.remove}
                >
                  Verwijder
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <button
        type="button"
        className="mt-3 rounded-lg border border-sky-400/30 bg-sky-400/10 px-3 py-2 text-xs font-medium text-sky-200 hover:bg-sky-400/20"
        onClick={() => {
          const item = createItem();
          setItems([...items, item], "Item toegevoegd");
          queueMicrotask(() => {
            const node = listRef.current?.querySelector(
              `[data-list-item-id="${item.id}"]`,
            ) as HTMLElement | null;
            node?.focus();
          });
        }}
      >
        {addLabel}
      </button>
    </div>
  );
}
