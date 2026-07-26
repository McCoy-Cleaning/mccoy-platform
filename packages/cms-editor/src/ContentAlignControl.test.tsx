import { afterEach, describe, expect, it, vi } from "vitest";
import { act, type ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ContentAlignControl } from "./ContentAlignControl";

let mounted: { container: HTMLDivElement; root: Root } | null = null;

function mount(props: ComponentProps<typeof ContentAlignControl>) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<ContentAlignControl {...props} />);
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

describe("ContentAlignControl", () => {
  it("selects Midden by default and writes exact enum values on click", () => {
    const onChange = vi.fn();
    const container = mount({ onChange });

    const radios = Array.from(
      container.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );
    expect(radios.map((r) => r.textContent)).toEqual(["Links", "Midden", "Rechts"]);
    expect(radios[1]?.getAttribute("aria-checked")).toBe("true");

    act(() => {
      radios[0]?.click();
    });
    expect(onChange).toHaveBeenLastCalledWith("left");

    act(() => {
      radios[1]?.click();
    });
    expect(onChange).toHaveBeenLastCalledWith("center");

    act(() => {
      radios[2]?.click();
    });
    expect(onChange).toHaveBeenLastCalledWith("right");

    expect(onChange.mock.calls.map((c) => c[0])).toEqual(["left", "center", "right"]);
  });

  it("reflects a controlled left/right value without shifting", () => {
    const onChange = vi.fn();
    const left = mount({ value: "left", onChange });
    expect(left.querySelector('[aria-checked="true"]')?.textContent).toBe("Links");

    act(() => mounted!.root.unmount());
    mounted!.container.remove();
    mounted = null;

    const right = mount({ value: "right", onChange });
    expect(right.querySelector('[aria-checked="true"]')?.textContent).toBe("Rechts");
  });
});
