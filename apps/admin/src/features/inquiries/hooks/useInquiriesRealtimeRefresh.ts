import * as React from "react";
import {
  shouldRefreshInquiriesForNotification,
  subscribePlatformEvents,
} from "@/lib/platform-events";

const DEFAULT_DEBOUNCE_MS = 600;

/**
 * When a `requests` / website_request notification arrives (Realtime → toast),
 * refresh the Aanvragen list so new form submissions appear without a manual Vernieuwen.
 */
export function useInquiriesRealtimeRefresh(options: {
  loadList: () => void | Promise<void>;
  debounceMs?: number;
}): void {
  const { loadList, debounceMs = DEFAULT_DEBOUNCE_MS } = options;
  const loadListRef = React.useRef(loadList);
  loadListRef.current = loadList;

  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const unsubscribe = subscribePlatformEvents((event) => {
      if (!shouldRefreshInquiriesForNotification(event)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void loadListRef.current();
      }, debounceMs);
    });

    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [debounceMs]);
}
