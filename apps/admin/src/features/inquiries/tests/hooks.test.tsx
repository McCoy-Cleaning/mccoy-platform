import * as React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { useInquiriesListQuery } from "../hooks/useInquiriesListQuery";
import { useInquirySelection } from "../hooks/useInquirySelection";
import { useInquiryListDeletes } from "../hooks/useInquiryListDeletes";
import { useInquiryReply } from "../hooks/useInquiryReply";
import { useInquiryDetailDelete } from "../hooks/useInquiryDetailDelete";
import type { FormInboxMessage, FormInboxMessageSummary } from "@mccoy/email/contracts";

vi.mock("@/lib/api/admin-requests.functions", () => ({
  listAdminFormInbox: vi.fn(),
  markAdminRequestNotificationsReadForEntity: vi.fn(async () => ({ ok: true, count: 0 })),
  deleteAdminFormInboxMessage: vi.fn(),
  bulkDeleteAdminFormInboxMessages: vi.fn(),
  replyAdminFormInboxMessage: vi.fn(),
  getAdminFormInboxMessage: vi.fn(),
  getAdminFormInboxThread: vi.fn(),
  getAdminFormInboxAttachment: vi.fn(),
}));

vi.mock("@/lib/requests/unread-badge", () => ({
  refreshAdminRequestsUnreadBadge: vi.fn(),
}));

import {
  listAdminFormInbox,
  deleteAdminFormInboxMessage,
  bulkDeleteAdminFormInboxMessages,
  replyAdminFormInboxMessage,
} from "@/lib/api/admin-requests.functions";

const listAdminFormInboxMock = vi.mocked(listAdminFormInbox);
const deleteAdminFormInboxMessageMock = vi.mocked(deleteAdminFormInboxMessage);
const bulkDeleteAdminFormInboxMessagesMock = vi.mocked(bulkDeleteAdminFormInboxMessages);
const replyAdminFormInboxMessageMock = vi.mocked(replyAdminFormInboxMessage);

function summary(
  id: string,
  extra: Partial<FormInboxMessageSummary> = {},
): FormInboxMessageSummary {
  return {
    id,
    uid: 1,
    kind: "inquiry",
    from: "a@example.com",
    to: "inbox@mccoy.nl",
    subject: "Hallo",
    date: "2026-08-01T10:00:00.000Z",
    snippet: "",
    unread: true,
    submitterName: "Ada",
    submitterEmail: "a@example.com",
    requestNumber: null,
    scopeKey: null,
    scopeLabel: null,
    ...extra,
  };
}

function detailMessage(id: string): FormInboxMessage {
  return {
    ...summary(id),
    textBody: "body",
    htmlSafePreview: "",
    replyToHeader: null,
    messageId: null,
    fields: [],
    attachments: [],
    thread: [],
  };
}

type HookProbe = {
  latest: unknown;
};

function mountHook<T>(useHook: () => T): {
  container: HTMLDivElement;
  root: Root;
  probe: HookProbe;
} {
  const probe: HookProbe = { latest: null };
  function Probe() {
    probe.latest = useHook();
    return null;
  }
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<Probe />);
  });
  return { container, root, probe };
}

let mounted: { container: HTMLDivElement; root: Root } | null = null;

afterEach(() => {
  if (mounted) {
    act(() => mounted!.root.unmount());
    mounted.container.remove();
    mounted = null;
  }
  vi.clearAllMocks();
});

describe("useInquiriesListQuery", () => {
  beforeEach(() => {
    listAdminFormInboxMock.mockReset();
  });

  it("loads list success", async () => {
    listAdminFormInboxMock.mockResolvedValue({
      ok: true,
      items: [summary("1")],
      facets: { scopes: [{ key: "test", label: "Test", count: 1 }] },
      showAll: false,
    } as never);

    const { container, root, probe } = mountHook(() =>
      useInquiriesListQuery({ kind: "all", scopeKey: "all", debouncedQ: "" }),
    );
    mounted = { container, root };

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const state = probe.latest as ReturnType<typeof useInquiriesListQuery>;
    expect(state.listState).toBe("ready");
    expect(state.items).toHaveLength(1);
    expect(state.scopeFacets[0]?.key).toBe("test");
    expect(state.initialLoading).toBe(false);
  });

  it("surfaces provider config error", async () => {
    listAdminFormInboxMock.mockResolvedValue({
      ok: false,
      error: "Mailbox niet geconfigureerd",
      code: "config",
    } as never);

    const { container, root, probe } = mountHook(() =>
      useInquiriesListQuery({ kind: "all", scopeKey: "all", debouncedQ: "" }),
    );
    mounted = { container, root };

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const state = probe.latest as ReturnType<typeof useInquiriesListQuery>;
    expect(state.listState).toBe("error");
    expect(state.listErrorCode).toBe("config");
    expect(state.listError).toContain("Mailbox");
  });

  it("keeps existing items visible while refreshing", async () => {
    let resolveRefresh: ((value: unknown) => void) | null = null;
    listAdminFormInboxMock
      .mockResolvedValueOnce({
        ok: true,
        items: [summary("1"), summary("2")],
        facets: { scopes: [] },
        showAll: false,
      } as never)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveRefresh = resolve;
          }) as never,
      );

    const { container, root, probe } = mountHook(() =>
      useInquiriesListQuery({ kind: "all", scopeKey: "all", debouncedQ: "" }),
    );
    mounted = { container, root };

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect((probe.latest as ReturnType<typeof useInquiriesListQuery>).items).toHaveLength(2);

    await act(async () => {
      void (probe.latest as ReturnType<typeof useInquiriesListQuery>).loadList();
      await Promise.resolve();
    });

    const refreshing = probe.latest as ReturnType<typeof useInquiriesListQuery>;
    expect(refreshing.refreshing).toBe(true);
    expect(refreshing.listState).toBe("ready");
    expect(refreshing.items).toHaveLength(2);

    await act(async () => {
      resolveRefresh?.({
        ok: true,
        items: [summary("1"), summary("2"), summary("3")],
        facets: { scopes: [] },
        showAll: false,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    const done = probe.latest as ReturnType<typeof useInquiriesListQuery>;
    expect(done.refreshing).toBe(false);
    expect(done.items).toHaveLength(3);
  });

  it("does not restore deleted ids when a stale refresh arrives", async () => {
    let resolveStale: ((value: unknown) => void) | null = null;
    listAdminFormInboxMock
      .mockResolvedValueOnce({
        ok: true,
        items: [summary("a"), summary("b"), summary("c")],
        facets: { scopes: [] },
        showAll: false,
      } as never)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveStale = resolve;
          }) as never,
      );

    type Combined = {
      list: ReturnType<typeof useInquiriesListQuery>;
      deletes: ReturnType<typeof useInquiryListDeletes>;
    };

    let itemsState: FormInboxMessageSummary[] = [];
    let selected = new Set<string>(["a", "b"]);

    const { container, root, probe } = mountHook(() => {
      const list = useInquiriesListQuery({ kind: "all", scopeKey: "all", debouncedQ: "" });
      itemsState = list.items;
      const deletes = useInquiryListDeletes({
        items: list.items,
        selectedIds: selected,
        setSelectedIds: (updater) => {
          selected = typeof updater === "function" ? updater(selected) : updater;
        },
        setItems: list.setItems,
        removePins: () => undefined,
        registerTombstones: list.registerTombstones,
        clearTombstones: list.clearTombstones,
        selectedId: null,
        closeDetail: () => undefined,
      });
      return { list, deletes } satisfies Combined;
    });
    mounted = { container, root };

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(itemsState.map((i) => i.id)).toEqual(["a", "b", "c"]);

    await act(async () => {
      void (probe.latest as Combined).list.loadList();
      await Promise.resolve();
    });

    bulkDeleteAdminFormInboxMessagesMock.mockResolvedValue({
      ok: true,
      deletedCount: 2,
      deletedIds: ["a", "b"],
      failures: [],
      results: [
        { messageId: "a", status: "deleted" },
        { messageId: "b", status: "deleted" },
      ],
    } as never);

    await act(async () => {
      await (probe.latest as Combined).deletes.performBulkDelete();
    });

    expect((probe.latest as Combined).list.items.map((i) => i.id)).toEqual(["c"]);

    await act(async () => {
      resolveStale?.({
        ok: true,
        items: [summary("a"), summary("b"), summary("c")],
        facets: { scopes: [] },
        showAll: false,
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect((probe.latest as Combined).list.items.map((i) => i.id)).toEqual(["c"]);
  });
});

describe("useInquirySelection", () => {
  it("clears selection on filter change and drops invisible ids", async () => {
    type Props = {
      items: FormInboxMessageSummary[];
      kind: "all" | "inquiry";
    };
    const probe: HookProbe = { latest: null };

    function Harness({ items, kind }: Props) {
      probe.latest = useInquirySelection({ items, kind, scopeKey: "all", debouncedQ: "" });
      return null;
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted = { container, root };

    act(() => {
      root.render(<Harness items={[summary("a"), summary("b")]} kind="all" />);
    });

    act(() => {
      (probe.latest as ReturnType<typeof useInquirySelection>).toggleSelected("a", true);
      (probe.latest as ReturnType<typeof useInquirySelection>).toggleSelected("b", true);
    });
    expect((probe.latest as ReturnType<typeof useInquirySelection>).selectedIds.size).toBe(2);

    act(() => {
      root.render(<Harness items={[summary("a")]} kind="all" />);
    });
    expect([...(probe.latest as ReturnType<typeof useInquirySelection>).selectedIds]).toEqual([
      "a",
    ]);

    act(() => {
      root.render(<Harness items={[summary("a")]} kind="inquiry" />);
    });
    expect((probe.latest as ReturnType<typeof useInquirySelection>).selectedIds.size).toBe(0);
  });
});

describe("useInquiryListDeletes", () => {
  it("optimistically removes a row and restores it on Graph failure without refetch", async () => {
    deleteAdminFormInboxMessageMock.mockResolvedValue({
      ok: false,
      error: "Verwijderen geweigerd",
    } as never);

    let items = [summary("x"), summary("y")];
    const setItems: React.Dispatch<React.SetStateAction<FormInboxMessageSummary[]>> = (updater) => {
      items = typeof updater === "function" ? updater(items) : updater;
    };
    const removePins = vi.fn();
    const registerTombstones = vi.fn();
    const clearTombstones = vi.fn();
    const loadList = vi.fn();

    const { container, root, probe } = mountHook(() =>
      useInquiryListDeletes({
        items,
        selectedIds: new Set(),
        setSelectedIds: vi.fn(),
        setItems,
        removePins,
        registerTombstones,
        clearTombstones,
        selectedId: null,
        closeDetail: () => undefined,
      }),
    );
    mounted = { container, root };

    act(() => {
      (probe.latest as ReturnType<typeof useInquiryListDeletes>).setListDeleteTargetId("x");
    });

    await act(async () => {
      await (probe.latest as ReturnType<typeof useInquiryListDeletes>).performListSingleDelete();
    });

    const state = probe.latest as ReturnType<typeof useInquiryListDeletes>;
    expect(state.listDeleteError).toMatch(/teruggezet|niet worden verwijderd/i);
    expect(state.listDeleteTargetId).toBeNull();
    expect(state.listDeleteBusy).toBe(false);
    expect(items.map((i) => i.id)).toEqual(["x", "y"]);
    expect(loadList).not.toHaveBeenCalled();
    expect(clearTombstones).toHaveBeenCalledWith(["x"]);
  });

  it("keeps successful deletes removed on partial bulk failure", async () => {
    bulkDeleteAdminFormInboxMessagesMock.mockResolvedValue({
      ok: true,
      partial: true,
      deletedCount: 1,
      deletedIds: ["1"],
      failures: [{ id: "2", error: "fail" }],
      results: [
        { messageId: "1", status: "deleted" },
        { messageId: "2", status: "failed" },
      ],
    } as never);

    let items = [summary("1"), summary("2"), summary("3")];
    const setItems: React.Dispatch<React.SetStateAction<FormInboxMessageSummary[]>> = (updater) => {
      items = typeof updater === "function" ? updater(items) : updater;
    };

    const { container, root, probe } = mountHook(() =>
      useInquiryListDeletes({
        items,
        selectedIds: new Set(["1", "2"]),
        setSelectedIds: vi.fn(),
        setItems,
        removePins: vi.fn(),
        registerTombstones: vi.fn(),
        clearTombstones: vi.fn(),
        selectedId: null,
        closeDetail: () => undefined,
      }),
    );
    mounted = { container, root };

    await act(async () => {
      await (probe.latest as ReturnType<typeof useInquiryListDeletes>).performBulkDelete();
    });

    expect(items.map((i) => i.id)).toEqual(["2", "3"]);
    expect((probe.latest as ReturnType<typeof useInquiryListDeletes>).listDeleteError).toMatch(
      /1 van 2/,
    );
    expect((probe.latest as ReturnType<typeof useInquiryListDeletes>).retryFailedIds).toEqual([
      "2",
    ]);
    expect(bulkDeleteAdminFormInboxMessagesMock).toHaveBeenCalledWith({
      data: { ids: ["1", "2"] },
    });
  });

  it("sends every unique selected id for bulk delete of more than 20 messages", async () => {
    const ids = Array.from({ length: 25 }, (_, i) => `m${i}`);
    bulkDeleteAdminFormInboxMessagesMock.mockResolvedValue({
      ok: true,
      deletedCount: 25,
      deletedIds: ids,
      failures: [],
      results: ids.map((messageId) => ({ messageId, status: "deleted" as const })),
    } as never);

    let items = ids.map((id) => summary(id));
    const setItems: React.Dispatch<React.SetStateAction<FormInboxMessageSummary[]>> = (updater) => {
      items = typeof updater === "function" ? updater(items) : updater;
    };

    const { container, root, probe } = mountHook(() =>
      useInquiryListDeletes({
        items,
        selectedIds: new Set([...ids, ids[0]!]),
        setSelectedIds: vi.fn(),
        setItems,
        removePins: vi.fn(),
        registerTombstones: vi.fn(),
        clearTombstones: vi.fn(),
        selectedId: null,
        closeDetail: () => undefined,
      }),
    );
    mounted = { container, root };

    await act(async () => {
      await (probe.latest as ReturnType<typeof useInquiryListDeletes>).performBulkDelete();
    });

    expect(bulkDeleteAdminFormInboxMessagesMock).toHaveBeenCalledTimes(1);
    const sent = bulkDeleteAdminFormInboxMessagesMock.mock.calls[0]?.[0] as {
      data: { ids: string[] };
    };
    expect(sent.data.ids).toHaveLength(25);
    expect(new Set(sent.data.ids).size).toBe(25);
    expect(items).toHaveLength(0);
    expect((probe.latest as ReturnType<typeof useInquiryListDeletes>).listDeleteStatus).toBe(
      "25 e-mails verwijderd",
    );
  });
});

describe("useInquiryReply", () => {
  it("preserves reply text on failure", async () => {
    replyAdminFormInboxMessageMock.mockResolvedValue({
      ok: false,
      error: "SMTP down",
    } as never);

    let reply = "Dit is mijn antwoord";
    const setReply = vi.fn((updater: unknown) => {
      reply =
        typeof updater === "function" ? (updater as (v: string) => string)(reply) : String(updater);
    });
    const onAppendReply = vi.fn();
    const onRefreshDetail = vi.fn();

    const { container, root, probe } = mountHook(() =>
      useInquiryReply({
        detail: detailMessage("m1"),
        reply,
        setReply,
        onAppendReply,
        onRefreshDetail,
      }),
    );
    mounted = { container, root };

    await act(async () => {
      await (probe.latest as ReturnType<typeof useInquiryReply>).performSend();
    });

    expect((probe.latest as ReturnType<typeof useInquiryReply>).replyError).toBe("SMTP down");
    // Failure path clears then restores the draft so the textarea keeps the user's text.
    expect(setReply).toHaveBeenCalledWith("");
    expect(setReply).toHaveBeenCalledWith("Dit is mijn antwoord");
    expect(reply).toBe("Dit is mijn antwoord");
    expect(onAppendReply).toHaveBeenCalled();
  });

  it("clears reply on success", async () => {
    replyAdminFormInboxMessageMock.mockResolvedValue({
      ok: true,
      toEmail: "a@example.com",
      resendId: "r1",
    } as never);

    let reply = "OK tekst";
    const setReply = vi.fn((updater: unknown) => {
      reply =
        typeof updater === "function" ? (updater as (v: string) => string)(reply) : String(updater);
    });

    const { container, root, probe } = mountHook(() =>
      useInquiryReply({
        detail: detailMessage("m1"),
        reply,
        setReply,
        onAppendReply: vi.fn(),
        onRefreshDetail: vi.fn(),
      }),
    );
    mounted = { container, root };

    await act(async () => {
      await (probe.latest as ReturnType<typeof useInquiryReply>).performSend();
    });

    expect(setReply).toHaveBeenCalledWith("");
    expect((probe.latest as ReturnType<typeof useInquiryReply>).replySuccess).toContain(
      "a@example.com",
    );
  });
});

describe("useInquiryDetailDelete", () => {
  it("preserves error when delete fails", async () => {
    deleteAdminFormInboxMessageMock.mockResolvedValue({
      ok: false,
      error: "Kan niet verwijderen",
    } as never);

    const onDeleted = vi.fn();
    const { container, root, probe } = mountHook(() =>
      useInquiryDetailDelete({ detail: detailMessage("d1"), onDeleted }),
    );
    mounted = { container, root };

    act(() => {
      (probe.latest as ReturnType<typeof useInquiryDetailDelete>).setDeleteOpen(true);
    });

    await act(async () => {
      await (probe.latest as ReturnType<typeof useInquiryDetailDelete>).performDelete();
    });

    const state = probe.latest as ReturnType<typeof useInquiryDetailDelete>;
    expect(state.deleteError).toBe("Kan niet verwijderen");
    expect(state.deleteOpen).toBe(true);
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
