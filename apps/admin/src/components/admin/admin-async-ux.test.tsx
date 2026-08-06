import { afterEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { InlineLoader } from "./InlineLoader";
import { AdminFormField, adminInputClassName } from "./AdminFormField";

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

describe("EmptyState", () => {
  it("renders title, description, and focusable action", () => {
    const container = mount(
      <EmptyState
        title="Geen berichten gevonden"
        description="Nog geen aanvragen."
        action={
          <button type="button" className="a-btn">
            Vernieuwen
          </button>
        }
      />,
    );
    expect(container.querySelector('[role="status"]')).toBeTruthy();
    expect(container.textContent).toContain("Geen berichten gevonden");
    expect(container.textContent).toContain("Nog geen aanvragen.");
    const action = container.querySelector("button");
    expect(action?.textContent).toContain("Vernieuwen");
    action?.focus();
    expect(document.activeElement).toBe(action);
  });
});

describe("ErrorState", () => {
  it("exposes alert role and invokes retry", () => {
    const onRetry = vi.fn();
    const container = mount(
      <ErrorState message="Er ging iets mis." onRetry={onRetry} retryLabel="Opnieuw proberen" />,
    );
    expect(container.querySelector('[role="alert"]')).toBeTruthy();
    expect(container.textContent).toContain("Er ging iets mis.");
    const button = container.querySelector("button");
    act(() => {
      button?.click();
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("preserves config children", () => {
    const container = mount(
      <ErrorState code="config" title="Mailbox niet geconfigureerd" message="Configfout.">
        <p data-testid="help">Zet FORM_INBOX_PROVIDER=imap</p>
      </ErrorState>,
    );
    expect(container.textContent).toContain("Mailbox niet geconfigureerd");
    expect(container.querySelector("[data-testid='help']")?.textContent).toContain(
      "FORM_INBOX_PROVIDER",
    );
  });
});

describe("InlineLoader", () => {
  it("includes a visible accessible label", () => {
    const container = mount(<InlineLoader label="Berichten laden…" />);
    const status = container.querySelector('[role="status"]');
    expect(status).toBeTruthy();
    expect(status?.textContent).toContain("Berichten laden…");
    expect(status?.getAttribute("aria-busy")).toBe("true");
  });
});

describe("AdminFormField", () => {
  it("associates label and announces errors", () => {
    const container = mount(
      <AdminFormField label="Onderwerp" hint="Optioneel" error="Verplicht veld">
        <input className={adminInputClassName} />
      </AdminFormField>,
    );
    const input = container.querySelector("input");
    const label = container.querySelector("label");
    expect(label?.getAttribute("for")).toBe(input?.id);
    expect(input?.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector('[role="alert"]')?.textContent).toContain("Verplicht veld");
    expect(adminInputClassName).toContain("a-input");
  });
});
