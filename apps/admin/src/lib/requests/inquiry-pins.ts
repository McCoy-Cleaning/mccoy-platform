import * as React from "react";

import { useAdminSession } from "@/lib/admin-auth";

export const MAX_INQUIRY_PINS = 20;

const STORAGE_PREFIX = "mccoy.admin.aanvragen.pinned";

function pinStorageKey(identity: string): string {
  return `${STORAGE_PREFIX}:${identity}`;
}

function normalizePinIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const ids = raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
  return [...new Set(ids)].slice(0, MAX_INQUIRY_PINS);
}

export function loadInquiryPins(identity: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(pinStorageKey(identity));
    if (!raw) return [];
    return normalizePinIds(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveInquiryPins(identity: string, ids: string[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(pinStorageKey(identity), JSON.stringify(normalizePinIds(ids)));
}

export function sortInboxItemsByPins<T extends { id: string }>(items: T[], pinnedIds: string[]): T[] {
  if (pinnedIds.length === 0 || items.length === 0) return items;

  const visibleIds = new Set(items.map((item) => item.id));
  const pinnedOrder = pinnedIds.filter((id) => visibleIds.has(id));
  if (pinnedOrder.length === 0) return items;

  const pinnedSet = new Set(pinnedOrder);
  const byId = new Map(items.map((item) => [item.id, item]));
  const pinned = pinnedOrder.map((id) => byId.get(id)!);
  const unpinned = items.filter((item) => !pinnedSet.has(item.id));
  return [...pinned, ...unpinned];
}

export type InquiryPinToggleResult = "pinned" | "unpinned" | "max_reached";

export function useInquiryPins() {
  const { session } = useAdminSession();
  const identity = session?.userId ?? session?.username ?? "local";
  const [pinnedIds, setPinnedIds] = React.useState<string[]>(() => loadInquiryPins(identity));

  React.useEffect(() => {
    setPinnedIds(loadInquiryPins(identity));
  }, [identity]);

  const togglePin = React.useCallback(
    (id: string): InquiryPinToggleResult => {
      let result: InquiryPinToggleResult = "unpinned";
      setPinnedIds((prev) => {
        if (prev.includes(id)) {
          const next = prev.filter((itemId) => itemId !== id);
          saveInquiryPins(identity, next);
          result = "unpinned";
          return next;
        }
        if (prev.length >= MAX_INQUIRY_PINS) {
          result = "max_reached";
          return prev;
        }
        const next = [id, ...prev];
        saveInquiryPins(identity, next);
        result = "pinned";
        return next;
      });
      return result;
    },
    [identity],
  );

  const removePins = React.useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      setPinnedIds((prev) => {
        const remove = new Set(ids);
        const next = prev.filter((id) => !remove.has(id));
        if (next.length === prev.length) return prev;
        saveInquiryPins(identity, next);
        return next;
      });
    },
    [identity],
  );

  const isPinned = React.useCallback((id: string) => pinnedIds.includes(id), [pinnedIds]);

  return { pinnedIds, togglePin, removePins, isPinned };
}
