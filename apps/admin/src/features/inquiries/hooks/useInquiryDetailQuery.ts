import * as React from "react";
import {
  getAdminFormInboxMessage,
  getAdminFormInboxThread,
} from "@/lib/api/admin-requests.functions";
import type { FormInboxMessage, FormInboxMessageSummary } from "@mccoy/email/contracts";

export type DetailState = "idle" | "loading" | "error";

/**
 * Detail is loaded by `selectedInquiryId` via getAdminFormInboxMessage.
 * List unread badges are updated locally after a successful open — no second selected-row store.
 */
export function useInquiryDetailQuery(options: {
  setItems: React.Dispatch<React.SetStateAction<FormInboxMessageSummary[]>>;
}) {
  const { setItems } = options;
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<FormInboxMessage | null>(null);
  const [detailState, setDetailState] = React.useState<DetailState>("idle");
  const [detailError, setDetailError] = React.useState<string | null>(null);

  const loadDetail = React.useCallback(
    async (id: string) => {
      setSelectedId(id);
      setDetailState("loading");
      setDetailError(null);
      try {
        const result = await getAdminFormInboxMessage({ data: { id } });
        if (!result.ok) {
          setDetail(null);
          setDetailState("error");
          setDetailError(result.error);
          return;
        }
        setDetail(result.message);
        setDetailState("idle");
        setItems((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));

        void getAdminFormInboxThread({ data: { id } })
          .then((threadResult) => {
            if (!threadResult.ok) return;
            setDetail((prev) =>
              prev && prev.id === id ? { ...prev, thread: threadResult.thread } : prev,
            );
          })
          .catch(() => {
            /* keep root-only thread */
          });
      } catch {
        setDetail(null);
        setDetailState("error");
        setDetailError("Kon het bericht niet openen.");
      }
    },
    [setItems],
  );

  const closeDetail = React.useCallback(() => {
    setSelectedId(null);
    setDetail(null);
    setDetailState("idle");
    setDetailError(null);
  }, []);

  return {
    selectedId,
    detail,
    setDetail,
    detailState,
    detailError,
    loadDetail,
    closeDetail,
  };
}
