import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { EditInteractionGuard } from "./index";

let mounted: { container: HTMLDivElement; root: Root } | null = null;

function mount(children: ReactNode) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(children);
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

describe("EditInteractionGuard", () => {
  it("blocks link navigation and reports it in edit mode", () => {
    const onBlockedAction = vi.fn();
    const container = mount(
      <EditInteractionGuard mode="edit" onBlockedAction={onBlockedAction}>
        <a href="/somewhere-real">Ga naar pagina</a>
      </EditInteractionGuard>,
    );
    const anchor = container.querySelector("a")!;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => {
      anchor.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(onBlockedAction).toHaveBeenCalledTimes(1);
    expect(onBlockedAction).toHaveBeenCalledWith("navigate");
  });

  it("does not block link navigation in preview mode (only edit blocks navigation)", () => {
    const onBlockedAction = vi.fn();
    const container = mount(
      <EditInteractionGuard mode="preview" onBlockedAction={onBlockedAction}>
        <a href="/somewhere-real">Ga naar pagina</a>
      </EditInteractionGuard>,
    );
    const anchor = container.querySelector("a")!;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => {
      anchor.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(false);
    expect(onBlockedAction).not.toHaveBeenCalled();
  });

  it("blocks form submission in edit mode", () => {
    const onBlockedAction = vi.fn();
    const container = mount(
      <EditInteractionGuard mode="edit" onBlockedAction={onBlockedAction}>
        <form>
          <button type="submit">Verzenden</button>
        </form>
      </EditInteractionGuard>,
    );
    const form = container.querySelector("form")!;
    const event = new Event("submit", { bubbles: true, cancelable: true });
    act(() => {
      form.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(onBlockedAction).toHaveBeenCalledTimes(1);
    expect(onBlockedAction).toHaveBeenCalledWith("submit");
  });

  it("also blocks form submission in preview mode â€” guest checkout must never fire while previewing a draft", () => {
    const onBlockedAction = vi.fn();
    const container = mount(
      <EditInteractionGuard mode="preview" onBlockedAction={onBlockedAction}>
        <form>
          <button type="submit">Verzenden</button>
        </form>
      </EditInteractionGuard>,
    );
    const form = container.querySelector("form")!;
    const event = new Event("submit", { bubbles: true, cancelable: true });
    act(() => {
      form.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
    expect(onBlockedAction).toHaveBeenCalledTimes(1);
    expect(onBlockedAction).toHaveBeenCalledWith("submit");
  });

  it("does nothing at all in off mode â€” public storefront behaves normally", () => {
    const onBlockedAction = vi.fn();
    const container = mount(
      <EditInteractionGuard mode="off" onBlockedAction={onBlockedAction}>
        <form>
          <button type="submit">Verzenden</button>
        </form>
        <a href="/somewhere-real">Ga naar pagina</a>
      </EditInteractionGuard>,
    );
    const form = container.querySelector("form")!;
    const anchor = container.querySelector("a")!;
    const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
    const clickEvent = new MouseEvent("click", { bubbles: true, cancelable: true });
    act(() => {
      form.dispatchEvent(submitEvent);
      anchor.dispatchEvent(clickEvent);
    });
    expect(submitEvent.defaultPrevented).toBe(false);
    expect(clickEvent.defaultPrevented).toBe(false);
    expect(onBlockedAction).not.toHaveBeenCalled();
  });

  it("attaches capture-phase click/submit listeners while active and removes them on unmount", () => {
    const addSpy = vi.spyOn(HTMLDivElement.prototype, "addEventListener");
    const removeSpy = vi.spyOn(HTMLDivElement.prototype, "removeEventListener");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <EditInteractionGuard mode="edit">
          <span>hi</span>
        </EditInteractionGuard>,
      );
    });
    expect(addSpy).toHaveBeenCalledWith("click", expect.any(Function), true);
    expect(addSpy).toHaveBeenCalledWith("submit", expect.any(Function), true);

    act(() => root.unmount());
    expect(removeSpy).toHaveBeenCalledWith("click", expect.any(Function), true);
    expect(removeSpy).toHaveBeenCalledWith("submit", expect.any(Function), true);

    addSpy.mockRestore();
    removeSpy.mockRestore();
    container.remove();
  });

  it("attaches no capture click/submit listeners on the guard root in off mode", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(
        <EditInteractionGuard mode="off">
          <span>hi</span>
        </EditInteractionGuard>,
      );
    });

    const guard = container.querySelector("[data-cms-edit-guard='off']");
    expect(guard).toBeTruthy();
    // Spy the guard node only — React also registers capture listeners on the createRoot container.
    const addSpy = vi.spyOn(guard as HTMLDivElement, "addEventListener");
    const onBlockedAction = vi.fn();
    act(() => {
      root.render(
        <EditInteractionGuard mode="off" onBlockedAction={onBlockedAction}>
          <span>hi</span>
        </EditInteractionGuard>,
      );
    });
    expect(addSpy).not.toHaveBeenCalledWith("click", expect.any(Function), true);
    expect(addSpy).not.toHaveBeenCalledWith("submit", expect.any(Function), true);

    addSpy.mockRestore();
    act(() => root.unmount());
    container.remove();
  });
});
