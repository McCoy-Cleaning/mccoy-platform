import { afterEach, describe, expect, it, vi } from "vitest";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PopupContentTypeChooser, PopupContentTypePicker } from "./PopupContentTypePicker";

let mounted: { container: HTMLDivElement; root: Root } | null = null;

function mountChooser(props: ComponentProps<typeof PopupContentTypeChooser>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<PopupContentTypeChooser {...props} />);
  });
  mounted = { container, root };
  return container;
}

function mountPicker(props: ComponentProps<typeof PopupContentTypePicker>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<PopupContentTypePicker {...props} />);
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

describe("PopupContentTypeChooser", () => {
  it("shows current type and opens the gallery picker", () => {
    const onChange = vi.fn();
    const container = mountChooser({ value: "richText", onChange });

    expect(container.textContent).toContain("Rich text");
    const openBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Kies wat er in de popup komt"),
    );
    expect(openBtn).toBeTruthy();

    act(() => {
      openBtn?.click();
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.textContent).toContain("Galerij");
    expect(dialog?.textContent).toContain("Hero");
  });
});

describe("PopupContentTypePicker", () => {
  it("calls onPick with the selected section type", () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    mountPicker({ open: true, selectedType: "richText", onPick, onClose });

    const gallery = Array.from(document.querySelectorAll("button")).find(
      (b) => b.getAttribute("aria-label")?.startsWith("Galerij"),
    );
    expect(gallery).toBeTruthy();

    act(() => {
      gallery?.click();
    });

    expect(onPick).toHaveBeenCalledWith("gallery");
    expect(onClose).toHaveBeenCalled();
  });

  it("lists non-CTA sections and omits CTA/popup nesting types", () => {
    mountPicker({
      open: true,
      selectedType: "richText",
      onPick: vi.fn(),
      onClose: vi.fn(),
    });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("Video");
    expect(dialog?.textContent).toContain("Contactformulier");
    const labels = Array.from(dialog?.querySelectorAll("button[aria-label]") ?? []).map(
      (b) => b.getAttribute("aria-label") ?? "",
    );
    // Catalog labels for excluded section types
    expect(labels.some((l) => l.startsWith("CTA-banner"))).toBe(false);
    expect(labels.some((l) => l.startsWith("Popup CTA"))).toBe(false);
  });
});
