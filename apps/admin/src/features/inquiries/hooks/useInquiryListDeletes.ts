import * as React from "react";
import {
  bulkDeleteAdminFormInboxMessages,
  deleteAdminFormInboxMessage,
} from "@/lib/api/admin-requests.functions";
import type { FormInboxMessageSummary } from "@mccoy/email/contracts";
import {
  beginOptimisticDelete,
  formatBulkDeleteStatus,
  freezeDeleteTargetIds,
  rollbackDeleteFailures,
  type DeleteTombstone,
  type OptimisticDeleteSnapshot,
} from "../lib/optimistic-delete";

export function useInquiryListDeletes(options: {
  items: FormInboxMessageSummary[];
  selectedIds: Set<string>;
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setItems: React.Dispatch<React.SetStateAction<FormInboxMessageSummary[]>>;
  removePins: (ids: string[]) => void;
  registerTombstones: (entries: Map<string, DeleteTombstone>) => void;
  clearTombstones: (ids: string[]) => void;
  selectedId: string | null;
  closeDetail: () => void;
}) {
  const {
    items,
    selectedIds,
    setSelectedIds,
    setItems,
    removePins,
    registerTombstones,
    clearTombstones,
    selectedId,
    closeDetail,
  } = options;

  const [listDeleteTargetId, setListDeleteTargetId] = React.useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [listDeleteBusy, setListDeleteBusy] = React.useState(false);
  const [deletingIds, setDeletingIds] = React.useState<Set<string>>(() => new Set());
  const [listDeleteError, setListDeleteError] = React.useState<string | null>(null);
  const [listDeleteStatus, setListDeleteStatus] = React.useState<string | null>(null);
  const [retryFailedIds, setRetryFailedIds] = React.useState<string[]>([]);
  const operationLockRef = React.useRef(false);

  const resetDeleteUiOnFilterChange = React.useCallback(() => {
    setListDeleteTargetId(null);
    setBulkDeleteOpen(false);
    setListDeleteError(null);
    setListDeleteStatus(null);
    setRetryFailedIds([]);
  }, []);

  const runDeleteOperation = React.useCallback(
    async (targetIds: string[]) => {
      const frozen = freezeDeleteTargetIds(targetIds);
      if (frozen.length === 0 || operationLockRef.current) return;
      operationLockRef.current = true;

      const operationId = `del_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      const { nextItems, nextSelectedIds, nextActiveId, snapshot, tombstones } =
        beginOptimisticDelete(items, frozen, selectedIds, selectedId, operationId);

      registerTombstones(tombstones);
      setDeletingIds(new Set(frozen));
      setItems(nextItems);
      setSelectedIds(nextSelectedIds);
      if (nextActiveId === null && selectedId) closeDetail();
      removePins(frozen);
      setListDeleteBusy(true);
      setListDeleteError(null);
      setListDeleteStatus(null);
      setRetryFailedIds([]);

      try {
        type DeleteOutcome = {
          ok: boolean;
          results: Array<{ messageId: string; status: "deleted" | "already_absent" | "failed" }>;
          error?: string;
        };

        let outcome: DeleteOutcome;

        if (frozen.length === 1) {
          const single = await deleteAdminFormInboxMessage({ data: { id: frozen[0]! } });
          if (!single.ok) {
            outcome = {
              ok: false,
              results: [{ messageId: frozen[0]!, status: "failed" }],
              error: single.error,
            };
          } else {
            outcome = {
              ok: true,
              results: [{ messageId: frozen[0]!, status: "deleted" }],
            };
          }
        } else {
          const bulk = await bulkDeleteAdminFormInboxMessages({ data: { ids: frozen } });
          outcome = {
            ok: bulk.ok,
            results:
              "results" in bulk && Array.isArray(bulk.results)
                ? bulk.results.map((r) => ({
                    messageId: r.messageId,
                    status: r.status,
                  }))
                : frozen.map((messageId) => ({
                    messageId,
                    status: "failed" as const,
                  })),
            error: "error" in bulk ? bulk.error : undefined,
          };
        }

        const resolvedSuccess = outcome.results
          .filter((r) => r.status === "deleted" || r.status === "already_absent")
          .map((r) => r.messageId);
        const resolvedFailed = outcome.results
          .filter((r) => r.status === "failed")
          .map((r) => r.messageId);

        if (resolvedFailed.length > 0) {
          clearTombstones(resolvedFailed);
          setItems((prev) => rollbackDeleteFailures(prev, snapshot, resolvedFailed));
          setRetryFailedIds(resolvedFailed);
        }

        const copy = formatBulkDeleteStatus({
          successCount: resolvedSuccess.length,
          failedCount: resolvedFailed.length,
        });
        setListDeleteStatus(copy.status);
        setListDeleteError(copy.error ?? (outcome.ok ? null : (outcome.error ?? null)));
      } catch {
        clearTombstones(frozen);
        setItems((prev) => rollbackDeleteFailures(prev, snapshot, frozen));
        setListDeleteError(
          "E-mails konden niet worden verwijderd. De geselecteerde e-mails zijn teruggezet. Probeer het opnieuw.",
        );
        setRetryFailedIds(frozen);
      } finally {
        setDeletingIds(new Set());
        setListDeleteBusy(false);
        operationLockRef.current = false;
      }
    },
    [
      items,
      selectedIds,
      selectedId,
      setItems,
      setSelectedIds,
      registerTombstones,
      clearTombstones,
      removePins,
      closeDetail,
    ],
  );

  const performListSingleDelete = React.useCallback(async () => {
    if (!listDeleteTargetId) return;
    const id = listDeleteTargetId;
    setListDeleteTargetId(null);
    await runDeleteOperation([id]);
  }, [listDeleteTargetId, runDeleteOperation]);

  const performBulkDelete = React.useCallback(async () => {
    const ids = freezeDeleteTargetIds(selectedIds);
    if (ids.length === 0) return;
    setBulkDeleteOpen(false);
    await runDeleteOperation(ids);
  }, [runDeleteOperation, selectedIds]);

  const retryFailedDeletes = React.useCallback(async () => {
    if (retryFailedIds.length === 0) return;
    const ids = [...retryFailedIds];
    setRetryFailedIds([]);
    await runDeleteOperation(ids);
  }, [retryFailedIds, runDeleteOperation]);

  const listDeleteTarget = listDeleteTargetId
    ? (items.find((item) => item.id === listDeleteTargetId) ?? null)
    : null;

  return {
    listDeleteTargetId,
    setListDeleteTargetId,
    bulkDeleteOpen,
    setBulkDeleteOpen,
    listDeleteBusy,
    deletingIds,
    listDeleteError,
    setListDeleteError,
    listDeleteStatus,
    listDeleteTarget,
    retryFailedIds,
    resetDeleteUiOnFilterChange,
    performListSingleDelete,
    performBulkDelete,
    retryFailedDeletes,
  };
}
