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
