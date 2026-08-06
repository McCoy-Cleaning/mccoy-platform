import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as React from "react";
import {
  emitPlatformEvent,
  shouldRefreshInquiriesForNotification,
} from "@/lib/platform-events";
import { useInquiriesRealtimeRefresh } from "../hooks/useInquiriesRealtimeRefresh";

describe("shouldRefreshInquiriesForNotification", () => {
  it("refreshes for requests-category notifications", () => {
    expect(
      shouldRefreshInquiriesForNotification({
        type: "notification-received",
        notificationId: "n1",
        notificationType: "website_request.received",
        category: "requests",
      }),
    ).toBe(true);
  });

  it("ignores unrelated notification categories", () => {
    expect(
      shouldRefreshInquiriesForNotification({
        type: "notification-received",
        notificationId: "n2",
        notificationType: "cms.publish_failed",
        category: "cms",
      }),
    ).toBe(false);
  });

  it("ignores non-received events", () => {
    expect(
      shouldRefreshInquiriesForNotification({
        type: "notification-read",
        notificationId: "n3",
      }),
    ).toBe(false);
  });
});

describe("useInquiriesRealtimeRefresh", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("debounces loadList when a website_request notification arrives", async () => {
    vi.useFakeTimers();
    const loadList = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    function Harness() {
      useInquiriesRealtimeRefresh({ loadList, debounceMs: 200 });
      return null;
    }

    act(() => {
      root.render(<Harness />);
    });

    act(() => {
      emitPlatformEvent({
        type: "notification-received",
        notificationId: "n-new",
        notificationType: "website_request.received",
        category: "requests",
      });
      emitPlatformEvent({
        type: "notification-received",
        notificationId: "n-new-2",
        notificationType: "website_request.received",
        category: "requests",
      });
    });

    expect(loadList).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(loadList).toHaveBeenCalledTimes(1);
  });
});
