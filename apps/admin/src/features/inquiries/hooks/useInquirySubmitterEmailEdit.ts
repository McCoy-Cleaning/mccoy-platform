import * as React from "react";
import { updateAdminFormInboxSubmitterEmail } from "@/lib/api/admin-requests.functions";
import { decodeInboxMessageId } from "@mccoy/email/contracts";
import type { FormInboxMessage } from "@mccoy/email/contracts";

export function canEditSubmitterEmail(messageId: string | undefined | null): boolean {
  if (!messageId) return false;
  try {
    const decoded = decodeInboxMessageId(messageId);
    return decoded.provider === "request" || decoded.provider === "e2e";
  } catch {
    return false;
  }
}

export function useInquirySubmitterEmailEdit(options: {
  detail: FormInboxMessage | null;
  onUpdated: (email: string) => void;
}) {
  const { detail, onUpdated } = options;
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setEditing(false);
    setDraft(detail?.submitterEmail ?? "");
    setBusy(false);
    setError(null);
  }, [detail?.id, detail?.submitterEmail]);

  const startEdit = React.useCallback(() => {
    if (!detail || !canEditSubmitterEmail(detail.id)) return;
    setDraft(detail.submitterEmail ?? "");
    setError(null);
    setEditing(true);
  }, [detail]);

  const cancelEdit = React.useCallback(() => {
    if (busy) return;
    setEditing(false);
    setDraft(detail?.submitterEmail ?? "");
    setError(null);
  }, [busy, detail?.submitterEmail]);

  const save = React.useCallback(async () => {
    if (!detail || busy) return;
    const next = draft.trim();
    if (!next) {
      setError("Voer een geldig e-mailadres in.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await updateAdminFormInboxSubmitterEmail({
        data: { id: detail.id, email: next },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onUpdated(result.submitterEmail);
      setEditing(false);
      setDraft(result.submitterEmail);
    } catch {
      setError("Kon het e-mailadres niet opslaan.");
    } finally {
      setBusy(false);
    }
  }, [busy, detail, draft, onUpdated]);

  return {
    canEdit: canEditSubmitterEmail(detail?.id),
    editing,
    draft,
    setDraft,
    busy,
    error,
    startEdit,
    cancelEdit,
    save,
  };
}
