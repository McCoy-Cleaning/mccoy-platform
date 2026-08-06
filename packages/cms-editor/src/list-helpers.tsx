import * as React from "react";
import { iconBtnClass, TrashIcon } from "./inspector-chrome";

export function RemoveIconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={iconBtnClass} aria-label={label} title={label} onClick={onClick}>
      <TrashIcon />
    </button>
  );
}

export function updateCardAt<T extends { id: string }>(cards: T[], id: string, patch: Partial<T>): T[] {
  return cards.map((card) => (card.id === id ? { ...card, ...patch } : card));
}

export function removeById<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter((item) => item.id !== id);
}
