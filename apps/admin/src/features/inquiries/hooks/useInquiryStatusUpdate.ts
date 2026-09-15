import * as React from "react";
import { updateAdminInquiryStatus } from "@/lib/api/admin-requests.functions";
import { INQUIRY_STATUS_LABELS_NL, type InquiryStatus } from "@/lib/requests/labels";
import type { FormInboxMessage, FormInboxMessageSummary } from "@mccoy/email/contracts";

/**
 * Optimistic staff triage label (Nieuw / In behandeling / Gefactureerd) updates
 * from the Aanvragen list and detail. The list is updated instantly; the open
 * detail (if it matches) is updated too. On failure the previous status is
 * restored and a toast is surfaced. "invoiced" is a manual label only — it
 * never creates invoices or financial records (see the server function).
 */
export function useInquiryStatusUpdate(options: {
  setItems: React.Dispatch<React.SetStateAction<FormInboxMessageSummary[]>>;
  setDetail: React.Dispatch<React.SetStateAction<FormInboxMessage | null>>;
  selectedId: string | null;
}) {
  const { setItems, setDetail, selectedId } = options;
  const [savingIds, setSavingIds] = React.useState<Set<string>>(new Set());
  const [errorById, setErrorById] = React.useState<Map<string, string>>(new Map());
  const [toast, setToast] = React.useState<string | null>(null);
  const toastTimerRef = React.useRef<number | null>(null);

  const showToast = React.useCallback((message: string, autoDismissMs = 3000) => {
    setToast(message);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), autoDismissMs);
  }, []);

  const dismissToast = React.useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const isSaving = React.useCallback((id: string) => savingIds.has(id), [savingIds]);

  const errorFor = React.useCallback((id: string) => errorById.get(id) ?? null, [errorById]);

  const clearError = React.useCallback((id: string) => {
    setErrorById((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const updateStatus = React.useCallback(
    async (id: string, next: InquiryStatus) => {
      let previousStatus: InquiryStatus | null = null;

      // Capture previous status for rollback, then apply optimistically.
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          previousStatus = item.inquiryStatus ?? "new";
          return { ...item, inquiryStatus: next };
        }),
      );
      if (id === selectedId) {
        setDetail((prev) =>
          prev && prev.id === id ? { ...prev, inquiryStatus: next } : prev,
        );
      }

      setSavingIds((prev) => {
        const nextSet = new Set(prev);
        nextSet.add(id);
        return nextSet;
      });
      setErrorById((prev) => {
        if (!prev.has(id)) return prev;
        const nextMap = new Map(prev);
        nextMap.delete(id);
        return nextMap;
      });

      try {
        const result = await updateAdminInquiryStatus({ data: { id, inquiryStatus: next } });
        if (!result.ok) {
          // Rollback to previous status.
          setItems((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, inquiryStatus: previousStatus ?? "new" } : item,
            ),
          );
          if (id === selectedId) {
            setDetail((prev) =>
              prev && prev.id === id
                ? { ...prev, inquiryStatus: previousStatus ?? "new" }
                : prev,
            );
          }
          setErrorById((prev) => {
            const nextMap = new Map(prev);
            nextMap.set(id, result.error);
            return nextMap;
          });
          showToast(result.error);
          return;
        }

        // Confirm the server-returned status (covers any normalization).
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, inquiryStatus: result.inquiryStatus } : item,
          ),
        );
        if (id === selectedId) {
          setDetail((prev) =>
            prev && prev.id === id ? { ...prev, inquiryStatus: result.inquiryStatus } : prev,
          );
        }
        showToast(`Status ingesteld op ${INQUIRY_STATUS_LABELS_NL[result.inquiryStatus]}.`);
      } catch {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, inquiryStatus: previousStatus ?? "new" } : item,
          ),
        );
        if (id === selectedId) {
          setDetail((prev) =>
            prev && prev.id === id ? { ...prev, inquiryStatus: previousStatus ?? "new" } : prev,
          );
        }
        const message = "Kon de status niet opslaan. Probeer het opnieuw.";
        setErrorById((prev) => {
          const nextMap = new Map(prev);
          nextMap.set(id, message);
          return nextMap;
        });
        showToast(message);
      } finally {
        setSavingIds((prev) => {
          const nextSet = new Set(prev);
          nextSet.delete(id);
          return nextSet;
        });
      }
    },
    [selectedId, setDetail, setItems, showToast],
  );

  React.useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return {
    updateStatus,
    isSaving,
    errorFor,
    clearError,
    toast,
    dismissToast,
  };
}
