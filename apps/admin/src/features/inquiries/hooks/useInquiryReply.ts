import * as React from "react";
import { replyAdminFormInboxMessage } from "@/lib/api/admin-requests.functions";
import type { FormInboxMessage, FormInboxThreadItem } from "@mccoy/email/contracts";

/**
 * Reply mutation for detail pane.
 * On failure, reply draft text is preserved (caller keeps `reply` state; this hook does not clear it).
 */
export function useInquiryReply(options: {
  detail: FormInboxMessage | null;
  reply: string;
  setReply: React.Dispatch<React.SetStateAction<string>>;
  onAppendReply: (item: FormInboxThreadItem) => void;
  onRemoveReply?: (id: string) => void;
  /** Soft merge only — must not blank the detail pane. */
  onRefreshDetail: () => void;
}) {
  const { detail, reply, setReply, onAppendReply, onRemoveReply, onRefreshDetail } = options;
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [replyError, setReplyError] = React.useState<string | null>(null);
  const [replySuccess, setReplySuccess] = React.useState<string | null>(null);

  const resetForDetailChange = React.useCallback(() => {
    setConfirmOpen(false);
    setReplyError(null);
    setReplySuccess(null);
  }, []);

  const performSend = React.useCallback(async () => {
    if (!detail) return;
    const body = reply.trim();
    if (!body) return;
    setBusy(true);
    setReplyError(null);
    setReplySuccess(null);

    const optimisticId = `local-reply:${detail.id}:${Date.now()}`;
    const optimisticItem: FormInboxThreadItem = {
      id: optimisticId,
      uid: 0,
      direction: "admin",
      from: "McCoy",
      to: detail.submitterEmail ?? "",
      date: new Date().toISOString(),
      subject: detail.subject.startsWith("Re:") ? detail.subject : `Re: ${detail.subject}`,
      textBody: body,
      messageId: null,
      attachments: [],
    };
    onAppendReply(optimisticItem);
    setReply("");
    setConfirmOpen(false);

    try {
      const result = await replyAdminFormInboxMessage({
        data: { id: detail.id, body },
      });
      if (!result.ok) {
        onRemoveReply?.(optimisticId);
        setReplyError(result.error);
        setReply(body);
        setBusy(false);
        return;
      }

      setReplySuccess(`Antwoord verzonden naar ${result.toEmail}.`);
      setBusy(false);
      // Background reconcile only — never remount detail into a loading state.
      window.setTimeout(() => onRefreshDetail(), 800);
    } catch {
      onRemoveReply?.(optimisticId);
      setReplyError("Verzenden mislukt. Probeer het opnieuw.");
      setReply(body);
      setBusy(false);
    }
  }, [detail, onAppendReply, onRemoveReply, onRefreshDetail, reply, setReply]);

  return {
    confirmOpen,
    setConfirmOpen,
    busy,
    replyError,
    setReplyError,
    replySuccess,
    setReplySuccess,
    resetForDetailChange,
    performSend,
  };
}
