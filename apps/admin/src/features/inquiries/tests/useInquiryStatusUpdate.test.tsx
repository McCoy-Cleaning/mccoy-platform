import * as React from "react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import type { FormInboxMessage, FormInboxMessageSummary } from "@mccoy/email/contracts";
import { useInquiryStatusUpdate } from "../hooks/useInquiryStatusUpdate";

vi.mock("@/lib/api/admin-requests.functions", () => ({
  updateAdminInquiryStatus: vi.fn(),
}));

import { updateAdminInquiryStatus } from "@/lib/api/admin-requests.functions";
const updateAdminInquiryStatusMock = vi.mocked(updateAdminInquiryStatus);

type SummaryStatus = FormInboxMessageSummary["inquiryStatus"];

function summary(id: string, status: SummaryStatus): FormInboxMessageSummary {
  return {
    id,
    uid: 1,
    kind: "inquiry",
    from: "a@example.com",
    to: "info@mccoy.nl",
    subject: "Hallo",
    date: "2026-08-01T10:00:00.000Z",
    snippet: "",
    unread: false,
    submitterName: "Ada",
    submitterEmail: "a@example.com",
    requestNumber: "WR-2026-00001",
    inquiryStatus: status,
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
  vi.clearAllMocks();
});

/**
 * Harness: renders the hook's observable state (items, toast, saving, error)
 * as DOM text so tests can assert without reaching into the hook closure.
 * A `trigger` prop fires updateStatus once on mount.
 */
function Harness({
  initialItems,
  triggerId,
  triggerStatus,
}: {
  initialItems: FormInboxMessageSummary[];
  triggerId: string;
  triggerStatus: SummaryStatus;
}) {
  const [items, setItems] = React.useState(initialItems);
  const [, setDetail] = React.useState<FormInboxMessage | null>(null);
  const api = useInquiryStatusUpdate({ setItems, setDetail, selectedId: null });
  const firedRef = React.useRef(false);

  React.useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    void api.updateStatus(triggerId, triggerStatus as never);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- single-shot trigger
  }, []);

  return (
    <div>
      <div data-testid="items">
        {items.map((i) => `${i.id}:${i.inquiryStatus ?? "new"}`).join(",")}
      </div>
      <div data-testid="toast">{api.toast ?? ""}</div>
      <div data-testid="saving">{api.isSaving(triggerId) ? "saving" : "idle"}</div>
      <div data-testid="error">{api.errorFor(triggerId) ?? ""}</div>
    </div>
  );
}

function flush() {
  return act(async () => {
    await vi.waitFor(() => {
      expect(updateAdminInquiryStatusMock).toHaveBeenCalled();
    });
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("useInquiryStatusUpdate", () => {
  beforeEach(() => {
    updateAdminInquiryStatusMock.mockReset();
  });

  it("optimistically updates the list and confirms the server status on success", async () => {
    updateAdminInquiryStatusMock.mockResolvedValue({
      ok: true,
      inquiryStatus: "in_progress",
      requestId: "1",
    });
    const container = mount(
      <Harness initialItems={[summary("1", "new")]} triggerId="1" triggerStatus="in_progress" />,
    );

    // Optimistic update is synchronous.
    expect(container.querySelector('[data-testid="items"]')?.textContent).toBe("1:in_progress");
    expect(container.querySelector('[data-testid="saving"]')?.textContent).toBe("saving");

    await flush();

    expect(container.querySelector('[data-testid="items"]')?.textContent).toBe("1:in_progress");
    expect(container.querySelector('[data-testid="saving"]')?.textContent).toBe("idle");
    expect(container.querySelector('[data-testid="toast"]')?.textContent).toContain(
      "In behandeling",
    );
  });

  it("rolls back to the previous status and surfaces an error on failure", async () => {
    updateAdminInquiryStatusMock.mockResolvedValue({
      ok: false,
      error: "Aanvraag niet gevonden.",
      code: "not_found",
    });
    const container = mount(
      <Harness
        initialItems={[summary("1", "in_progress")]}
        triggerId="1"
        triggerStatus="invoiced"
      />,
    );

    // Optimistic jump to invoiced.
    expect(container.querySelector('[data-testid="items"]')?.textContent).toBe("1:invoiced");

    await flush();

    // Rolled back to the previous status (in_progress), error surfaced.
    expect(container.querySelector('[data-testid="items"]')?.textContent).toBe("1:in_progress");
    expect(container.querySelector('[data-testid="saving"]')?.textContent).toBe("idle");
    expect(container.querySelector('[data-testid="error"]')?.textContent).toContain(
      "Aanvraag niet gevonden.",
    );
    expect(container.querySelector('[data-testid="toast"]')?.textContent).toContain(
      "Aanvraag niet gevonden.",
    );
  });
});
