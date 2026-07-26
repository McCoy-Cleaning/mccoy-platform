import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { createDefaultBlock } from "@mccoy/cms-schema";
import { RegisteredBlockEditor } from "./RegisteredBlockEditor";

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

describe("RegisteredBlockEditor custom editors", () => {
  it.each([
    ["hero", "Call-to-action"],
    ["textImage", "Sectie-afbeelding"],
    ["cta", "Knoptekst"],
    ["featureGrid", "Kenmerk toevoegen"],
    ["gallery", "Afbeelding toevoegen"],
    ["roadmap", "Mijlpaal toevoegen"],
    ["plans", "Kenmerkenmatrix"],
    ["teamGrid", "Teamlid toevoegen"],
    ["jobs", "Vacature toevoegen"],
  ] as const)("%s uses dedicated Dutch-labeled editor", (type, hint) => {
    const block = createDefaultBlock(type);
    const container = mount(<RegisteredBlockEditor block={block} onChange={vi.fn()} />);
    expect(container.textContent).toContain(hint);
  });
});
