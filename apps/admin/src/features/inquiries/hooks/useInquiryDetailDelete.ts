import * as React from "react";
import { deleteAdminFormInboxMessage } from "@/lib/api/admin-requests.functions";
import type { FormInboxMessage } from "@mccoy/email/contracts";

/** Single-message delete from the detail pane. */
export function useInquiryDetailDelete(options: {
  detail: FormInboxMessage | null;
  onDeleted: () => void;
}) {
  const { detail, onDeleted } = options;
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const resetForDetailChange = React.useCallback(() => {
    setDeleteOpen(false);
    setDeleteError(null);
  }, []);

  const performDelete = React.useCallback(async () => {
    if (!detail) return;
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      const result = await deleteAdminFormInboxMessage({ data: { id: detail.id } });
      if (!result.ok) {
        setDeleteError(result.error);
        setDeleteBusy(false);
        return;
      }
      setDeleteOpen(false);
      setDeleteBusy(false);
      onDeleted();
    } catch {
      setDeleteError("Verwijderen mislukt. Probeer het opnieuw.");
      setDeleteBusy(false);
    }
  }, [detail, onDeleted]);

  return {
    deleteOpen,
    setDeleteOpen,
    deleteBusy,
    deleteError,
    setDeleteError,
    resetForDetailChange,
    performDelete,
  };
}
