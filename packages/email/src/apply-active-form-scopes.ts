/**
 * Load active published form scopes and strip orphans from inbox rows.
 * Fail-open: if published scopes cannot be loaded, leave scopes untouched
 * (avoids mass-clearing on a transient CMS/store outage).
 */
import {
  clearOrphanScopeOnInboxItem,
  clearOrphanScopesOnInboxSummaries,
  type ScopedInboxFields,
} from "./orphan-form-scopes";

export async function resolveActivePublishedScopeKeys(): Promise<Set<string> | null> {
  try {
    const { loadActivePublishedFormScopeKeys } = await import("@mccoy/database/server");
    const keys = await loadActivePublishedFormScopeKeys();
    if (keys === null) return null;
    return new Set(keys.map((key) => key.trim().toLowerCase()).filter(Boolean));
  } catch {
    return null;
  }
}

export async function withActivePublishedScopesCleared<T extends ScopedInboxFields>(
  items: T[],
): Promise<T[]> {
  const active = await resolveActivePublishedScopeKeys();
  if (!active) return items;
  return clearOrphanScopesOnInboxSummaries(items, active);
}

export async function withActivePublishedScopeCleared<T extends ScopedInboxFields>(
  item: T | null,
): Promise<T | null> {
  if (!item) return null;
  const active = await resolveActivePublishedScopeKeys();
  if (!active) return item;
  return clearOrphanScopeOnInboxItem(item, active);
}
