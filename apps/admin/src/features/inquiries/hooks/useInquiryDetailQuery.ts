import * as React from "react";
import {
  getAdminFormInboxMessage,
  getAdminFormInboxThread,
  markAdminRequestNotificationsReadForEntity,
} from "@/lib/api/admin-requests.functions";
import { refreshAdminRequestsUnreadBadge } from "@/lib/requests/unread-badge";
import { decodeInboxMessageId } from "@mccoy/email/contracts";
import type { FormInboxMessage, FormInboxMessageSummary } from "@mccoy/email/contracts";
import { mergeInquiryThreads } from "../lib/merge-thread";

export type DetailState = "idle" | "loading" | "error";

function websiteRequestIdFromInboxId(id: string): string | null {
  try {
    const decoded = decodeInboxMessageId(id);
    if (decoded.provider === "request" || decoded.provider === "e2e") {
      return decoded.requestId;
    }
  } catch {
    /* ignore malformed ids */
  }
  return null;
}

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

  const applyThreadInBackground = React.useCallback((id: string) => {
    // Root getAdminFormInboxMessage already hydrates reply files; this only
    // syncs newly arrived Graph conversation messages without replacing chips.
    void getAdminFormInboxThread({ data: { id } })
      .then((threadResult) => {
        if (!threadResult.ok) return;
        setDetail((prev) =>
          prev && prev.id === id
            ? { ...prev, thread: mergeInquiryThreads(threadResult.thread, prev.thread) }
            : prev,
        );
      })
      .catch(() => {
        /* keep root-only thread */
      });
  }, []);

  const loadDetail = React.useCallback(
    async (id: string, options?: { soft?: boolean }) => {
      const soft = options?.soft === true;
      setSelectedId(id);
      if (!soft) {
        setDetailState("loading");
        setDetailError(null);
      }
      try {
        const result = await getAdminFormInboxMessage({ data: { id } });
        if (!result.ok) {
          if (!soft) {
            setDetail(null);
            setDetailState("error");
            setDetailError(result.error);
          }
          return;
        }
        setDetail((prev) => {
          if (soft && prev && prev.id === id) {
            return {
              ...result.message,
              thread: mergeInquiryThreads(result.message.thread, prev.thread),
            };
          }
          return result.message;
        });
        setDetailState("idle");
        setDetailError(null);
        setItems((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));
        applyThreadInBackground(id);

        if (!soft) {
          const requestId = websiteRequestIdFromInboxId(id);
          if (requestId) {
            void markAdminRequestNotificationsReadForEntity({ data: { entityId: requestId } })
              .then((res) => {
                if (res.ok && res.count > 0) refreshAdminRequestsUnreadBadge();
              })
              .catch(() => {
                /* non-fatal */
              });
          }
        }
      } catch {
        if (!soft) {
          setDetail(null);
          setDetailState("error");
          setDetailError("Kon het bericht niet openen.");
        }
      }
    },
    [applyThreadInBackground, setItems],
  );

  const softRefreshDetail = React.useCallback(
    (id: string) => {
      // Thread-only soft refresh — avoids remounting the root message and
      // briefly pairing optimistic local-reply with the persisted Graph copy.
      applyThreadInBackground(id);
    },
    [applyThreadInBackground],
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
    softRefreshDetail,
    closeDetail,
  };
}
