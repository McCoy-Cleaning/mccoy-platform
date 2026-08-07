import * as React from "react";
import {
  shouldRefreshInquiriesForNotification,
  subscribePlatformEvents,
} from "@/lib/platform-events";

const DEFAULT_DEBOUNCE_MS = 600;

/**
 * When a `requests` / website_request notification arrives (Realtime → toast),
 * refresh the Aanvragen list so new form submissions appear without a manual Vernieuwen.
 * Also soft-refreshes an open Gesprek so applicant replies appear in the thread.
 */
export function useInquiriesRealtimeRefresh(options: {
  loadList: () => void | Promise<void>;
  /** Open inquiry id — soft-refresh Gesprek when a reply notification arrives. */
  selectedId?: string | null;
  softRefreshDetail?: (id: string) => void;
  debounceMs?: number;
}): void {
  const {
    loadList,
    selectedId = null,
    softRefreshDetail,
    debounceMs = DEFAULT_DEBOUNCE_MS,
  } = options;
  const loadListRef = React.useRef(loadList);
  loadListRef.current = loadList;
  const selectedIdRef = React.useRef(selectedId);
  selectedIdRef.current = selectedId;
  const softRefreshDetailRef = React.useRef(softRefreshDetail);
  softRefreshDetailRef.current = softRefreshDetail;

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = subscribePlatformEvents((event) => {
      if (!shouldRefreshInquiriesForNotification(event)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void loadListRef.current();
        const id = selectedIdRef.current;
        if (id && softRefreshDetailRef.current) {
          softRefreshDetailRef.current(id);
        }
      }, debounceMs);
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [debounceMs]);
}
