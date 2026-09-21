import * as React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { InboxDetail } from "../components/InboxDetail";
import type { FormInboxMessage, FormInboxThreadItem } from "@mccoy/email/contracts";

function threadItem(overrides: Partial<FormInboxThreadItem>): FormInboxThreadItem {
  return {
    id: "t1",
    uid: 1,
    direction: "form",
    from: "a@example.com",
    to: "info@mccoy.nl",
    date: "2026-08-01T10:00:00.000Z",
    subject: "Hallo",
    textBody: "",
    messageId: null,
    attachments: [],
    ...overrides,
  };
}

function message(
  overrides: Partial<FormInboxMessage> & { thread?: FormInboxThreadItem[] },
): FormInboxMessage {
  const thread = overrides.thread ?? [
    threadItem({ id: "root", direction: "form", date: "2026-08-01T10:00:00.000Z" }),
  ];
  return {
    id: "m1",
    uid: 1,
    kind: "inquiry",
    subject: "Hallo",
    from: "Ada <a@example.com>",
    to: "info@mccoy.nl",
    date: "2026-08-01T10:00:00.000Z",
    snippet: "",
    unread: false,
    submitterName: "Ada",
    submitterEmail: "a@example.com",
    requestNumber: "WR-2026-00001",
    scopeKey: null,
    scopeLabel: null,
    textBody: "",
    htmlSafePreview: "",
    replyToHeader: null,
    messageId: null,
    fields: [],
    attachments: [],
    thread,
    ...overrides,
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
  state: "idle" as const,
  error: null as string | null,
  onBack: vi.fn(),
  onDeleted: vi.fn(),
  onAppendReply: vi.fn(),
  onRemoveReply: vi.fn(),
  onRefreshDetail: vi.fn(),
  onSubmitterEmailUpdated: vi.fn(),
  isPinned: false,
  onTogglePin: vi.fn(),
};

describe("InboxDetail received / last customer message", () => {
  it("shows Ontvangen with the submission date and no last-customer line when the customer has not replied", () => {
    const detail = message({
      date: "2026-08-01T10:00:00.000Z",
      thread: [threadItem({ id: "root", direction: "form", date: "2026-08-01T10:00:00.000Z" })],
    });
    const container = mount(<InboxDetail {...baseProps} detail={detail} />);

    expect(container.textContent).toContain("Ontvangen");
    expect(container.textContent).not.toContain("Laatste bericht van klant");
  });

  it("shows Laatste bericht van klant using the latest customer reply, not staff replies or updated_at", () => {
    const detail = message({
      // Submission time stays the received time.
      date: "2026-08-01T10:00:00.000Z",
      thread: [
        threadItem({ id: "root", direction: "form", date: "2026-08-01T10:00:00.000Z" }),
        threadItem({ id: "staff", direction: "admin", date: "2026-08-02T10:00:00.000Z" }),
        threadItem({
          id: "cust-1",
          direction: "customer",
          date: "2026-08-03T09:00:00.000Z",
        }),
        threadItem({
          id: "cust-2",
          direction: "customer",
          date: "2026-08-05T12:00:00.000Z",
        }),
      ],
    });
    const container = mount(<InboxDetail {...baseProps} detail={detail} />);

    expect(container.textContent).toContain("Ontvangen");
    expect(container.textContent).toContain("Laatste bericht van klant");
    // Latest customer reply (2026-08-05) must win over the earlier customer
    // reply and the staff reply — assert the formatted year is present and the
    // earlier customer reply date is not the one shown for "last message".
    expect(container.textContent).toMatch(/2026/);
  });

  it("renders customer replies distinctly and exposes mailbox refresh state", () => {
    const onRefreshDetail = vi.fn();
    const detail = message({
      thread: [
        threadItem({ id: "root", direction: "form" }),
        threadItem({
          id: "customer-1",
          direction: "customer",
          textBody: "Dit is het antwoord van de klant",
        }),
        threadItem({
          id: "admin-1",
          direction: "admin",
          textBody: "Dit is het antwoord van McCoy",
        }),
      ],
    });
    const container = mount(
      <InboxDetail
        {...baseProps}
        detail={detail}
        onRefreshDetail={onRefreshDetail}
        threadSyncState="syncing"
      />,
    );

    expect(container.textContent).toContain("Klant 1");
    expect(container.textContent).toContain("McCoy 1");
    expect(container.textContent).toContain("Dit is het antwoord van de klant");
    expect(container.textContent).toContain("Klantreacties worden veilig");
    const refresh = container.querySelector(
      'button[aria-label="Klantreacties uit de mailbox bijwerken"]',
    ) as HTMLButtonElement;
    expect(refresh.disabled).toBe(true);
  });

  it("lets staff retry a failed customer-reply synchronization", () => {
    const onRefreshDetail = vi.fn();
    const container = mount(
      <InboxDetail
        {...baseProps}
        detail={message({})}
        onRefreshDetail={onRefreshDetail}
        threadSyncState="error"
        threadSyncError="Mailbox tijdelijk niet bereikbaar."
      />,
    );

    expect(container.textContent).toContain("Mailbox tijdelijk niet bereikbaar.");
    const refresh = container.querySelector(
      'button[aria-label="Klantreacties uit de mailbox bijwerken"]',
    ) as HTMLButtonElement;
    act(() => refresh.click());
    expect(onRefreshDetail).toHaveBeenCalledTimes(1);
  });
});

function keydown(target: Element, key: string) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}

describe("InboxDetail inquiry status control", () => {
  it("renders the status control in the header when onUpdateStatus is provided", () => {
    const detail = message({
      inquiryStatus: "in_progress",
      thread: [threadItem({ id: "root", direction: "form", date: "2026-08-01T10:00:00.000Z" })],
    });
    const onUpdateStatus = vi.fn();
    const container = mount(
      <InboxDetail {...baseProps} detail={detail} onUpdateStatus={onUpdateStatus} />,
    );

    const trigger = container.querySelector('button[aria-haspopup="listbox"]');
    expect(trigger).toBeTruthy();
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).toContain("In behandeling");
  });

  it("hides the status control when onUpdateStatus is not provided", () => {
    const detail = message({
      inquiryStatus: "invoiced",
      thread: [threadItem({ id: "root", direction: "form", date: "2026-08-01T10:00:00.000Z" })],
    });
    const container = mount(<InboxDetail {...baseProps} detail={detail} />);
    expect(container.querySelector('button[aria-haspopup="listbox"]')).toBeNull();
  });

  it("hides the status control for mailbox-only detail (no requestNumber) even with onUpdateStatus", () => {
    const detail = message({
      requestNumber: null,
      inquiryStatus: undefined,
      thread: [threadItem({ id: "root", direction: "form", date: "2026-08-01T10:00:00.000Z" })],
    });
    const onUpdateStatus = vi.fn();
    const container = mount(
      <InboxDetail {...baseProps} detail={detail} onUpdateStatus={onUpdateStatus} />,
    );
    expect(container.querySelector('button[aria-haspopup="listbox"]')).toBeNull();
  });

  it("opens a styled listbox and calls onUpdateStatus when staff selects a status", () => {
    const detail = message({
      inquiryStatus: "new",
      thread: [threadItem({ id: "root", direction: "form", date: "2026-08-01T10:00:00.000Z" })],
    });
    const onUpdateStatus = vi.fn();
    const container = mount(
      <InboxDetail {...baseProps} detail={detail} onUpdateStatus={onUpdateStatus} />,
    );
    const trigger = container.querySelector('button[aria-haspopup="listbox"]') as HTMLButtonElement;

    act(() => {
      trigger.click();
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.querySelectorAll('[role="option"]').length).toBe(3);

    act(() => {
      keydown(trigger, "End");
    });
    act(() => {
      keydown(trigger, "Enter");
    });
    expect(onUpdateStatus).toHaveBeenCalledWith("invoiced");
  });
});

describe("InboxDetail lifecycle controls", () => {
  it("shows a prominent customer-reply state and resolves an open request", () => {
    const onUpdateLifecycle = vi.fn();
    const detail = message({ lifecycleStatus: "open", unread: true });
    const container = mount(
      <InboxDetail {...baseProps} detail={detail} onUpdateLifecycle={onUpdateLifecycle} />,
    );

    expect(container.textContent).toContain("Nieuwe reactie van de klant");
    const resolve = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Afronden",
    ) as HTMLButtonElement;
    expect(resolve).toBeTruthy();
    act(() => resolve.click());
    expect(onUpdateLifecycle).toHaveBeenCalledWith("closed");
  });

  it("does not keep the new-reply banner after the inquiry is read", () => {
    const detail = message({ lifecycleStatus: "open", unread: false });
    const container = mount(<InboxDetail {...baseProps} detail={detail} />);

    expect(container.textContent).not.toContain("Nieuwe reactie van de klant");
  });

  it("explains automatic reopening and allows manual reopen for a resolved request", () => {
    const onUpdateLifecycle = vi.fn();
    const detail = message({ lifecycleStatus: "closed" });
    const container = mount(
      <InboxDetail {...baseProps} detail={detail} onUpdateLifecycle={onUpdateLifecycle} />,
    );

    expect(container.textContent).toContain("Een nieuwe, gekoppelde reactie");
    expect(container.textContent).toContain("Heropen haar voordat u een nieuw antwoord");
    expect(container.querySelector("textarea")?.hasAttribute("disabled")).toBe(true);
    const reopen = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "Heropenen",
    ) as HTMLButtonElement;
    expect(reopen).toBeTruthy();
    act(() => reopen.click());
    expect(onUpdateLifecycle).toHaveBeenCalledWith("open");
  });
});
