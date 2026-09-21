import * as React from "react";
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";

import { RowActionsMenu } from "./RowActionsMenu";

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

describe("RowActionsMenu", () => {
  it("opens a per-row menu and reports that company's id", () => {
    const onOpen = vi.fn();
    const onAction = vi.fn();
    const container = mount(
      <div>
        <RowActionsMenu
          companyId="11111111-1111-4111-8111-111111111111"
          companyName="ABC Facility"
          canRemind
          onOpen={onOpen}
          onAction={onAction}
        />
        <RowActionsMenu
          companyId="22222222-2222-4222-8222-222222222222"
          companyName="Fixture Collision BV"
          canRemind={false}
          onOpen={onOpen}
          onAction={onAction}
        />
      </div>,
    );

    const triggers = container.querySelectorAll('button[aria-haspopup="menu"]');
    expect(triggers).toHaveLength(2);
    expect(triggers[0]?.getAttribute("aria-label")).toBe("Acties voor ABC Facility");

    act(() => {
      (triggers[1] as HTMLButtonElement).click();
    });

    expect(onOpen).toHaveBeenCalledWith("22222222-2222-4222-8222-222222222222");
    expect(triggers[1]?.getAttribute("aria-expanded")).toBe("true");

    const view = document.querySelector('[role="menuitem"][data-action="view"]') as HTMLButtonElement;
    expect(view).toBeTruthy();
    expect(view.dataset.companyId).toBe("22222222-2222-4222-8222-222222222222");
    expect(document.body.textContent).toContain("Bekijk details");
    expect(document.body.textContent).toContain("Stuur herinnering");
    expect(document.body.textContent).toContain("Beheer portaal");
    expect(document.body.textContent).toContain("Gebruikers beheren");
    expect(document.body.textContent).toContain("Record verwijderen");

    const items = document.querySelectorAll('[role="menuitem"]');
    expect(items[items.length - 1]?.getAttribute("data-action")).toBe("delete");
    expect((items[items.length - 1] as HTMLButtonElement).className).toMatch(/red-/);

    act(() => {
      view.click();
    });
    expect(onAction).toHaveBeenCalledWith("view", "22222222-2222-4222-8222-222222222222");
  });

  it("reports delete for that row's companyId", () => {
    const onOpen = vi.fn();
    const onAction = vi.fn();
    const container = mount(
      <div>
        <RowActionsMenu
          companyId="11111111-1111-4111-8111-111111111111"
          companyName="ABC Facility"
          canRemind
          onOpen={onOpen}
          onAction={onAction}
        />
        <RowActionsMenu
          companyId="22222222-2222-4222-8222-222222222222"
          companyName="Fixture Collision BV"
          canRemind={false}
          onOpen={onOpen}
          onAction={onAction}
        />
      </div>,
    );

    const triggers = container.querySelectorAll('button[aria-haspopup="menu"]');
    act(() => {
      (triggers[1] as HTMLButtonElement).click();
    });

    const del = document.querySelector(
      '[role="menuitem"][data-action="delete"]',
    ) as HTMLButtonElement;
    expect(del).toBeTruthy();
    expect(del.dataset.companyId).toBe("22222222-2222-4222-8222-222222222222");
    expect(del.textContent).toBe("Record verwijderen");

    act(() => {
      del.click();
    });
    expect(onAction).toHaveBeenCalledWith("delete", "22222222-2222-4222-8222-222222222222");
    expect(onAction).not.toHaveBeenCalledWith("delete", "11111111-1111-4111-8111-111111111111");
  });

  it("disables remind when the row has no pending invite and closes on Escape", () => {
    const onOpen = vi.fn();
    const onAction = vi.fn();
    const container = mount(
      <RowActionsMenu
        companyId="22222222-2222-4222-8222-222222222222"
        companyName="Fixture Collision BV"
        canRemind={false}
        onOpen={onOpen}
        onAction={onAction}
      />,
    );

    const trigger = container.querySelector('button[aria-haspopup="menu"]') as HTMLButtonElement;
    act(() => {
      trigger.click();
    });

    const remind = document.querySelector(
      '[role="menuitem"][data-action="remind"]',
    ) as HTMLButtonElement;
    expect(remind.disabled).toBe(true);

    act(() => {
      remind.click();
    });
    expect(onAction).not.toHaveBeenCalled();

    act(() => {
      document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.querySelector('[role="menu"]')).toBeNull();
  });
});
