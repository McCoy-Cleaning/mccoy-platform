import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CmsButton } from "@mccoy/cms-schema";
import { CmsButtonEditor } from "./shared-fields";

let mounted: { container: HTMLDivElement; root: Root } | null = null;

function mount(node: ReactNode) {
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

describe("CmsButtonEditor Geen link mode", () => {
  it("writes action link + type none when Geen link is selected", () => {
    const onChange = vi.fn();
    const value: CmsButton = {
      label: "Lees meer",
      action: "popup",
      link: { type: "none" },
      popup: { type: "richText", data: { title: "x", body: "y" } },
    };
    const container = mount(
      <CmsButtonEditor label="Knop" value={value} onChange={onChange} />,
    );

    const geenLink = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("Geen link"),
    );
    expect(geenLink).toBeTruthy();

    act(() => {
      geenLink!.click();
    });

    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)?.[0] as CmsButton;
    expect(next.action).toBe("link");
    expect(next.link).toEqual({ type: "none" });
    expect(next.label).toBe("Lees meer");
  });
});
