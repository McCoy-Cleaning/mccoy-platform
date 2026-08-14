import { beforeEach, describe, expect, it, vi } from "vitest";

const testState = vi.hoisted(() => {
  const page = {
    id: "page_home",
    kind: "builtin",
    isCustom: false,
    pageKey: "home",
    slug: "/",
    title: "Home",
    description: "Beschrijving",
    inNav: true,
    blocks: [],
    layout: [],
    layoutVersion: 1,
    sectionContent: {},
    updatedAt: 1,
    version: 1,
  };
  return {
    page,
    state: {
      version: 1,
      pages: [page],
      draft: { page_home: { dirty: true } } as Record<string, unknown>,
      saved: {} as Record<string, unknown>,
      navigation: null,
      navigationDraft: null,
      footer: null,
      footerDraft: null,
    },
    publishSavedPageToServer: vi.fn(),
    resolvePublish: null as null | ((value: { ok: true }) => void),
    translateMissingEnForPublish: vi.fn(),
    resolveTranslation: null as null | ((value: unknown) => void),
    write: vi.fn(() => true),
  };
});

vi.mock("@mccoy/cms-schema", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mccoy/cms-schema")>();
  return {
    ...actual,
    applyDraftToPage: vi.fn((page) => structuredClone(page)),
    validatePublishableCmsPage: vi.fn((page) => ({ ok: true as const, page })),
    decideOpslaanPublishedLocales: vi.fn(({ hasEnDraftKeys }: { hasEnDraftKeys: boolean }) =>
      hasEnDraftKeys ? ["nl", "en"] : ["nl"],
    ),
    opslaanSuccessToastTitle: vi.fn(() => "NL gepubliceerd."),
  };
});

vi.mock("@/lib/api/cms-publish.functions", () => ({
  adminGetPublishedCmsPages: vi.fn(),
  adminListPublishedCustomPageIds: vi.fn(),
}));

vi.mock("./server-publish", () => ({
  deleteSavedPageFromServer: vi.fn(),
  publishSavedPageToServer: testState.publishSavedPageToServer,
  publishSiteChromeToServer: vi.fn(),
  saveConceptPageToServer: vi.fn(),
}));

vi.mock("./store-draft", () => ({
  pagesForNavCap: vi.fn((state) => state.pages),
  publishedPage: vi.fn((state, pageId) =>
    state.pages.find((page: { id: string }) => page.id === pageId),
  ),
}));

vi.mock("./store-en", () => ({
  preparePageEnForOpslaan: vi.fn((page) => ({
    nextPage: page,
    toTranslate: { "page:meta:description": page.description },
    hasEnDraftKeys: false,
  })),
  translateMissingEnForPublish: testState.translateMissingEnForPublish,
}));

vi.mock("./store-persistence", () => ({
  markPreviewStale: vi.fn(),
  read: vi.fn(() => testState.state),
  reconcileCustomInNavFromLinks: vi.fn(),
  sanitizeLoadedNavigation: vi.fn((state) => ({ state, changed: false })),
  sessionPreviewSnapshots: new Map(),
  syncCustomPageIntoNavigation: vi.fn(),
  WRITE_FAIL_REASON: "Lokaal opslaan mislukt.",
  write: testState.write,
  writeOrAlert: vi.fn(),
}));

vi.mock("./publish-sync", () => ({
  pushPublishedChromeToStorefront: vi.fn(),
}));

vi.mock("./validation-messages.nl", () => ({
  formatValidateIssuesNl: vi.fn(() => []),
}));

import { cmsPublishApi } from "./store-publish";

beforeEach(() => {
  testState.state.pages = [structuredClone(testState.page)];
  testState.state.draft = { page_home: { dirty: true } };
  testState.state.saved = {};
  testState.write.mockClear();
  testState.translateMissingEnForPublish.mockReset();
  testState.translateMissingEnForPublish.mockImplementation(
    (_pageId: string, page: typeof testState.page) =>
      new Promise((resolve) => {
        testState.resolveTranslation = resolve;
      }),
  );
  testState.publishSavedPageToServer.mockReset();
  testState.publishSavedPageToServer.mockImplementation(
    () =>
      new Promise<{ ok: true }>((resolve) => {
        testState.resolvePublish = resolve;
      }),
  );
});

describe("cmsPublishApi.savePage", () => {
  it("deduplicates clicks, translates once, and performs one final publish", async () => {
    const first = cmsPublishApi.savePage("page_home");
    const second = cmsPublishApi.savePage("page_home");

    expect(testState.translateMissingEnForPublish).toHaveBeenCalledTimes(1);
    expect(testState.publishSavedPageToServer).not.toHaveBeenCalled();
    testState.resolveTranslation?.({
      page: {
        ...structuredClone(testState.page),
        enFieldDrafts: { "page:meta:description": "Description" },
      },
      translated: 1,
      failed: 0,
      skipped: 0,
      providerCalls: 1,
    });
    await vi.waitFor(() => {
      expect(testState.publishSavedPageToServer).toHaveBeenCalledTimes(1);
    });
    testState.resolvePublish?.({ ok: true });

    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult).toMatchObject({ ok: true, message: "NL gepubliceerd." });
    expect(secondResult).toEqual(firstResult);
    expect(testState.write).toHaveBeenCalledTimes(1);
    expect(testState.translateMissingEnForPublish).toHaveBeenCalledWith(
      "page_home",
      expect.any(Object),
      {
        "page:meta:description": "Beschrijving",
      },
    );
    expect(testState.publishSavedPageToServer).toHaveBeenCalledTimes(1);
    expect(testState.publishSavedPageToServer).toHaveBeenCalledWith(
      expect.objectContaining({
        enFieldDrafts: { "page:meta:description": "Description" },
      }),
      ["nl", "en"],
    );
  });
});
