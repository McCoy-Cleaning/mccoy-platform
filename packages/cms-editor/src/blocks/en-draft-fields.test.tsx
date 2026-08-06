import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  createDefaultBlock,
  defaultSectionContent,
  type PartnersContent,
  type StatsContent,
  type WorkGalleryContent,
} from "@mccoy/cms-schema";
import {
  CmsAiAssistProvider,
  type CmsAiAssistApi,
  isTranslatableFieldKey,
} from "../ai-assist";
import { RegisteredBlockEditor } from "./RegisteredBlockEditor";
import { blockEnPath } from "./en-draft-fields";
import { PartnersInspector } from "../inspectors/PartnersInspector";
import { StatsInspector } from "../inspectors/StatsInspector";
import { WorkGalleryInspector } from "../inspectors/WorkGalleryInspector";

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

function mockAi(drafts: Record<string, string> = {}): CmsAiAssistApi {
  const store = { ...drafts };
  return {
    configured: false,
    statusMessage: "AI niet geconfigureerd (test)",
    generateDutch: async () => ({ ok: false, error: "n/a" }),
    translateToEn: async () => ({ ok: false, error: "n/a" }),
    generateSection: async () => ({ ok: false, error: "n/a" }),
    getEnDraft: (path) => store[path] ?? "",
    setEnDraft: (path, value) => {
      if (!value.trim()) delete store[path];
      else store[path] = value;
    },
    setEnDrafts: (patch) => {
      for (const [k, v] of Object.entries(patch)) {
        if (!v.trim()) delete store[k];
        else store[k] = v;
      }
    },
    confirmOverwrite: async () => false,
  };
}

afterEach(() => {
  if (mounted) {
    act(() => mounted!.root.unmount());
    mounted.container.remove();
    mounted = null;
  }
});

describe("blockEnPath", () => {
  it("builds block field draft paths", () => {
    expect(blockEnPath("abc", "title")).toBe("block:abc:title");
    expect(blockEnPath("abc", "features.0.body")).toBe("block:abc:features.0.body");
    expect(blockEnPath(undefined, "title")).toBeUndefined();
  });
});

describe("manual EN draft controls in editors", () => {
  it.each([
    ["hero", "Eyebrow"],
    ["newsletter", "Consenttekst"],
    ["columns", "Kolom toevoegen"],
    ["quote", "Quote"],
    ["plans", "Kenmerkenmatrix"],
  ] as const)("%s exposes EN · labels when AI assist is provided", (type, nlHint) => {
    const block = createDefaultBlock(type);
    const container = mount(
      <CmsAiAssistProvider value={mockAi()}>
        <RegisteredBlockEditor block={block} onChange={vi.fn()} />
      </CmsAiAssistProvider>,
    );
    expect(container.textContent).toContain(nlHint);
    expect(container.textContent).toMatch(/EN ·/);
  });

  it("spacer has no EN drafts (non-text)", () => {
    const block = createDefaultBlock("spacer");
    const container = mount(
      <CmsAiAssistProvider value={mockAi()}>
        <RegisteredBlockEditor block={block} onChange={vi.fn()} />
      </CmsAiAssistProvider>,
    );
    expect(container.textContent).toContain("Grootte");
    expect(container.textContent).not.toMatch(/EN ·/);
  });

  it("partners / stats / workGallery fixed inspectors expose EN", () => {
    const partners = defaultSectionContent("home.partners") as PartnersContent;
    const stats = defaultSectionContent("home.stats") as StatsContent;
    const gallery = defaultSectionContent("home.workGallery") as WorkGalleryContent;

    const expandAiPanel = (container: HTMLDivElement) => {
      const toggle = Array.from(container.querySelectorAll("button")).find((b) =>
        b.textContent?.includes("Uitklappen"),
      );
      expect(toggle).toBeTruthy();
      act(() => {
        toggle!.click();
      });
    };

    const p = mount(
      <CmsAiAssistProvider value={mockAi()}>
        <PartnersInspector content={partners} onPatch={vi.fn()} />
      </CmsAiAssistProvider>,
    );
    expandAiPanel(p);
    expect(p.textContent).toMatch(/Engelse vertaling|EN ·/);

    act(() => mounted!.root.unmount());
    mounted!.container.remove();
    mounted = null;

    const s = mount(
      <CmsAiAssistProvider value={mockAi()}>
        <StatsInspector content={stats} onPatch={vi.fn()} />
      </CmsAiAssistProvider>,
    );
    expandAiPanel(s);
    expect(s.textContent).toMatch(/Engelse vertaling|EN ·/);

    act(() => mounted!.root.unmount());
    mounted!.container.remove();
    mounted = null;

    const g = mount(
      <CmsAiAssistProvider value={mockAi()}>
        <WorkGalleryInspector content={gallery} onPatch={vi.fn()} />
      </CmsAiAssistProvider>,
    );
    expandAiPanel(g);
    expect(g.textContent).toMatch(/Engelse vertaling|EN ·/);
  });
});

describe("isTranslatableFieldKey non-copy skips", () => {
  it("rejects contact identifiers and layout enums", () => {
    expect(isTranslatableFieldKey("contactEmail")).toBe(false);
    expect(isTranslatableFieldKey("email")).toBe(false);
    expect(isTranslatableFieldKey("icon")).toBe(false);
    expect(isTranslatableFieldKey("size")).toBe(false);
    expect(isTranslatableFieldKey("slug")).toBe(false);
  });
});
