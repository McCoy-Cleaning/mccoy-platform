import { afterEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import * as React from "react";
import { useInquiryMailboxWatch } from "../hooks/useInquiryMailboxWatch";

function setDocumentHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    enumerable: true,
    get: () => hidden,
  });
}

describe("useInquiryMailboxWatch", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.useRealTimers();
    vi.clearAllMocks();
    setDocumentHidden(false);
  });

  function mount(options: {
    selectedId: string | null;
    softRefreshDetail: (id: string) => void;
    intervalMs?: number;
    focusDebounceMs?: number;
  }) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    function Harness({ selectedId }: { selectedId: string | null }) {
      useInquiryMailboxWatch({
        selectedId,
        softRefreshDetail: options.softRefreshDetail,
        intervalMs: options.intervalMs ?? 200,
        focusDebounceMs: options.focusDebounceMs ?? 50,
      });
      return null;
    }

    act(() => {
      root.render(<Harness selectedId={options.selectedId} />);
    });

    return {
      rerender: (selectedId: string | null) => {
        act(() => {
          root.render(<Harness selectedId={selectedId} />);
        });
      },
    };
  }

  it("polls while visible + selected", async () => {
    vi.useFakeTimers();
    setDocumentHidden(false);
    const softRefreshDetail = vi.fn();
    mount({
      selectedId: "req:website-requests:abc",
      softRefreshDetail,
    });

    expect(softRefreshDetail).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(199);
    });
    expect(softRefreshDetail).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(softRefreshDetail).toHaveBeenCalledTimes(1);
    expect(softRefreshDetail).toHaveBeenCalledWith("req:website-requests:abc");

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(softRefreshDetail).toHaveBeenCalledTimes(2);
  });

  it("does not poll when hidden", async () => {
    vi.useFakeTimers();
    setDocumentHidden(true);
    const softRefreshDetail = vi.fn();
    mount({
      selectedId: "req:website-requests:abc",
      softRefreshDetail,
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(softRefreshDetail).not.toHaveBeenCalled();

    setDocumentHidden(false);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      vi.advanceTimersByTime(50);
    });
    expect(softRefreshDetail).toHaveBeenCalledTimes(1);
    softRefreshDetail.mockClear();

    setDocumentHidden(true);
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(softRefreshDetail).not.toHaveBeenCalled();
  });

  it("syncs on focus", async () => {
    vi.useFakeTimers();
    setDocumentHidden(false);
    const softRefreshDetail = vi.fn();
    mount({
      selectedId: "req:website-requests:abc",
      softRefreshDetail,
      intervalMs: 10_000,
      focusDebounceMs: 50,
    });

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(softRefreshDetail).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(49);
    });
    expect(softRefreshDetail).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(softRefreshDetail).toHaveBeenCalledTimes(1);
    expect(softRefreshDetail).toHaveBeenCalledWith("req:website-requests:abc");
  });

  it("stops when selectedId is null", async () => {
    vi.useFakeTimers();
    setDocumentHidden(false);
    const softRefreshDetail = vi.fn();
    const { rerender } = mount({
      selectedId: "req:website-requests:abc",
      softRefreshDetail,
    });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });
    expect(softRefreshDetail).toHaveBeenCalledTimes(1);

    rerender(null);
    softRefreshDetail.mockClear();

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(softRefreshDetail).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(softRefreshDetail).not.toHaveBeenCalled();
  });
});
