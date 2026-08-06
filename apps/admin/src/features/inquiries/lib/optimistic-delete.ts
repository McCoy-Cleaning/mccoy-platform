import type { FormInboxMessageSummary } from "@mccoy/email/contracts";

export type OptimisticDeleteSnapshot = {
  previousItems: FormInboxMessageSummary[];
  removed: Array<{
    item: FormInboxMessageSummary;
    originalIndex: number;
  }>;
  previousSelectedIds: string[];
  previousActiveId: string | null;
  operationId: string;
};

export type DeleteTombstone = {
  deletedAt: number;
  operationId: string;
};

/** Freeze unique non-empty IDs at confirm time. */
export function freezeDeleteTargetIds(ids: Iterable<string>): string[] {
  return [...new Set([...ids].map((id) => id.trim()).filter(Boolean))];
}

export function beginOptimisticDelete(
  items: FormInboxMessageSummary[],
  targetIds: string[],
  selectedIds: Set<string>,
  activeId: string | null,
  operationId: string,
): {
  nextItems: FormInboxMessageSummary[];
  nextSelectedIds: Set<string>;
  nextActiveId: string | null;
  snapshot: OptimisticDeleteSnapshot;
  tombstones: Map<string, DeleteTombstone>;
} {
  const target = new Set(targetIds);
  const removed: OptimisticDeleteSnapshot["removed"] = [];
  items.forEach((item, originalIndex) => {
    if (target.has(item.id)) removed.push({ item, originalIndex });
  });

  const nextItems = items.filter((item) => !target.has(item.id));
  const nextSelectedIds = new Set(selectedIds);
  for (const id of targetIds) nextSelectedIds.delete(id);

  const nextActiveId = activeId && target.has(activeId) ? null : activeId;
  const deletedAt = Date.now();
  const tombstones = new Map<string, DeleteTombstone>();
  for (const id of targetIds) {
    tombstones.set(id, { deletedAt, operationId });
  }

  return {
    nextItems,
    nextSelectedIds,
    nextActiveId,
    snapshot: {
      previousItems: [...items],
      removed,
      previousSelectedIds: [...selectedIds],
      previousActiveId: activeId,
      operationId,
    },
    tombstones,
  };
}

/**
 * Restore only failed IDs in stable original relative order.
 * Keeps successfully deleted IDs removed. Preserves messages that arrived after delete began.
 */
export function rollbackDeleteFailures(
  items: FormInboxMessageSummary[],
  snapshot: OptimisticDeleteSnapshot,
  failedIds: string[],
): FormInboxMessageSummary[] {
  const failed = new Set(failedIds);
  if (failed.size === 0) return items;

  const successfulRemoved = new Set(
    snapshot.removed.map((entry) => entry.item.id).filter((id) => !failed.has(id)),
  );
  const previousIds = new Set(snapshot.previousItems.map((item) => item.id));
  const currentById = new Map(items.map((item) => [item.id, item]));

  const restored = snapshot.previousItems
    .filter((item) => !successfulRemoved.has(item.id))
    .map((item) => currentById.get(item.id) ?? item);

  const restoredIds = new Set(restored.map((item) => item.id));
  const newcomers = items.filter((item) => !previousIds.has(item.id) && !restoredIds.has(item.id));

  return [...restored, ...newcomers];
}

/** Drop tombstoned IDs from an incoming list payload. */
export function filterTombstonedItems<T extends { id: string }>(
  items: T[],
  tombstones: Map<string, DeleteTombstone>,
): T[] {
  if (tombstones.size === 0) return items;
  return items.filter((item) => !tombstones.has(item.id));
}

/**
 * After a successful authoritative refresh, clear tombstones for IDs absent from the result.
 * Keep tombstones that still appear (stale echo) until a later refresh confirms absence.
 */
export function pruneTombstonesAfterRefresh(
  tombstones: Map<string, DeleteTombstone>,
  refreshedIds: Set<string>,
  maxAgeMs = 120_000,
): Map<string, DeleteTombstone> {
  const now = Date.now();
  const next = new Map<string, DeleteTombstone>();
  for (const [id, meta] of tombstones) {
    if (refreshedIds.has(id)) {
      // Still present in refresh — keep blocking until confirmed gone or expired.
      if (now - meta.deletedAt < maxAgeMs) next.set(id, meta);
      continue;
    }
    // Absent from refresh → tombstone fulfilled.
  }
  return next;
}

export function formatBulkDeleteStatus(input: { successCount: number; failedCount: number }): {
  status: string | null;
  error: string | null;
} {
  const { successCount, failedCount } = input;
  if (successCount > 0 && failedCount === 0) {
    return {
      status: successCount === 1 ? "1 e-mail verwijderd" : `${successCount} e-mails verwijderd`,
      error: null,
    };
  }
  if (successCount > 0 && failedCount > 0) {
    return {
      status: null,
      error: `${successCount} van ${successCount + failedCount} e-mails verwijderd. ${failedCount} e-mail${failedCount === 1 ? "" : "s"} konden niet worden verwijderd en ${failedCount === 1 ? "is" : "zijn"} teruggezet.`,
    };
  }
  return {
    status: null,
    error:
      "E-mails konden niet worden verwijderd. De geselecteerde e-mails zijn teruggezet. Probeer het opnieuw.",
  };
}
