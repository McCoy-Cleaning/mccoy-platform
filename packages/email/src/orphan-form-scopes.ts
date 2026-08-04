/**
 * Retire Aanvragen scopes that no longer exist on published CMS forms.
 * Orphaned items become unscoped (Algemeen / Alle scopes) — kind is unchanged.
 */

export type ScopedInboxFields = {
  scopeKey: string | null;
  scopeLabel: string | null;
};

/** Normalize published scope keys for Set membership checks. */
export function activePublishedScopeKeySet(
  published: ReadonlyArray<{ key: string }>,
): Set<string> {
  const keys = new Set<string>();
  for (const entry of published) {
    const key = entry.key.trim().toLowerCase();
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Scope keys present in candidates but absent from the live published set.
 * Used by cleanup / facet tests — does not mutate storage.
 */
export function findOrphanedScopeKeys(
  candidateKeys: Iterable<string | null | undefined>,
  activeKeys: Set<string>,
): string[] {
  const orphans = new Set<string>();
  for (const raw of candidateKeys) {
    if (!raw?.trim()) continue;
    const key = raw.trim().toLowerCase();
    if (!activeKeys.has(key)) orphans.add(key);
  }
  return [...orphans].sort((a, b) => a.localeCompare(b));
}

export function isOrphanFormScope(
  scopeKey: string | null | undefined,
  activeKeys: Set<string>,
): boolean {
  if (!scopeKey?.trim()) return false;
  return !activeKeys.has(scopeKey.trim().toLowerCase());
}

/** Clear scope on one inbox row when its key is no longer published. */
export function clearOrphanScopeOnInboxItem<T extends ScopedInboxFields>(
  item: T,
  activeKeys: Set<string>,
): T {
  if (!isOrphanFormScope(item.scopeKey, activeKeys)) return item;
  return { ...item, scopeKey: null, scopeLabel: null };
}

/** Clear orphan scopes on a list (mailbox subject markers + request rows). */
export function clearOrphanScopesOnInboxSummaries<T extends ScopedInboxFields>(
  items: T[],
  activeKeys: Set<string>,
): T[] {
  return items.map((item) => clearOrphanScopeOnInboxItem(item, activeKeys));
}
