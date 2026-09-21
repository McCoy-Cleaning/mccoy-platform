import * as React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { InquiriesList } from "../components/InquiriesList";
import type { FormInboxMessageSummary } from "@mccoy/email/contracts";

function summary(id: string): FormInboxMessageSummary {
  return {
    id,
    uid: 1,
    kind: "inquiry",
    from: "a@example.com",
    to: "inbox@mccoy.nl",
    subject: "Hallo",
    date: "2026-08-01T10:00:00.000Z",
    snippet: "",
    unread: false,
    submitterName: "Ada",
    submitterEmail: "a@example.com",
    requestNumber: null,
    scopeKey: null,
    scopeLabel: null,
  };
}

let mounted: { container: HTMLDivElement; root: Root } | null = null;

function mount(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  mounted = { container, root };
  return container;
}

afterEach(() => {
  if (mounted) {
    act(() => mounted!.root.unmount());
    mounted.container.remove();
    mounted = null;
  }
});

const baseProps = {
  listError: null as string | null,
  listErrorCode: null as string | null,
  items: [] as FormInboxMessageSummary[],
  displayItems: [] as FormInboxMessageSummary[],
  debouncedQ: "",
  scopeKey: "all" as const,
  selectedIds: new Set<string>(),
  listDeleteBusy: false,
  listDeleteError: null as string | null,
  listDeleteTargetId: null as string | null,
  bulkDeleteOpen: false,
  listDeleteStatus: null as string | null,
  pinStatus: null as string | null,
  statusToast: null as string | null,
  allVisibleSelected: false,
  someVisibleSelected: false,
  isPinned: () => false,
  onRetry: vi.fn(),
  onToggleSelectAll: vi.fn(),
  onBulkDelete: vi.fn(),
  onToggleSelected: vi.fn(),
  onOpenDetail: vi.fn(),
  onTogglePin: vi.fn(),
  onRequestDelete: vi.fn(),
  onUpdateStatus: vi.fn(),
  isStatusSaving: () => false,
  statusErrorFor: () => null,
};

describe("InquiriesList async states", () => {
  it("shows loading", () => {
    const container = mount(<InquiriesList {...baseProps} listState="loading" />);
    expect(container.textContent).toContain("Berichten laden");
  });

  it("keeps rows visible while refreshing", () => {
    const items = [summary("1")];
    const container = mount(
      <InquiriesList
        {...baseProps}
        listState="ready"
        refreshing
        items={items}
        displayItems={items}
      />,
    );
    expect(container.textContent).toContain("Ada");
    expect(container.textContent).toContain("Vernieuwen");
    expect(container.textContent).not.toContain("Berichten laden");
  });

  it("shows empty state", () => {
    const container = mount(
      <InquiriesList {...baseProps} listState="ready" items={[]} displayItems={[]} />,
    );
    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      "Geen berichten gevonden",
    );
  });

  it("shows config error help", () => {
    const container = mount(
      <InquiriesList
        {...baseProps}
        listState="error"
        listError="Config ontbreekt"
        listErrorCode="config"
      />,
    );
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    expect(container.textContent).toContain("Mailbox niet geconfigureerd");
    expect(container.textContent).toContain("FORM_INBOX_PROVIDER=imap");
  });

  it("renders rows when ready", () => {
    const items = [summary("1")];
    const container = mount(
      <InquiriesList {...baseProps} listState="ready" items={items} displayItems={items} />,
    );
    expect(container.textContent).toContain("Ada");
  });
});

function keydown(target: Element, key: string) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

describe("InquiriesList inquiry status control", () => {
  it("renders the status control for request-backed rows with the Dutch label", () => {
    const items = [summary("1")];
    (items[0] as FormInboxMessageSummary).requestNumber = "WR-2026-00074";
    (items[0] as FormInboxMessageSummary).inquiryStatus = "in_progress";
    const container = mount(
      <InquiriesList {...baseProps} listState="ready" items={items} displayItems={items} />,
    );
    const trigger = container.querySelector('button[aria-haspopup="listbox"]');
    expect(trigger).toBeTruthy();
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).toContain("In behandeling");
  });

  it("hides the status control for mailbox-only rows (no requestNumber)", () => {
    const items = [summary("1")]; // requestNumber: null
    const container = mount(
      <InquiriesList {...baseProps} listState="ready" items={items} displayItems={items} />,
    );
    expect(container.querySelector('button[aria-haspopup="listbox"]')).toBeNull();
  });

  it("opens a styled listbox and calls onUpdateStatus when staff selects a status", () => {
    const items = [summary("1")];
    (items[0] as FormInboxMessageSummary).requestNumber = "WR-2026-00074";
    (items[0] as FormInboxMessageSummary).inquiryStatus = "new";
    const onUpdateStatus = vi.fn();
    const container = mount(
      <InquiriesList
        {...baseProps}
        listState="ready"
        items={items}
        displayItems={items}
        onUpdateStatus={onUpdateStatus}
      />,
    );
    const trigger = container.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement;

    // Open the listbox.
    act(() => {
      trigger.click();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const listbox = document.body.querySelector('[role="listbox"]');
    expect(listbox).toBeTruthy();
    const options = document.body.querySelectorAll('[role="option"]');
    expect(options.length).toBe(3);
    expect(document.body.textContent).toContain("Gefactureerd");

    // Keyboard-select the last option (End → Enter) and confirm the callback.
    act(() => {
      keydown(trigger, "End");
    });
    act(() => {
      keydown(trigger, "Enter");
    });
    expect(onUpdateStatus).toHaveBeenCalledWith("1", "invoiced");
  });

  it("shows the status toast bar", () => {
    const container = mount(
      <InquiriesList
        {...baseProps}
        listState="ready"
        items={[]}
        displayItems={[]}
        statusToast="Status ingesteld op Gefactureerd."
      />,
    );
    expect(container.textContent).toContain("Status ingesteld op Gefactureerd.");
  });
});

describe("InquiriesList lifecycle visibility", () => {
  it("makes a reopened customer reply stand out in the active list", () => {
    const reopened = {
      ...summary("reopened"),
      lifecycleStatus: "open" as const,
      unread: true,
    };
    const container = mount(
      <InquiriesList
        {...baseProps}
        listState="ready"
        items={[reopened]}
        displayItems={[reopened]}
      />,
    );

    expect(container.textContent).toContain("Nieuwe reactie");
    expect(container.querySelector("li")?.className).toContain("bg-cyan-400");
  });

  it("removes unread decoration after an open request has been read", () => {
    const readOpenRequest = {
      ...summary("read-open"),
      lifecycleStatus: "open" as const,
      unread: false,
    };
    const container = mount(
      <InquiriesList
        {...baseProps}
        listState="ready"
        items={[readOpenRequest]}
        displayItems={[readOpenRequest]}
      />,
    );

    expect(container.textContent).not.toContain("Nieuwe reactie");
    expect(container.querySelector("li")?.className).not.toContain("bg-cyan-400");
    expect(container.querySelector('[aria-label="Ongelezen"]')).toBeNull();
  });

  it("labels resolved rows in the Afgerond section", () => {
    const resolved = { ...summary("resolved"), lifecycleStatus: "closed" as const };
    const container = mount(
      <InquiriesList
        {...baseProps}
        lifecycle="resolved"
        listState="ready"
        items={[resolved]}
        displayItems={[resolved]}
      />,
    );

    expect(container.textContent).toContain("Afgerond");
  });
});
