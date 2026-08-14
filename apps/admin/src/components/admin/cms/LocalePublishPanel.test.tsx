import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CmsPage } from "@mccoy/cms-schema";

const { getEditablePage, getTranslationCoverage, samplePage, persistedState } = vi.hoisted(() => {
  const getEditablePage = vi.fn();
  const getTranslationCoverage = vi.fn();
  const samplePage = {
    id: "page_custom_test",
    kind: "custom",
    isCustom: true,
    title: "Test",
    slug: "/test-page",
    description: "",
    inNav: false,
    updatedAt: "2026-01-01T00:00:00.000Z",
    blocks: [],
    layout: [],
    enFieldDrafts: { "page:meta:title": "Hello" },
    enFieldDraftSources: { "page:meta:title": "Hallo" },
    enFieldDraftMeta: {},
  } as unknown as CmsPage;

  const persistedState = {
    version: 1,
    pages: [samplePage],
    draft: {} as Record<string, unknown>,
    saved: {} as Record<string, unknown>,
    navigation: null,
    navigationDraft: null,
    footer: null,
    footerDraft: null,
  };

  return { getEditablePage, getTranslationCoverage, samplePage, persistedState };
});

vi.mock("@/lib/cms/store", () => ({
  cms: {
    getEditablePage: (...args: unknown[]) => getEditablePage(...args),
    getTranslationCoverage: (...args: unknown[]) => getTranslationCoverage(...args),
    getAutomaticEnTranslationStatus: vi.fn(() => null),
    subscribeAutomaticEnTranslationStatus: vi.fn(() => () => undefined),
    updatePage: vi.fn(),
    translateMissingEnFields: vi.fn(),
  },
  useCms: () => persistedState,
  // Fresh clone each call mirrors applyDraftToPage / getEditablePage identity churn.
  useEditablePage: () => structuredClone(samplePage),
}));

vi.mock("@/lib/api/cms-publish.functions", () => ({
  adminGetCmsPageStatus: vi.fn(async () => ({ ok: true, draftRevisionNumber: 1 })),
  adminListCmsRevisions: vi.fn(async () => ({ ok: true, revisions: [] })),
  adminPublishCmsPage: vi.fn(),
  adminRollbackCmsPage: vi.fn(),
  adminSetCmsLocaleState: vi.fn(),
}));

vi.mock("@/lib/app-dialogs", () => ({
  appConfirm: vi.fn(async () => false),
}));

vi.mock("@/lib/utils", () => ({
  cn: (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(" "),
}));

import { LocalePublishPanel } from "./LocalePublishPanel";

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

beforeEach(() => {
  getEditablePage.mockImplementation(() => structuredClone(samplePage));
  getTranslationCoverage.mockImplementation(() => ({
    totalRequired: 1,
    translated: 1,
    missing: 0,
    blank: 0,
    stale: 0,
    invalid: 0,
    intentionalBlank: 0,
    overrideRemoved: 0,
    sourceEmpty: 0,
    fields: [],
    complete: true,
  }));
  persistedState.version = 1;
  persistedState.draft = {};
  persistedState.saved = {};
});

afterEach(() => {
  if (mounted) {
    act(() => mounted!.root.unmount());
    mounted.container.remove();
    mounted = null;
  }
  vi.clearAllMocks();
});

describe("LocalePublishPanel coverage effect (BR-001)", () => {
  it("does not loop when getEditablePage allocates new enFieldDrafts each render", async () => {
    mount(<LocalePublishPanel page={samplePage} />);

    await act(async () => {
      await Promise.resolve();
    });

    const callsAfterMount = getTranslationCoverage.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);
    expect(callsAfterMount).toBeLessThanOrEqual(2); // Strict Mode may double-invoke

    await act(async () => {
      await new Promise((r) => setTimeout(r, 40));
    });

    expect(getTranslationCoverage.mock.calls.length).toBe(callsAfterMount);
    expect(mounted!.container.textContent).toContain("EN velddekking");
  });
});
