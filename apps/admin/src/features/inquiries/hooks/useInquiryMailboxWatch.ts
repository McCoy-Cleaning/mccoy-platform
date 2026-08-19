import * as React from "react";

export const MAILBOX_WATCH_INTERVAL_MS = 9_000;
export const MAILBOX_WATCH_FOCUS_DEBOUNCE_MS = 1_000;

/**
 * Graph mailbox replies never emit a Supabase `requests` notification, so an
 * open Gesprek would stay stale until Vernieuwen / F5. While a conversation is
 * selected and this admin tab is visible, soft-refresh the thread on a short
 * interval. Pause when the tab is hidden; sync immediately (debounced) on
 * visibility/focus so switching back picks up a reply that already landed.
 *
 * Thread-only: does not call `loadList({ fresh: true })`.
 */
export function useInquiryMailboxWatch(options: {
  selectedId: string | null;
  softRefreshDetail: (id: string) => void;
  intervalMs?: number;
  focusDebounceMs?: number;
}): void {
  const {
    selectedId,
    softRefreshDetail,
    intervalMs = MAILBOX_WATCH_INTERVAL_MS,
    focusDebounceMs = MAILBOX_WATCH_FOCUS_DEBOUNCE_MS,
  } = options;

  const selectedIdRef = React.useRef(selectedId);
  selectedIdRef.current = selectedId;
  const softRefreshDetailRef = React.useRef(softRefreshDetail);
  softRefreshDetailRef.current = softRefreshDetail;

  React.useEffect(() => {
    if (!selectedId) return;

    let intervalId: ReturnType<typeof setInterval> | undefined;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;

    const sync = () => {
      const id = selectedIdRef.current;
      if (!id) return;
      if (typeof document !== "undefined" && document.hidden) return;
      softRefreshDetailRef.current(id);
    };

    const syncDebounced = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(sync, focusDebounceMs);
    };

    const startPolling = () => {
      if (intervalId !== undefined) return;
      intervalId = setInterval(sync, intervalMs);
    };

    const stopPolling = () => {
      if (intervalId === undefined) return;
      clearInterval(intervalId);
      intervalId = undefined;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = undefined;
        }
        return;
      }
      startPolling();
      syncDebounced();
    };

    const onFocus = () => {
      if (document.hidden) return;
      syncDebounced();
    };

    if (!document.hidden) startPolling();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      stopPolling();
      if (debounceTimer) clearTimeout(debounceTimer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [selectedId, intervalMs, focusDebounceMs]);
}
