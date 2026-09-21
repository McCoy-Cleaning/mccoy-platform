import * as React from "react";
import {
  getAdminFormInboxMessage,
  getAdminFormInboxThread,
} from "@/lib/api/admin-requests.functions";
import { refreshAdminRequestsUnreadBadge } from "@/lib/requests/unread-badge";
import type { FormInboxMessage, FormInboxMessageSummary } from "@mccoy/email/contracts";
import { mergeInquiryThreads } from "../lib/merge-thread";

export type DetailState = "idle" | "loading" | "error";
export type ThreadSyncState = "idle" | "syncing" | "error";

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
  const [threadSyncState, setThreadSyncState] = React.useState<ThreadSyncState>("idle");
  const [threadSyncError, setThreadSyncError] = React.useState<string | null>(null);
  const selectedIdRef = React.useRef<string | null>(null);
  const threadSyncInFlight = React.useRef<{
    id: string;
    promise: Promise<void>;
  } | null>(null);

  const applyThreadInBackground = React.useCallback(
    (id: string, options?: { silent?: boolean }): Promise<void> => {
      const existing = threadSyncInFlight.current;
      if (existing?.id === id) return existing.promise;
      const silent = options?.silent === true;
      if (!silent && selectedIdRef.current === id) {
        setThreadSyncState("syncing");
        setThreadSyncError(null);
      }

      // Root getAdminFormInboxMessage already hydrates reply files; this only
      // syncs newly arrived Graph conversation messages without replacing chips.
      const promise = getAdminFormInboxThread({ data: { id } })
        .then((threadResult) => {
          if (!threadResult.ok) {
            if (!silent && selectedIdRef.current === id) {
              setThreadSyncState("error");
              setThreadSyncError(threadResult.error);
            }
            return;
          }
          setDetail((prev) =>
            prev && prev.id === id
              ? { ...prev, thread: mergeInquiryThreads(threadResult.thread, prev.thread) }
              : prev,
          );
          if (!silent && selectedIdRef.current === id) {
            setThreadSyncState("idle");
            setThreadSyncError(null);
          }
        })
        .catch(() => {
          if (!silent && selectedIdRef.current === id) {
            setThreadSyncState("error");
            setThreadSyncError(
              "Klantreacties konden niet uit de mailbox worden bijgewerkt. Probeer het opnieuw.",
            );
          }
          /* keep the already persisted thread */
        })
        .finally(() => {
          if (threadSyncInFlight.current?.promise === promise) {
            threadSyncInFlight.current = null;
          }
        });

      threadSyncInFlight.current = { id, promise };
      return promise;
    },
    [],
  );

  const loadDetail = React.useCallback(
    async (id: string, options?: { soft?: boolean }) => {
      const soft = options?.soft === true;
      selectedIdRef.current = id;
      setSelectedId(id);
      if (!soft) {
        setDetailState("loading");
        setDetailError(null);
        setThreadSyncState("idle");
        setThreadSyncError(null);
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
        void applyThreadInBackground(id, { silent: soft });

        if (!soft && result.notificationReadCount > 0) {
          refreshAdminRequestsUnreadBadge();
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
      void applyThreadInBackground(id, { silent: true });
    },
    [applyThreadInBackground],
  );

  const refreshDetail = React.useCallback(
    (id: string) => {
      void applyThreadInBackground(id);
    },
    [applyThreadInBackground],
  );

  const closeDetail = React.useCallback(() => {
    selectedIdRef.current = null;
    setSelectedId(null);
    setDetail(null);
    setDetailState("idle");
    setDetailError(null);
    setThreadSyncState("idle");
    setThreadSyncError(null);
  }, []);

  return {
    selectedId,
    detail,
    setDetail,
    detailState,
    detailError,
    threadSyncState,
    threadSyncError,
    loadDetail,
    softRefreshDetail,
    refreshDetail,
    closeDetail,
  };
}
