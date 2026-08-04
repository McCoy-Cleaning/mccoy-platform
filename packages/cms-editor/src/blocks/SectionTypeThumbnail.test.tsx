import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ALL_BLOCK_TYPES, POPUP_CONTENT_BLOCK_TYPES } from "@mccoy/cms-schema";
import { SectionTypeThumbnail } from "./SectionTypeThumbnail";

let mounted: { container: HTMLDivElement; root: Root } | null = null;

function mount(type: Parameters<typeof SectionTypeThumbnail>[0]["type"]) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<SectionTypeThumbnail type={type} />);
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

describe("SectionTypeThumbnail", () => {
  it("renders a sketch for every BlockType", () => {
    for (const type of ALL_BLOCK_TYPES) {
      const container = mount(type);
      expect(container.querySelector("[aria-hidden]")).toBeTruthy();
      const current = mounted!;
      act(() => current.root.unmount());
      current.container.remove();
      mounted = null;
    }
  });

  it("covers every popup content block type used by the popup picker", () => {
    for (const type of POPUP_CONTENT_BLOCK_TYPES) {
      expect(ALL_BLOCK_TYPES).toContain(type);
      const container = mount(type);
      expect(container.firstElementChild).toBeTruthy();
      const current = mounted!;
      act(() => current.root.unmount());
      current.container.remove();
      mounted = null;
    }
  });
});
